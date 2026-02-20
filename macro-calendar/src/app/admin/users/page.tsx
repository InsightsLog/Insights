import { redirect } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/supabase/auth";
import { getAdminUsers } from "@/app/actions/admin-users";
import { RoleManager } from "@/app/components/RoleManager";
import type { Metadata } from "next";
import { z } from "zod";

export const metadata: Metadata = {
  title: "Users - Admin",
  description: "Manage all users, roles, and subscriptions",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Formats a date string to a human-readable format.
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
 * Gets a subscription status badge color class.
 */
function getStatusBadgeClass(status: string | null): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "trialing":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "past_due":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "canceled":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

// Zod schema for URL search params
const searchParamsSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});

const USERS_PER_PAGE = 50;

type PageProps = {
  searchParams: Promise<{ search?: string; page?: string }>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  // Check if user is admin
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin || !adminCheck.userId) {
    redirect("/");
  }

  const currentAdminUserId = adminCheck.userId;

  // Parse and validate search params
  const rawParams = await searchParams;
  const parsedParams = searchParamsSchema.safeParse(rawParams);
  const search = parsedParams.success ? parsedParams.data.search : undefined;
  const page = parsedParams.success ? parsedParams.data.page : 1;

  // Fetch users
  const result = await getAdminUsers({
    search,
    page,
    limit: USERS_PER_PAGE,
  });

  if (!result.success) {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <main className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6">
            <Link
              href="/admin"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              ← Back to Admin Dashboard
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

  const { users, total, limit } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="min-h-screen bg-[#0b0e11]">
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to Admin Dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-100">Users</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Manage all users, roles, and subscription information
          </p>
        </div>

        {/* Search */}
        <div className="mb-4">
          <form method="GET" action="/admin/users">
            <div className="flex gap-2">
              <input
                type="text"
                name="search"
                defaultValue={search ?? ""}
                placeholder="Search by email…"
                className="w-64 rounded-md border border-[#1e2530] bg-[#0f1419] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Search
              </button>
              {search && (
                <Link
                  href="/admin/users"
                  className="rounded-md border border-[#1e2530] px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>
          <p className="mt-2 text-xs text-zinc-500">
            {total} user{total !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : " total"}
          </p>
        </div>

        {/* Users table */}
        <div className="rounded-lg border border-[#1e2530] bg-[#0b0e11]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#1e2530]">
              <thead className="bg-[#0f1419]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Subscription
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    API Keys
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2530]">
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-zinc-400"
                    >
                      {search ? `No users found matching "${search}"` : "No users found"}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-[#0f1419]">
                      <td className="px-4 py-3 text-sm text-zinc-100">
                        <span className="font-medium">{user.email}</span>
                        {user.display_name && (
                          <span className="ml-2 text-xs text-zinc-500">
                            ({user.display_name})
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                        {user.plan_name ?? (
                          <span className="text-zinc-600">Free</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {user.subscription_status ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(user.subscription_status)}`}
                          >
                            {user.subscription_status}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                        {user.api_key_count}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getRoleBadgeClass(user.role)}`}
                        >
                          {user.role ?? "user"}
                        </span>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#1e2530] px-4 py-3">
              <p className="text-xs text-zinc-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/users?${new URLSearchParams({ ...(search ? { search } : {}), page: String(page - 1) }).toString()}`}
                    className="rounded-md border border-[#1e2530] px-3 py-1 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  >
                    ← Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/users?${new URLSearchParams({ ...(search ? { search } : {}), page: String(page + 1) }).toString()}`}
                    className="rounded-md border border-[#1e2530] px-3 py-1 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
