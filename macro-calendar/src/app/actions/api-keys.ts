"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";

// Schema for validating API key name
const apiKeyNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be 100 characters or less")
  .regex(
    /^[a-zA-Z0-9\s\-_]+$/,
    "Name can only contain letters, numbers, spaces, hyphens, and underscores"
  );

// Schema for validating API key ID
const apiKeyIdSchema = z.string().uuid("Invalid API key ID");

// Default API key limits per plan name (used when no subscription exists)
const DEFAULT_API_KEY_LIMITS: Record<string, number> = {
  Free: 1,
  Plus: 3,
  Pro: 10,
  Enterprise: 50,
};

// Default limit for users with no subscription (free tier)
const FREE_TIER_API_KEY_LIMIT = 1;

/**
 * API key record from the database (without the actual key).
 */
export type ApiKey = {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  /** Key prefix for identification (e.g., "mc_abc1...") */
  key_prefix: string;
};

/**
 * Result type for API key actions.
 * Success returns data, failure returns error message.
 */
export type ApiKeyActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Generate a cryptographically secure API key.
 * Format: mc_{32 random hex characters} (40 chars total)
 */
function generateApiKey(): string {
  const randomPart = randomBytes(16).toString("hex");
  return `mc_${randomPart}`;
}

/**
 * Hash an API key using SHA-256.
 * This is what we store in the database.
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Get all API keys for the current user.
 * Does not return the actual key value (only stored as hash).
 *
 * @returns List of API keys or error
 */
export async function getApiKeys(): Promise<ApiKeyActionResult<ApiKey[]>> {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch API keys for the user (RLS ensures only user's keys are returned)
  const { data, error: selectError } = await supabase
    .from("api_keys")
    .select("id, name, created_at, last_used_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (selectError) {
    return { success: false, error: "Failed to fetch API keys" };
  }

  // Transform data to include key_prefix for display
  // Note: We only store the hash, so the original key prefix cannot be recovered
  // All keys use the same format (mc_) so we show a masked placeholder
  const keys: ApiKey[] = (data ?? []).map((key) => ({
    id: key.id,
    name: key.name,
    created_at: key.created_at,
    last_used_at: key.last_used_at,
    revoked_at: key.revoked_at,
    key_prefix: "mc_****",
  }));

  return { success: true, data: keys };
}

/**
 * Create a new API key for the current user.
 * Returns the plain key ONLY ONCE - it cannot be retrieved later.
 * Enforces plan-based limits on the number of active keys.
 *
 * @param name - A user-friendly name for the key
 * @returns The created API key (including plain key shown only once)
 */
export async function createApiKey(
  name: string
): Promise<
  ApiKeyActionResult<{
    id: string;
    name: string;
    created_at: string;
    /** The plain API key - ONLY returned once at creation time */
    key: string;
  }>
> {
  // Validate name
  const parseResult = apiKeyNameSchema.safeParse(name);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return {
      success: false,
      error: firstError?.message ?? "Invalid name",
    };
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

  // Determine the user's API key limit from their subscription plan
  let apiKeyLimit = FREE_TIER_API_KEY_LIMIT;
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plans (name, api_keys_limit)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (subscription?.plans) {
    const plan = subscription.plans as unknown as { name: string; api_keys_limit: number };
    apiKeyLimit =
      plan.api_keys_limit ?? DEFAULT_API_KEY_LIMITS[plan.name] ?? FREE_TIER_API_KEY_LIMIT;
  }

  // Count existing active (non-revoked) keys for the user
  const { count: activeKeyCount, error: countError } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (countError) {
    return { success: false, error: "Failed to check API key limit" };
  }

  if ((activeKeyCount ?? 0) >= apiKeyLimit) {
    return {
      success: false,
      error: `API key limit reached. Your plan allows ${apiKeyLimit} active key${apiKeyLimit === 1 ? "" : "s"}. Revoke an existing key or upgrade your plan.`,
    };
  }

  // Generate secure API key
  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey);

  // Insert API key into database
  const { data, error: insertError } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      key_hash: keyHash,
      name: parseResult.data,
    })
    .select("id, name, created_at")
    .single();

  if (insertError) {
    // Handle unique constraint violation (extremely rare with random keys)
    if (insertError.code === "23505") {
      return { success: false, error: "Failed to create API key. Please try again." };
    }
    return { success: false, error: "Failed to create API key" };
  }

  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      created_at: data.created_at,
      key: plainKey,
    },
  };
}

/**
 * Revoke an API key.
 * The key will no longer be usable for API authentication.
 *
 * @param keyId - The ID of the API key to revoke
 * @returns Success/failure result
 */
export async function revokeApiKey(
  keyId: string
): Promise<ApiKeyActionResult<{ revoked_at: string }>> {
  // Validate key ID
  const parseResult = apiKeyIdSchema.safeParse(keyId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid API key ID" };
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

  // Check if key exists and belongs to user (RLS will enforce this)
  const { data: existing, error: selectError } = await supabase
    .from("api_keys")
    .select("id, revoked_at")
    .eq("id", keyId)
    .eq("user_id", user.id)
    .single();

  if (selectError || !existing) {
    // PGRST116 is "no rows returned"
    if (selectError?.code === "PGRST116") {
      return { success: false, error: "API key not found" };
    }
    return { success: false, error: "Failed to find API key" };
  }

  // Check if already revoked
  if (existing.revoked_at) {
    return { success: false, error: "API key is already revoked" };
  }

  // Revoke the key by setting revoked_at timestamp
  const { data: updated, error: updateError } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .select("revoked_at")
    .single();

  if (updateError) {
    return { success: false, error: "Failed to revoke API key" };
  }

  return {
    success: true,
    data: { revoked_at: updated.revoked_at },
  };
}

/**
 * Delete an API key permanently.
 * This is a hard delete - use revokeApiKey for soft delete.
 *
 * @param keyId - The ID of the API key to delete
 * @returns Success/failure result
 */
export async function deleteApiKey(
  keyId: string
): Promise<ApiKeyActionResult<void>> {
  // Validate key ID
  const parseResult = apiKeyIdSchema.safeParse(keyId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid API key ID" };
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

  // Delete the key (RLS ensures user can only delete their own)
  const { error: deleteError } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .eq("user_id", user.id);

  if (deleteError) {
    return { success: false, error: "Failed to delete API key" };
  }

  return { success: true, data: undefined };
}

/**
 * Validate an API key for authentication.
 * This is used internally by the API to authenticate requests.
 *
 * @param key - The plain API key to validate
 * @returns User ID if valid, null if invalid or revoked
 */
export async function validateApiKey(key: string): Promise<string | null> {
  // Basic format validation
  if (!key || typeof key !== "string" || !key.startsWith("mc_")) {
    return null;
  }

  const keyHash = hashApiKey(key);
  const supabase = await createSupabaseServerClient();

  // Look up key by hash, ensure not revoked
  const { data, error } = await supabase
    .from("api_keys")
    .select("user_id, revoked_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data) {
    return null;
  }

  // Check if revoked
  if (data.revoked_at) {
    return null;
  }

  // Update last_used_at timestamp (non-blocking, don't wait for result)
  // Wrap in void Promise.resolve to handle both Promise and PromiseLike
  void Promise.resolve(
    supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash)
  ).catch(() => {
    // Intentionally ignored - fire and forget
  });

  return data.user_id;
}
