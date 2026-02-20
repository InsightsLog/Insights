import { redirect } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/supabase/auth";
import { getAnalyticsData } from "@/app/actions/analytics";
import { AnalyticsCharts } from "./AnalyticsCharts";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics - Admin",
  description: "Admin analytics dashboard showing key product metrics",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Analytics dashboard page.
 * Admin-only server component showing key product metrics.
 */
export default async function AnalyticsDashboardPage() {
  // Check if user is admin
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin || !adminCheck.userId) {
    redirect("/");
  }

  const result = await getAnalyticsData();

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
          <div className="rounded-lg border border-red-900/50 bg-red-900/20 px-4 py-3">
            <p className="text-sm font-medium text-red-400">{result.error}</p>
          </div>
        </main>
      </div>
    );
  }

  const {
    totalUsers,
    activeSubscriptions,
    apiCallsLast30d,
    webhooksDelivered,
    dailySignups,
    dailyApiCalls,
    topWatchedIndicators,
  } = result.data;

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
          <h1 className="mt-4 text-3xl font-bold text-zinc-100">Analytics</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Key product metrics and usage trends
          </p>
        </div>

        {/* Metric Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Users"
            value={totalUsers.toLocaleString()}
          />
          <MetricCard
            label="Active Subscriptions"
            value={activeSubscriptions.toLocaleString()}
          />
          <MetricCard
            label="API Calls (Last 30d)"
            value={apiCallsLast30d.toLocaleString()}
          />
          <MetricCard
            label="Webhooks Delivered"
            value={webhooksDelivered.toLocaleString()}
          />
        </div>

        {/* Charts */}
        <div className="mb-6">
          <AnalyticsCharts
            dailySignups={dailySignups}
            dailyApiCalls={dailyApiCalls}
          />
        </div>

        {/* Top Watched Indicators Table */}
        <div className="rounded-lg border border-[#1e2530] bg-[#0b0e11]">
          <div className="border-b border-[#1e2530] px-4 py-3">
            <h2 className="text-lg font-semibold text-zinc-100">
              Top 10 Most-Watched Indicators
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#1e2530]">
              <thead className="bg-[#0f1419]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Indicator
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Watchers
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2530]">
                {topWatchedIndicators.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-sm text-zinc-400"
                    >
                      No watchlist data yet
                    </td>
                  </tr>
                ) : (
                  topWatchedIndicators.map((indicator, index) => (
                    <tr key={indicator.indicator_id} className="hover:bg-[#0f1419]">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-400">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-100">
                        {indicator.indicator_name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                        {indicator.watch_count.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * A metric summary card.
 */
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1e2530] bg-[#0b0e11] px-4 py-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-zinc-100">{value}</p>
    </div>
  );
}
