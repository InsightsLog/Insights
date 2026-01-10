"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema for validating UUID indicator IDs
const indicatorIdSchema = z.string().uuid("Invalid indicator ID");

/**
 * Alert preference record from the database.
 */
export type AlertPreference = {
  id: string;
  indicator_id: string;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Result type for alert preference actions.
 * Success returns data, failure returns error message.
 */
export type AlertActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Get all alert preferences for the current user.
 *
 * @returns List of alert preferences or error
 */
export async function getAlertPreferences(): Promise<
  AlertActionResult<AlertPreference[]>
> {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch alert preferences for the user
  // RLS policy ensures user can only read their own preferences
  const { data, error: selectError } = await supabase
    .from("alert_preferences")
    .select("id, indicator_id, email_enabled, created_at, updated_at")
    .eq("user_id", user.id);

  if (selectError) {
    return { success: false, error: "Failed to fetch alert preferences" };
  }

  return { success: true, data: data ?? [] };
}

/**
 * Update or create an alert preference for the current user.
 *
 * @param indicatorId - UUID of the indicator
 * @param emailEnabled - Whether email alerts are enabled
 * @returns Success/failure result with updated preference
 */
export async function updateAlertPreference(
  indicatorId: string,
  emailEnabled: boolean
): Promise<AlertActionResult<AlertPreference>> {
  // Validate indicator ID format
  const parseResult = indicatorIdSchema.safeParse(indicatorId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid indicator ID format" };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Upsert alert preference (insert or update on conflict)
  // RLS policy ensures user can only modify their own preferences
  const { data, error: upsertError } = await supabase
    .from("alert_preferences")
    .upsert(
      {
        user_id: user.id,
        indicator_id: indicatorId,
        email_enabled: emailEnabled,
      },
      {
        onConflict: "user_id,indicator_id",
      }
    )
    .select("id, indicator_id, email_enabled, created_at, updated_at")
    .single();

  if (upsertError) {
    // Handle foreign key violation (indicator doesn't exist)
    if (upsertError.code === "23503") {
      return { success: false, error: "Indicator not found" };
    }
    return { success: false, error: "Failed to update alert preference" };
  }

  return { success: true, data };
}

/**
 * Toggle email alert for the current user on a specific indicator.
 * Creates a preference if none exists (defaults to enabling alerts).
 *
 * @param indicatorId - UUID of the indicator to toggle
 * @returns Success/failure result with new email_enabled state
 */
export async function toggleEmailAlert(
  indicatorId: string
): Promise<AlertActionResult<{ email_enabled: boolean }>> {
  // Validate indicator ID format
  const parseResult = indicatorIdSchema.safeParse(indicatorId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid indicator ID format" };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Check if preference exists
  const { data: existing, error: selectError } = await supabase
    .from("alert_preferences")
    .select("id, email_enabled")
    .eq("user_id", user.id)
    .eq("indicator_id", indicatorId)
    .maybeSingle();

  if (selectError) {
    return { success: false, error: "Failed to check alert preference" };
  }

  if (existing) {
    // Toggle the existing preference
    const newEmailEnabled = !existing.email_enabled;

    const { error: updateError } = await supabase
      .from("alert_preferences")
      .update({ email_enabled: newEmailEnabled })
      .eq("id", existing.id);

    if (updateError) {
      return { success: false, error: "Failed to toggle alert preference" };
    }

    return { success: true, data: { email_enabled: newEmailEnabled } };
  } else {
    // Create new preference with email_enabled = true
    const { error: insertError } = await supabase
      .from("alert_preferences")
      .insert({
        user_id: user.id,
        indicator_id: indicatorId,
        email_enabled: true,
      });

    if (insertError) {
      // Handle foreign key violation (indicator doesn't exist)
      if (insertError.code === "23503") {
        return { success: false, error: "Indicator not found" };
      }
      return { success: false, error: "Failed to create alert preference" };
    }

    return { success: true, data: { email_enabled: true } };
  }
}
