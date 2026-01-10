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
