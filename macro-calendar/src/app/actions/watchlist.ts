"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema for validating UUID indicator IDs
const indicatorIdSchema = z.string().uuid("Invalid indicator ID");

/**
 * Result type for watchlist actions.
 * Success returns data, failure returns error message.
 */
export type WatchlistActionResult =
  | { success: true; data?: { isWatching: boolean } }
  | { success: false; error: string };

/**
 * Add an indicator to the current user's watchlist.
 *
 * @param indicatorId - UUID of the indicator to add
 * @returns Success/failure result
 */
export async function addToWatchlist(
  indicatorId: string
): Promise<WatchlistActionResult> {
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

  // Insert watchlist item
  // RLS policy ensures user can only insert for themselves
  const { error: insertError } = await supabase.from("watchlist").insert({
    user_id: user.id,
    indicator_id: indicatorId,
  });

  if (insertError) {
    // Handle unique constraint violation (already watching)
    if (insertError.code === "23505") {
      return { success: true, data: { isWatching: true } };
    }
    // Handle foreign key violation (indicator doesn't exist)
    if (insertError.code === "23503") {
      return { success: false, error: "Indicator not found" };
    }
    return { success: false, error: "Failed to add to watchlist" };
  }

  return { success: true, data: { isWatching: true } };
}

/**
 * Remove an indicator from the current user's watchlist.
 *
 * @param indicatorId - UUID of the indicator to remove
 * @returns Success/failure result
 */
export async function removeFromWatchlist(
  indicatorId: string
): Promise<WatchlistActionResult> {
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

  // Delete watchlist item
  // RLS policy ensures user can only delete their own items
  const { error: deleteError } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("indicator_id", indicatorId);

  if (deleteError) {
    return { success: false, error: "Failed to remove from watchlist" };
  }

  return { success: true, data: { isWatching: false } };
}

/**
 * Toggle an indicator's watchlist state for the current user.
 * If watching, removes; if not watching, adds.
 *
 * @param indicatorId - UUID of the indicator to toggle
 * @returns Success/failure result with new watching state
 */
export async function toggleWatchlist(
  indicatorId: string
): Promise<WatchlistActionResult> {
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

  // Check if indicator is currently in watchlist
  const { data: existing, error: selectError } = await supabase
    .from("watchlist")
    .select("id")
    .eq("user_id", user.id)
    .eq("indicator_id", indicatorId)
    .maybeSingle();

  if (selectError) {
    return { success: false, error: "Failed to check watchlist status" };
  }

  if (existing) {
    // Currently watching: remove
    const { error: deleteError } = await supabase
      .from("watchlist")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      return { success: false, error: "Failed to remove from watchlist" };
    }

    return { success: true, data: { isWatching: false } };
  } else {
    // Not watching: add
    const { error: insertError } = await supabase.from("watchlist").insert({
      user_id: user.id,
      indicator_id: indicatorId,
    });

    if (insertError) {
      // Handle foreign key violation (indicator doesn't exist)
      if (insertError.code === "23503") {
        return { success: false, error: "Indicator not found" };
      }
      return { success: false, error: "Failed to add to watchlist" };
    }

    return { success: true, data: { isWatching: true } };
  }
}
