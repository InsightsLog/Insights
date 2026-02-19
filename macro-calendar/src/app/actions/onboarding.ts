"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema for validating the completeOnboarding input
const completeOnboardingSchema = z.object({
  indicatorIds: z.array(z.string().uuid()),
  enableAlerts: z.boolean(),
});

/**
 * Result type for onboarding actions.
 */
export type OnboardingActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Indicator data returned for the onboarding wizard.
 */
export type IndicatorForOnboarding = {
  id: string;
  name: string;
  country_code: string;
  category: string;
  importance: string;
};

/**
 * Fetch all indicators for the onboarding wizard.
 * Indicators are public; auth is still verified so unauthenticated
 * users get a clear error instead of empty data.
 *
 * @returns All indicators ordered by importance desc then name
 */
export async function getIndicatorsForOnboarding(): Promise<
  { success: true; data: IndicatorForOnboarding[] } | { success: false; error: string }
> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("indicators")
    .select("id, name, country_code, category, importance")
    .order("name");

  if (error) {
    return { success: false, error: "Failed to fetch indicators" };
  }

  return { success: true, data: data ?? [] };
}

/**
 * Complete the onboarding wizard.
 * Adds the selected indicators to the user's watchlist,
 * optionally enables email alerts for each, and marks the
 * profile as onboarding_complete = true.
 *
 * @param indicatorIds - UUIDs of indicators the user chose to watch
 * @param enableAlerts - Whether to enable email alerts for selected indicators
 */
export async function completeOnboarding(
  indicatorIds: string[],
  enableAlerts: boolean
): Promise<OnboardingActionResult> {
  // Validate input
  const parseResult = completeOnboardingSchema.safeParse({
    indicatorIds,
    enableAlerts,
  });
  if (!parseResult.success) {
    return { success: false, error: "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();

  // Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Add selected indicators to watchlist (upsert to handle duplicates)
  if (indicatorIds.length > 0) {
    const watchlistItems = indicatorIds.map((id) => ({
      user_id: user.id,
      indicator_id: id,
    }));

    const { error: watchlistError } = await supabase
      .from("watchlist")
      .upsert(watchlistItems, { onConflict: "user_id,indicator_id" });

    if (watchlistError) {
      return { success: false, error: "Failed to save watchlist" };
    }

    // Optionally enable email alerts for each selected indicator
    if (enableAlerts) {
      const alertItems = indicatorIds.map((id) => ({
        user_id: user.id,
        indicator_id: id,
        email_enabled: true,
      }));

      const { error: alertError } = await supabase
        .from("alert_preferences")
        .upsert(alertItems, { onConflict: "user_id,indicator_id" });

      if (alertError) {
        return { success: false, error: "Failed to save alert preferences" };
      }
    }
  }

  // Mark onboarding as complete on the user's profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ onboarding_complete: true })
    .eq("id", user.id);

  if (profileError) {
    return { success: false, error: "Failed to complete onboarding" };
  }

  return { success: true };
}
