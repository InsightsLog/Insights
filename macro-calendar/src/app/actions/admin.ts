"use server";

import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { checkAdminRole } from "@/lib/supabase/auth";
import { z } from "zod";

/**
 * Result type for admin actions.
 * Success returns data, failure returns error message.
 */
export type AdminActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Audit log entry from the database.
 */
export type AuditLogEntry = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: "upload" | "role_change" | "delete";
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/**
 * User with role information for user management.
 */
export type UserWithRole = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  role: "admin" | "user" | null;
  role_granted_at: string | null;
};

/**
 * Admin dashboard summary data.
 */
export type AdminDashboardData = {
  recentUploads: AuditLogEntry[];
  recentAuditLog: AuditLogEntry[];
  users: UserWithRole[];
};

// Zod schema for validating audit log entries from the database
const auditLogEntrySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  action: z.enum(["upload", "role_change", "delete"]),
  resource_type: z.string(),
  resource_id: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});

// Zod schema for profile data
const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  display_name: z.string().nullable(),
  created_at: z.string(),
});

// Zod schema for user role data
const userRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "user"]),
  granted_at: z.string(),
});

/**
 * Get recent upload entries from the audit log.
 * Requires admin role.
 *
 * @param limit - Maximum number of entries to return (default: 10)
 * @returns List of recent upload audit entries or error
 */
export async function getRecentUploads(
  limit: number = 10
): Promise<AdminActionResult<AuditLogEntry[]>> {
  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  // Use service role client to access audit_log (no RLS)
  const supabase = createSupabaseServiceClient();

  // Fetch recent uploads with user email
  const { data: auditData, error: auditError } = await supabase
    .from("audit_log")
    .select("id, user_id, action, resource_type, resource_id, metadata, created_at")
    .eq("action", "upload")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (auditError) {
    console.error("Failed to fetch recent uploads:", auditError);
    return { success: false, error: "Failed to fetch recent uploads" };
  }

  // Get user emails for the entries
  const userIds = [...new Set((auditData ?? []).map((entry) => entry.user_id).filter(Boolean))];
  const userEmailMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    for (const profile of profiles ?? []) {
      userEmailMap.set(profile.id, profile.email);
    }
  }

  // Validate and transform data
  try {
    const entries: AuditLogEntry[] = (auditData ?? []).map((entry) => {
      const validated = auditLogEntrySchema.parse(entry);
      return {
        ...validated,
        user_email: validated.user_id ? (userEmailMap.get(validated.user_id) ?? null) : null,
      };
    });
    return { success: true, data: entries };
  } catch (zodError) {
    console.error("Audit log data validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Get recent audit log entries (all actions).
 * Requires admin role.
 *
 * @param limit - Maximum number of entries to return (default: 20)
 * @returns List of recent audit entries or error
 */
export async function getRecentAuditLog(
  limit: number = 20
): Promise<AdminActionResult<AuditLogEntry[]>> {
  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  // Use service role client to access audit_log (no RLS)
  const supabase = createSupabaseServiceClient();

  // Fetch recent audit log entries
  const { data: auditData, error: auditError } = await supabase
    .from("audit_log")
    .select("id, user_id, action, resource_type, resource_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (auditError) {
    console.error("Failed to fetch audit log:", auditError);
    return { success: false, error: "Failed to fetch audit log" };
  }

  // Get user emails for the entries
  const userIds2 = [...new Set((auditData ?? []).map((entry) => entry.user_id).filter(Boolean))];
  const userEmailMap2 = new Map<string, string>();

  if (userIds2.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds2);

    for (const profile of profiles ?? []) {
      userEmailMap2.set(profile.id, profile.email);
    }
  }

  // Validate and transform data
  try {
    const entries: AuditLogEntry[] = (auditData ?? []).map((entry) => {
      const validated = auditLogEntrySchema.parse(entry);
      return {
        ...validated,
        user_email: validated.user_id ? (userEmailMap2.get(validated.user_id) ?? null) : null,
      };
    });
    return { success: true, data: entries };
  } catch (zodError) {
    console.error("Audit log data validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Get list of users with their roles.
 * Requires admin role.
 *
 * @param limit - Maximum number of users to return (default: 50)
 * @returns List of users with role information or error
 */
export async function getUsers(
  limit: number = 50
): Promise<AdminActionResult<UserWithRole[]>> {
  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  // Use service role client to bypass RLS
  const supabase = createSupabaseServiceClient();

  // Fetch profiles
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, display_name, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (profilesError) {
    console.error("Failed to fetch profiles:", profilesError);
    return { success: false, error: "Failed to fetch users" };
  }

  // Fetch user roles
  const userIds = (profiles ?? []).map((p) => p.id);
  const rolesMap = new Map<string, { role: "admin" | "user"; granted_at: string }>();

  if (userIds.length > 0) {
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role, granted_at")
      .in("user_id", userIds);

    if (rolesError) {
      console.error("Failed to fetch user roles:", rolesError);
      // Continue without roles rather than failing completely
    } else {
      for (const role of roles ?? []) {
        try {
          const validated = userRoleSchema.parse(role);
          rolesMap.set(validated.user_id, {
            role: validated.role,
            granted_at: validated.granted_at,
          });
        } catch {
          // Skip invalid role entries
        }
      }
    }
  }

  // Combine profiles with roles
  try {
    const users: UserWithRole[] = (profiles ?? []).map((profile) => {
      const validated = profileSchema.parse(profile);
      const roleInfo = rolesMap.get(validated.id);
      return {
        id: validated.id,
        email: validated.email,
        display_name: validated.display_name,
        created_at: validated.created_at,
        role: roleInfo?.role ?? null,
        role_granted_at: roleInfo?.granted_at ?? null,
      };
    });
    return { success: true, data: users };
  } catch (zodError) {
    console.error("Profile data validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Get all admin dashboard data in a single call.
 * Requires admin role.
 *
 * @returns Dashboard data including recent uploads, audit log, and users
 */
export async function getAdminDashboardData(): Promise<
  AdminActionResult<AdminDashboardData>
> {
  // Check admin role once at the start
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  // Fetch all data in parallel
  const [uploadsResult, auditLogResult, usersResult] = await Promise.all([
    getRecentUploads(10),
    getRecentAuditLog(20),
    getUsers(50),
  ]);

  // If any fetch failed, return the first error
  if (!uploadsResult.success) {
    return { success: false, error: uploadsResult.error };
  }
  if (!auditLogResult.success) {
    return { success: false, error: auditLogResult.error };
  }
  if (!usersResult.success) {
    return { success: false, error: usersResult.error };
  }

  return {
    success: true,
    data: {
      recentUploads: uploadsResult.data,
      recentAuditLog: auditLogResult.data,
      users: usersResult.data,
    },
  };
}

// Zod schema for updateUserRole input validation
const updateUserRoleInputSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  role: z.enum(["admin", "user"]),
});

/**
 * Update a user's role.
 * Requires admin role.
 * Logs the change to audit_log.
 *
 * @param userId - The ID of the user to update
 * @param role - The new role ('admin' or 'user')
 * @returns Updated user role information or error
 */
export async function updateUserRole(
  userId: string,
  role: "admin" | "user"
): Promise<AdminActionResult<{ userId: string; role: "admin" | "user" }>> {
  // Validate input
  const parseResult = updateUserRoleInputSchema.safeParse({ userId, role });
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return {
      success: false,
      error: firstError?.message ?? "Invalid input",
    };
  }

  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin || !adminCheck.userId) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  // Prevent admins from demoting themselves
  if (userId === adminCheck.userId && role === "user") {
    return { success: false, error: "Cannot demote your own admin role" };
  }

  // Use service role client to bypass RLS
  const supabase = createSupabaseServiceClient();

  // Check if the target user exists
  const { data: targetUser, error: userError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", userId)
    .single();

  if (userError || !targetUser) {
    return { success: false, error: "User not found" };
  }

  // Get current role for audit log metadata
  const { data: currentRoleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  const previousRole = currentRoleData?.role ?? null;

  if (role === "admin") {
    // Grant admin role: upsert into user_roles
    // Note: granted_at uses database default NOW() for consistent timezone handling
    const { error: upsertError } = await supabase.from("user_roles").upsert(
      {
        user_id: userId,
        role: "admin",
        granted_by: adminCheck.userId,
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      console.error("Failed to grant admin role:", upsertError);
      return { success: false, error: "Failed to update user role" };
    }
  } else {
    // Revoke admin role: delete from user_roles (users without entry are regular users)
    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Failed to revoke admin role:", deleteError);
      return { success: false, error: "Failed to update user role" };
    }
  }

  // Log the role change to audit_log
  const { error: auditError } = await supabase.from("audit_log").insert({
    user_id: adminCheck.userId,
    action: "role_change",
    resource_type: "user_role",
    resource_id: userId,
    metadata: {
      target_user_email: targetUser.email,
      previous_role: previousRole,
      new_role: role,
    },
  });

  if (auditError) {
    // Log the error but don't fail the operation - role change succeeded
    console.error("Failed to log role change to audit_log:", auditError);
  }

  return {
    success: true,
    data: { userId, role },
  };
}

/**
 * Result of clearing historical data.
 */
export type ClearDataResult = {
  deletedReleases: number;
  deletedIndicators: number;
};

// Zod schema for clearHistoricalData input validation
const clearHistoricalDataInputSchema = z.object({
  clearSeedData: z.boolean().default(true),
  clearFredData: z.boolean().default(false),
  clearAllData: z.boolean().default(false),
});

/**
 * Clear historical/seed data from the database.
 * Requires admin role.
 * Logs the action to audit_log.
 *
 * Options:
 * - clearSeedData: Delete test seed data (default indicators with known UUIDs)
 * - clearFredData: Delete FRED imported data (indicators with FRED source)
 * - clearAllData: Delete all indicators and releases (dangerous!)
 *
 * @param options - Options for what data to clear
 * @returns Count of deleted releases and indicators
 */
export async function clearHistoricalData(
  options: {
    clearSeedData?: boolean;
    clearFredData?: boolean;
    clearAllData?: boolean;
  } = { clearSeedData: true }
): Promise<AdminActionResult<ClearDataResult>> {
  // Validate input
  const parseResult = clearHistoricalDataInputSchema.safeParse(options);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return {
      success: false,
      error: firstError?.message ?? "Invalid input",
    };
  }

  const { clearSeedData, clearFredData, clearAllData } = parseResult.data;

  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin || !adminCheck.userId) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  // Use service role client to bypass RLS
  const supabase = createSupabaseServiceClient();

  let deletedReleases = 0;
  let deletedIndicators = 0;

  try {
    if (clearAllData) {
      // Delete all releases first (due to foreign key)
      // Using gte with empty string to match all rows (Supabase requires a filter for delete)
      const { data: releaseData, error: releaseError } = await supabase
        .from("releases")
        .delete()
        .gte("id", "00000000-0000-0000-0000-000000000000") // Match all UUIDs
        .select("id");

      if (releaseError) {
        throw new Error(`Failed to delete releases: ${releaseError.message}`);
      }
      deletedReleases = releaseData?.length ?? 0;

      // Delete all indicators
      const { data: indicatorData, error: indicatorError } = await supabase
        .from("indicators")
        .delete()
        .gte("id", "00000000-0000-0000-0000-000000000000") // Match all UUIDs
        .select("id");

      if (indicatorError) {
        throw new Error(`Failed to delete indicators: ${indicatorError.message}`);
      }
      deletedIndicators = indicatorData?.length ?? 0;
    } else {
      // Known seed data indicator UUIDs from 001_test_seed.sql
      const seedIndicatorIds = [
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440001",
        "550e8400-e29b-41d4-a716-446655440002",
      ];

      if (clearSeedData) {
        // Delete releases for seed indicators
        const { data: seedReleases, error: seedRelError } = await supabase
          .from("releases")
          .delete()
          .in("indicator_id", seedIndicatorIds)
          .select("id");

        if (seedRelError) {
          throw new Error(`Failed to delete seed releases: ${seedRelError.message}`);
        }
        deletedReleases += seedReleases?.length ?? 0;

        // Delete seed indicators
        const { data: seedIndicators, error: seedIndError } = await supabase
          .from("indicators")
          .delete()
          .in("id", seedIndicatorIds)
          .select("id");

        if (seedIndError) {
          throw new Error(`Failed to delete seed indicators: ${seedIndError.message}`);
        }
        deletedIndicators += seedIndicators?.length ?? 0;
      }

      if (clearFredData) {
        // Find indicators imported from FRED
        const { data: fredIndicators, error: fredFetchError } = await supabase
          .from("indicators")
          .select("id")
          .ilike("source_name", "%FRED%");

        if (fredFetchError) {
          throw new Error(`Failed to fetch FRED indicators: ${fredFetchError.message}`);
        }

        const fredIndicatorIds = fredIndicators?.map((i) => i.id) ?? [];

        if (fredIndicatorIds.length > 0) {
          // Delete releases for FRED indicators
          const { data: fredReleases, error: fredRelError } = await supabase
            .from("releases")
            .delete()
            .in("indicator_id", fredIndicatorIds)
            .select("id");

          if (fredRelError) {
            throw new Error(`Failed to delete FRED releases: ${fredRelError.message}`);
          }
          deletedReleases += fredReleases?.length ?? 0;

          // Delete FRED indicators
          const { data: deletedFredInd, error: fredIndError } = await supabase
            .from("indicators")
            .delete()
            .in("id", fredIndicatorIds)
            .select("id");

          if (fredIndError) {
            throw new Error(`Failed to delete FRED indicators: ${fredIndError.message}`);
          }
          deletedIndicators += deletedFredInd?.length ?? 0;
        }
      }
    }

    // Log the action to audit_log
    const { error: auditError } = await supabase.from("audit_log").insert({
      user_id: adminCheck.userId,
      action: "delete",
      resource_type: "historical_data",
      resource_id: null,
      metadata: {
        clearSeedData,
        clearFredData,
        clearAllData,
        deletedReleases,
        deletedIndicators,
      },
    });

    if (auditError) {
      console.error("Failed to log data clear to audit_log:", auditError);
    }

    return {
      success: true,
      data: { deletedReleases, deletedIndicators },
    };
  } catch (error) {
    console.error("Failed to clear historical data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear data",
    };
  }
}
