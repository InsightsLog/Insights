"use server";

import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { checkAdminRole } from "@/lib/supabase/auth";
import { z } from "zod";

/**
 * Result type for admin user actions.
 */
export type AdminUserActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * User record with plan, subscription, and API key info for admin view.
 */
export type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  role: "admin" | "user" | null;
  plan_name: string | null;
  subscription_status: string | null;
  api_key_count: number;
};

/**
 * Paginated admin users result.
 */
export type AdminUsersPage = {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
};

const ADMIN_USERS_PER_PAGE = 50;

// Zod schema for getAdminUsers input
const getAdminUsersInputSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(ADMIN_USERS_PER_PAGE),
});

// Zod schema for profile data
const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  display_name: z.string().nullable(),
  created_at: z.string(),
});

/**
 * Get paginated list of users with plan, subscription status, API key count, and role.
 * Supports optional email search filter.
 * Requires admin role.
 *
 * @param options.search - Optional email substring to filter by
 * @param options.page   - Page number (1-based, default: 1)
 * @param options.limit  - Results per page (default: 50, max: 100)
 */
export async function getAdminUsers(options?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<AdminUserActionResult<AdminUsersPage>> {
  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  // Validate input
  const parseResult = getAdminUsersInputSchema.safeParse(options ?? {});
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return { success: false, error: firstError?.message ?? "Invalid input" };
  }

  const { search, page, limit } = parseResult.data;
  const offset = (page - 1) * limit;

  const supabase = createSupabaseServiceClient();

  // Build profiles query with optional email search and pagination
  let profilesQuery = supabase
    .from("profiles")
    .select("id, email, display_name, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    profilesQuery = profilesQuery.ilike("email", `%${search}%`);
  }

  const {
    data: profilesData,
    error: profilesError,
    count,
  } = await profilesQuery;

  if (profilesError) {
    console.error("Failed to fetch profiles:", profilesError);
    return { success: false, error: "Failed to fetch users" };
  }

  const profiles = profilesData ?? [];
  const total = count ?? 0;

  if (profiles.length === 0) {
    return { success: true, data: { users: [], total, page, limit } };
  }

  const userIds = profiles.map((p) => p.id);

  // Fetch roles, subscriptions, and API keys in parallel
  const [rolesResult, subscriptionsResult, apiKeysResult] = await Promise.all([
    supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds),
    supabase
      .from("subscriptions")
      .select("user_id, status, created_at, plans(name)")
      .in("user_id", userIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("api_keys")
      .select("user_id")
      .in("user_id", userIds)
      .is("revoked_at", null),
  ]);

  // Build roles map
  const rolesMap = new Map<string, "admin" | "user">();
  for (const entry of rolesResult.data ?? []) {
    if (entry.role === "admin" || entry.role === "user") {
      rolesMap.set(entry.user_id, entry.role);
    }
  }

  // Build subscriptions map — prefer active/trialing, otherwise most recent
  type SubEntry = {
    user_id: string;
    status: string;
    plan_name: string | null;
  };
  const subscriptionsMap = new Map<string, SubEntry>();
  for (const sub of subscriptionsResult.data ?? []) {
    const planName =
      sub.plans && typeof sub.plans === "object" && "name" in sub.plans
        ? (sub.plans as { name: string }).name
        : null;
    const existing = subscriptionsMap.get(sub.user_id);
    // Prioritise active/trialing over other statuses; first row wins for same status
    if (!existing) {
      subscriptionsMap.set(sub.user_id, {
        user_id: sub.user_id,
        status: sub.status,
        plan_name: planName,
      });
    } else if (
      (sub.status === "active" || sub.status === "trialing") &&
      existing.status !== "active" &&
      existing.status !== "trialing"
    ) {
      subscriptionsMap.set(sub.user_id, {
        user_id: sub.user_id,
        status: sub.status,
        plan_name: planName,
      });
    }
  }

  // Build API key count map
  const apiKeyCountMap = new Map<string, number>();
  for (const key of apiKeysResult.data ?? []) {
    apiKeyCountMap.set(key.user_id, (apiKeyCountMap.get(key.user_id) ?? 0) + 1);
  }

  // Combine data, validating profile fields
  const users: AdminUser[] = [];
  for (const profile of profiles) {
    try {
      const validated = profileSchema.parse(profile);
      const sub = subscriptionsMap.get(validated.id);
      users.push({
        id: validated.id,
        email: validated.email,
        display_name: validated.display_name,
        created_at: validated.created_at,
        role: rolesMap.get(validated.id) ?? null,
        plan_name: sub?.plan_name ?? null,
        subscription_status: sub?.status ?? null,
        api_key_count: apiKeyCountMap.get(validated.id) ?? 0,
      });
    } catch {
      // Skip profiles that fail validation
    }
  }

  return { success: true, data: { users, total, page, limit } };
}
