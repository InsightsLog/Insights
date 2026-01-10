import { createSupabaseServerClient } from "./server";
import { createSupabaseServiceClient } from "./service-role";

/**
 * User profile returned by auth helper functions.
 * Based on the profiles table schema from T100.
 */
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Admin check result returned by isAdmin helper.
 */
export interface AdminCheckResult {
  isAdmin: boolean;
  userId: string | null;
  error?: string;
}

/**
 * Audit log action types.
 * Must match the CHECK constraint in audit_log table.
 */
export type AuditAction = "upload" | "role_change" | "delete";

/**
 * Gets the currently authenticated user's profile.
 * Returns null if no user is logged in.
 *
 * This helper:
 * 1. Gets the authenticated user from Supabase Auth
 * 2. Fetches their profile from the profiles table
 *
 * @returns UserProfile if logged in, null if logged out
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createSupabaseServerClient();

  // Get the authenticated user from Supabase Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // If no user or auth error, return null (not logged in)
  if (authError || !user) {
    return null;
  }

  // Fetch the user's profile from the profiles table
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, display_name, created_at, updated_at")
    .eq("id", user.id)
    .single();

  // If profile fetch fails or profile doesn't exist, return null
  if (profileError || !profile) {
    return null;
  }

  return profile as UserProfile;
}

/**
 * Checks if the currently authenticated user has admin role.
 * Uses the service role client to bypass RLS (user_roles table has admin-only RLS).
 *
 * This helper:
 * 1. Gets the authenticated user from Supabase Auth
 * 2. Checks their role in the user_roles table using service role client
 *
 * @returns AdminCheckResult with isAdmin status and userId
 */
export async function checkAdminRole(): Promise<AdminCheckResult> {
  const supabase = await createSupabaseServerClient();

  // Get the authenticated user from Supabase Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // If no user or auth error, return not admin
  if (authError || !user) {
    return { isAdmin: false, userId: null, error: "Not authenticated" };
  }

  // Use service role client to bypass RLS on user_roles table
  const serviceClient = createSupabaseServiceClient();

  // Check if user has admin role
  const { data: roleData, error: roleError } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  // Handle errors (including no row found)
  if (roleError) {
    // PGRST116 is "no rows returned" - user has no role entry
    if (roleError.code === "PGRST116") {
      return { isAdmin: false, userId: user.id };
    }
    return { isAdmin: false, userId: user.id, error: roleError.message };
  }

  return { isAdmin: roleData?.role === "admin", userId: user.id };
}

/**
 * Logs an admin action to the audit_log table.
 * Uses service role client because audit_log has no RLS (admin-only access).
 *
 * @param userId - The ID of the user performing the action
 * @param action - The action type (upload, role_change, delete)
 * @param resourceType - The type of resource affected (e.g., 'release', 'indicator', 'user_role')
 * @param resourceId - Optional ID of the specific resource affected
 * @param metadata - Optional additional metadata about the action
 * @returns true if logged successfully, false otherwise
 */
export async function logAuditAction(
  userId: string,
  action: AuditAction,
  resourceType: string,
  resourceId?: string | null,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const serviceClient = createSupabaseServiceClient();

  const { error } = await serviceClient.from("audit_log").insert({
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
    metadata: metadata ?? {},
  });

  if (error) {
    console.error("Failed to log audit action:", error);
    return false;
  }

  return true;
}
