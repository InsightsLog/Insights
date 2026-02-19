"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema for validating UUID indicator IDs
const indicatorIdSchema = z.string().uuid("Invalid indicator ID");

// Schema for the alert preference update payload
const updatePayloadSchema = z.object({
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
});

/**
 * A watchlist item combined with its alert preference state.
 */
export type WatchlistWithPreference = {
  watchlistId: string;
  indicatorId: string;
  indicatorName: string;
  countryCode: string;
  category: string;
  importance: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
};

/**
 * Result type for alert-preference actions.
 */
export type AlertPrefResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Fetch the current user's watchlist combined with their alert preferences.
 *
 * @returns List of watchlisted indicators with current email/push state.
 */
export async function getWatchlistWithAlertPreferences(): Promise<
  AlertPrefResult<WatchlistWithPreference[]>
> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch watchlist items joined with indicator details
  const { data: watchlistData, error: watchlistError } = await supabase
    .from("watchlist")
    .select(
      `
      id,
      indicator_id,
      indicator:indicators (
        id,
        name,
        country_code,
        category,
        importance
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (watchlistError) {
    return { success: false, error: "Failed to fetch watchlist" };
  }

  const items = watchlistData ?? [];
  if (items.length === 0) {
    return { success: true, data: [] };
  }

  const indicatorIds = items.map((i) => i.indicator_id);

  // Fetch alert preferences for all watchlisted indicators
  const { data: prefsData, error: prefsError } = await supabase
    .from("alert_preferences")
    .select("indicator_id, email_enabled, push_enabled")
    .eq("user_id", user.id)
    .in("indicator_id", indicatorIds);

  if (prefsError) {
    return { success: false, error: "Failed to fetch alert preferences" };
  }

  // Build lookup map: indicatorId → prefs
  const prefsMap = new Map<
    string,
    { email_enabled: boolean; push_enabled: boolean }
  >();
  for (const pref of prefsData ?? []) {
    prefsMap.set(pref.indicator_id, {
      email_enabled: pref.email_enabled,
      push_enabled: pref.push_enabled,
    });
  }

  // Combine watchlist + indicator + prefs
  const result: WatchlistWithPreference[] = items
    .map((item) => {
      // Supabase returns embedded relations as arrays for 1:many joins;
      // normalise to a single object.
      const ind = Array.isArray(item.indicator)
        ? item.indicator[0]
        : item.indicator;
      if (!ind) return null;

      const prefs = prefsMap.get(item.indicator_id);
      return {
        watchlistId: item.id,
        indicatorId: item.indicator_id,
        indicatorName: ind.name,
        countryCode: ind.country_code,
        category: ind.category,
        importance: ind.importance ?? "medium",
        emailEnabled: prefs?.email_enabled ?? false,
        pushEnabled: prefs?.push_enabled ?? false,
      };
    })
    .filter((x): x is WatchlistWithPreference => x !== null);

  return { success: true, data: result };
}

/**
 * Update (upsert) the alert preference for a single indicator.
 *
 * @param indicatorId  - UUID of the indicator
 * @param emailEnabled - Whether email alerts are enabled
 * @param pushEnabled  - Whether push notifications are enabled
 */
export async function updateAlertPreferences(
  indicatorId: string,
  emailEnabled: boolean,
  pushEnabled: boolean
): Promise<AlertPrefResult<{ emailEnabled: boolean; pushEnabled: boolean }>> {
  // Validate inputs
  const idResult = indicatorIdSchema.safeParse(indicatorId);
  if (!idResult.success) {
    return { success: false, error: "Invalid indicator ID format" };
  }

  const payloadResult = updatePayloadSchema.safeParse({
    emailEnabled,
    pushEnabled,
  });
  if (!payloadResult.success) {
    return { success: false, error: "Invalid alert preference values" };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error: upsertError } = await supabase
    .from("alert_preferences")
    .upsert(
      {
        user_id: user.id,
        indicator_id: indicatorId,
        email_enabled: emailEnabled,
        push_enabled: pushEnabled,
      },
      { onConflict: "user_id,indicator_id" }
    );

  if (upsertError) {
    if (upsertError.code === "23503") {
      return { success: false, error: "Indicator not found" };
    }
    return { success: false, error: "Failed to update alert preferences" };
  }

  return { success: true, data: { emailEnabled, pushEnabled } };
}
