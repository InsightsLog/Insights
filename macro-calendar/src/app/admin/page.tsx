import { redirect } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/supabase/auth";
import { getAdminDashboardData } from "@/app/actions/admin";
import { RoleManager } from "@/app/components/RoleManager";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Admin dashboard for managing Macro Calendar",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Formats a date string to a human-readable format.
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Gets a display-friendly action name.
 */
function getActionDisplay(action: string): string {
  switch (action) {
    case "upload":
      return "Upload";
    case "role_change":
      return "Role Change";
    case "delete":
      return "Delete";
    default:
      return action;
  }
}

/**
 * Gets a role badge color class.
 */
function getRoleBadgeClass(role: string | null): string {
  switch (role) {
    case "admin":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "user":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

/**
 * Gets an action badge color class.
 */
function getActionBadgeClass(action: string): string {
  switch (action) {
    case "upload":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "role_change":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "delete":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

export default async function AdminDashboardPage() {
  // Check if user is admin
  const adminCheck = await checkAdminRole();

  // Redirect non-admins to home page
  if (!adminCheck.isAdmin || !adminCheck.userId) {
    redirect("/");
  }

  // Store the current admin's user ID for the RoleManager
  const currentAdminUserId = adminCheck.userId;

  // Fetch dashboard data
  const result = await getAdminDashboardData();

  // Handle errors
  if (!result.success) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <main className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6">
            <Link
              href="/"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              ← Back to Calendar
            </Link>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              {result.error}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const { recentUploads, recentAuditLog, users } = result.data;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to Calendar
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage users, view audit logs, and monitor uploads
          </p>
        </div>

        {/* Quick links */}
        <div className="mb-6 flex gap-4">
          <Link
            href="/admin/upload"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Upload CSV
          </Link>
          <Link
            href="/admin/data-sources"
            className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Data Sources
          </Link>
          <Link
            href="/admin/users"
            className="inline-flex items-center rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
          >
            Manage Users
          </Link>
        </div>

        {/* Dashboard grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Uploads */}
          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Recent Uploads
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {recentUploads.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                      >
                        No uploads yet
                      </td>
                    </tr>
                  ) : (
                    recentUploads.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDateTime(entry.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                          {entry.user_email ?? "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {typeof entry.metadata.filename === "string" && (
                            <span className="font-medium">
                              {entry.metadata.filename}
                            </span>
                          )}
                          {typeof entry.metadata.rowCount === "number" && (
                            <span className="ml-2 text-zinc-500">
                              ({entry.metadata.rowCount} rows)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Management */}
          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Users
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Joined
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                      >
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                          {user.email}
                          {user.display_name && (
                            <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                              ({user.display_name})
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getRoleBadgeClass(user.role)}`}
                          >
                            {user.role ?? "user"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDateTime(user.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <RoleManager
                            userId={user.id}
                            userEmail={user.email}
                            initialRole={user.role}
                            currentAdminUserId={currentAdminUserId}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Log - Full width */}
          <div className="rounded-lg border border-zinc-200 bg-white lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Audit Log
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {recentAuditLog.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                      >
                        No audit log entries yet
                      </td>
                    </tr>
                  ) : (
                    recentAuditLog.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDateTime(entry.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                          {entry.user_email ?? "System"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getActionBadgeClass(entry.action)}`}
                          >
                            {getActionDisplay(entry.action)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {entry.resource_type}
                          {entry.resource_id && (
                            <span className="ml-1 text-zinc-400">
                              ({entry.resource_id.slice(0, 8)}...)
                            </span>
                          )}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {Object.keys(entry.metadata).length > 0
                            ? JSON.stringify(entry.metadata).slice(0, 50) +
                              (JSON.stringify(entry.metadata).length > 50 ? "..." : "")
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
