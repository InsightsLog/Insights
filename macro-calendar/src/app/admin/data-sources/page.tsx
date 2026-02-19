import { redirect } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/supabase/auth";
import { getDataSources, getSyncLogs } from "@/app/actions/data-sources";
import type { Metadata } from "next";
import { ToggleDataSourceButton } from "./ToggleDataSourceButton";
import { ManualSyncButton } from "./ManualSyncButton";

export const metadata: Metadata = {
  title: "Data Sources - Admin",
  description: "Manage data acquisition sources and view sync logs",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Formats a date string to a human-readable format.
 */
function formatDateTime(isoString: string | null): string {
  if (!isoString) return "—";
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
 * Gets a status badge color class.
 */
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "success":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "partial":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "in_progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

/**
 * Gets a type badge color class.
 */
function getTypeBadgeClass(type: string): string {
  switch (type) {
    case "api":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "scraper":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

export default async function DataSourcesAdminPage() {
  // Check if user is admin
  const adminCheck = await checkAdminRole();

  // Redirect non-admins to home page
  if (!adminCheck.isAdmin || !adminCheck.userId) {
    redirect("/");
  }

  // Fetch data sources and sync logs
  const [dataSourcesResult, syncLogsResult] = await Promise.all([
    getDataSources(),
    getSyncLogs({ limit: 50 }),
  ]);

  // Handle errors
  if (!dataSourcesResult.success) {
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
              {dataSourcesResult.error}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!syncLogsResult.success) {
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
              {syncLogsResult.error}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const dataSources = dataSourcesResult.data;
  const syncLogs = syncLogsResult.data;

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
          <h1 className="mt-4 text-3xl font-bold text-zinc-100">
            Data Sources
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Manage data acquisition sources and monitor sync operations
          </p>
        </div>

        {/* Dashboard grid */}
        <div className="grid gap-6">
          {/* Data Sources Table */}
          <div className="rounded-lg border border-[#1e2530] bg-[#0b0e11]">
            <div className="border-b border-[#1e2530] px-4 py-3">
              <h2 className="text-lg font-semibold text-zinc-100">
                Data Sources
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#1e2530]">
                <thead className="bg-[#0f1419]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Last Sync
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2530]">
                  {dataSources.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-zinc-400"
                      >
                        No data sources configured
                      </td>
                    </tr>
                  ) : (
                    dataSources.map((source) => (
                      <tr
                        key={source.id}
                        className="hover:bg-[#0f1419]"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-100">
                          {source.name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getTypeBadgeClass(source.type)}`}
                          >
                            {source.type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <ToggleDataSourceButton
                            dataSourceId={source.id}
                            dataSourceName={source.name}
                            initialEnabled={source.enabled}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {formatDateTime(source.last_sync_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <ManualSyncButton
                            dataSourceId={source.id}
                            dataSourceName={source.name}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sync Logs Table */}
          <div className="rounded-lg border border-[#1e2530] bg-[#0b0e11]">
            <div className="border-b border-[#1e2530] px-4 py-3">
              <h2 className="text-lg font-semibold text-zinc-100">
                Sync Logs
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#1e2530]">
                <thead className="bg-[#0f1419]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Source
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Records
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2530]">
                  {syncLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-zinc-400"
                      >
                        No sync logs yet
                      </td>
                    </tr>
                  ) : (
                    syncLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-[#0f1419]"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {formatDateTime(log.started_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-100">
                          {log.data_source_name ?? "Unknown"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(log.status)}`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                          {log.records_processed.toLocaleString()}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-sm text-zinc-400">
                          {log.error_message ?? "—"}
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
