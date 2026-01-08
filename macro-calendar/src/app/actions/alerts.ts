"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema for validating UUID indicator IDs
const indicatorIdSchema = z.string().uuid("Invalid indicator ID");

/**
 * Alert preference returned from the database.
 */
export interface AlertPreference {
  id: string;
  user_id: string;
  indicator_id: string;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Result type for alert action operations.
 */
export type AlertActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Get all alert preferences for the current user.
 *
 * @returns Array of alert preferences or error
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
    .select("*")
    .eq("user_id", user.id);

  if (selectError) {
    return { success: false, error: "Failed to fetch alert preferences" };
  }

  return { success: true, data: data as AlertPreference[] };
}

/**
 * Update an alert preference for a specific indicator.
 * Creates the preference if it doesn't exist.
 *
 * @param indicatorId - UUID of the indicator
 * @param emailEnabled - Whether email alerts should be enabled
 * @returns Updated preference or error
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

  // Upsert the alert preference
  // RLS policy ensures user can only modify their own preferences
  // Note: updated_at is managed by database trigger (see 002_create_profiles.sql)
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
    .select()
    .single();

  if (upsertError) {
    // Handle foreign key violation (indicator doesn't exist)
    if (upsertError.code === "23503") {
      return { success: false, error: "Indicator not found" };
    }
    return { success: false, error: "Failed to update alert preference" };
  }

  return { success: true, data: data as AlertPreference };
}

/**
 * Toggle email alert on/off for a specific indicator.
 * Creates the preference with email enabled if it doesn't exist.
 * If it exists, toggles the current email_enabled state.
 *
 * @param indicatorId - UUID of the indicator to toggle alerts for
 * @returns Updated preference with new email_enabled state or error
 */
export async function toggleEmailAlert(
  indicatorId: string
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

  // Check if preference already exists
  const { data: existing, error: selectError } = await supabase
    .from("alert_preferences")
    .select("*")
    .eq("user_id", user.id)
    .eq("indicator_id", indicatorId)
    .maybeSingle();

  if (selectError) {
    return { success: false, error: "Failed to check alert preference" };
  }

  if (existing) {
    // Toggle the existing preference
    // Note: updated_at is managed by database trigger (see 002_create_profiles.sql)
    const newEmailEnabled = !existing.email_enabled;
    const { data, error: updateError } = await supabase
      .from("alert_preferences")
      .update({
        email_enabled: newEmailEnabled,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      return { success: false, error: "Failed to toggle alert preference" };
    }

    return { success: true, data: data as AlertPreference };
  } else {
    // Create new preference with email enabled
    const { data, error: insertError } = await supabase
      .from("alert_preferences")
      .insert({
        user_id: user.id,
        indicator_id: indicatorId,
        email_enabled: true,
      })
      .select()
      .single();

    if (insertError) {
      // Handle foreign key violation (indicator doesn't exist)
      if (insertError.code === "23503") {
        return { success: false, error: "Indicator not found" };
      }
      return { success: false, error: "Failed to create alert preference" };
    }

    return { success: true, data: data as AlertPreference };
  }
}
