"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema for validating UUID indicator IDs
const indicatorIdSchema = z.string().uuid("Invalid indicator ID");

// Schema for validating UUID organization IDs
const orgIdSchema = z.string().uuid("Invalid organization ID");

/**
 * Result type for watchlist actions.
 * Success returns data, failure returns error message.
 */
export type WatchlistActionResult =
  | { success: true; data?: { isWatching: boolean } }
  | { success: false; error: string };

/**
 * Organization watchlist item type.
 */
export type OrgWatchlistItem = {
  id: string;
  indicator_id: string;
  org_id: string;
  created_at: string;
};

/**
 * Result type for organization watchlist list operations.
 */
export type OrgWatchlistListResult =
  | { success: true; data: OrgWatchlistItem[] }
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

/**
 * Add an indicator to an organization's shared watchlist.
 * Requires admin or owner role in the organization.
 *
 * @param orgId - UUID of the organization
 * @param indicatorId - UUID of the indicator to add
 * @returns Success/failure result
 */
export async function addToOrgWatchlist(
  orgId: string,
  indicatorId: string
): Promise<WatchlistActionResult> {
  // Validate org ID format
  const orgParseResult = orgIdSchema.safeParse(orgId);
  if (!orgParseResult.success) {
    return { success: false, error: "Invalid organization ID format" };
  }

  // Validate indicator ID format
  const indicatorParseResult = indicatorIdSchema.safeParse(indicatorId);
  if (!indicatorParseResult.success) {
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

  // Insert watchlist item with org_id
  // RLS policy ensures user is an admin/owner of the org
  const { error: insertError } = await supabase.from("watchlist").insert({
    user_id: user.id,
    indicator_id: indicatorId,
    org_id: orgId,
  });

  if (insertError) {
    // Handle unique constraint violation (already in org watchlist)
    if (insertError.code === "23505") {
      return { success: true, data: { isWatching: true } };
    }
    // Handle foreign key violation (indicator or org doesn't exist)
    if (insertError.code === "23503") {
      return { success: false, error: "Indicator or organization not found" };
    }
    // Handle RLS policy violation (not authorized)
    if (insertError.code === "42501") {
      return { success: false, error: "Not authorized to modify organization watchlist" };
    }
    return { success: false, error: "Failed to add to organization watchlist" };
  }

  return { success: true, data: { isWatching: true } };
}

/**
 * Remove an indicator from an organization's shared watchlist.
 * Requires admin or owner role in the organization.
 *
 * @param orgId - UUID of the organization
 * @param indicatorId - UUID of the indicator to remove
 * @returns Success/failure result
 */
export async function removeFromOrgWatchlist(
  orgId: string,
  indicatorId: string
): Promise<WatchlistActionResult> {
  // Validate org ID format
  const orgParseResult = orgIdSchema.safeParse(orgId);
  if (!orgParseResult.success) {
    return { success: false, error: "Invalid organization ID format" };
  }

  // Validate indicator ID format
  const indicatorParseResult = indicatorIdSchema.safeParse(indicatorId);
  if (!indicatorParseResult.success) {
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

  // Delete watchlist item with org_id
  // RLS policy ensures user is an admin/owner of the org
  const { error: deleteError } = await supabase
    .from("watchlist")
    .delete()
    .eq("org_id", orgId)
    .eq("indicator_id", indicatorId);

  if (deleteError) {
    // Handle RLS policy violation (not authorized)
    if (deleteError.code === "42501") {
      return { success: false, error: "Not authorized to modify organization watchlist" };
    }
    return { success: false, error: "Failed to remove from organization watchlist" };
  }

  return { success: true, data: { isWatching: false } };
}

/**
 * Get all watchlist items for an organization.
 * Requires membership in the organization (any role).
 *
 * @param orgId - UUID of the organization
 * @returns List of organization watchlist items or error
 */
export async function getOrgWatchlist(
  orgId: string
): Promise<OrgWatchlistListResult> {
  // Validate org ID format
  const parseResult = orgIdSchema.safeParse(orgId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid organization ID format" };
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

  // Fetch organization watchlist items
  // RLS policy ensures user is a member of the org
  const { data, error: selectError } = await supabase
    .from("watchlist")
    .select("id, indicator_id, org_id, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (selectError) {
    return { success: false, error: "Failed to fetch organization watchlist" };
  }

  return {
    success: true,
    data: (data ?? []).map((item) => ({
      id: item.id,
      indicator_id: item.indicator_id,
      org_id: item.org_id,
      created_at: item.created_at,
    })),
  };
}

/**
 * Toggle an indicator's watchlist state for an organization.
 * If watching, removes; if not watching, adds.
 * Requires admin or owner role in the organization.
 *
 * @param orgId - UUID of the organization
 * @param indicatorId - UUID of the indicator to toggle
 * @returns Success/failure result with new watching state
 */
export async function toggleOrgWatchlist(
  orgId: string,
  indicatorId: string
): Promise<WatchlistActionResult> {
  // Validate org ID format
  const orgParseResult = orgIdSchema.safeParse(orgId);
  if (!orgParseResult.success) {
    return { success: false, error: "Invalid organization ID format" };
  }

  // Validate indicator ID format
  const indicatorParseResult = indicatorIdSchema.safeParse(indicatorId);
  if (!indicatorParseResult.success) {
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

  // Check if indicator is currently in org watchlist
  const { data: existing, error: selectError } = await supabase
    .from("watchlist")
    .select("id")
    .eq("org_id", orgId)
    .eq("indicator_id", indicatorId)
    .maybeSingle();

  if (selectError) {
    return { success: false, error: "Failed to check organization watchlist status" };
  }

  if (existing) {
    // Currently in org watchlist: remove
    const { error: deleteError } = await supabase
      .from("watchlist")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      // Handle RLS policy violation (not authorized)
      if (deleteError.code === "42501") {
        return { success: false, error: "Not authorized to modify organization watchlist" };
      }
      return { success: false, error: "Failed to remove from organization watchlist" };
    }

    return { success: true, data: { isWatching: false } };
  } else {
    // Not in org watchlist: add
    const { error: insertError } = await supabase.from("watchlist").insert({
      user_id: user.id,
      indicator_id: indicatorId,
      org_id: orgId,
    });

    if (insertError) {
      // Handle foreign key violation (indicator or org doesn't exist)
      if (insertError.code === "23503") {
        return { success: false, error: "Indicator or organization not found" };
      }
      // Handle RLS policy violation (not authorized)
      if (insertError.code === "42501") {
        return { success: false, error: "Not authorized to modify organization watchlist" };
      }
      return { success: false, error: "Failed to add to organization watchlist" };
    }

    return { success: true, data: { isWatching: true } };
  }
}
