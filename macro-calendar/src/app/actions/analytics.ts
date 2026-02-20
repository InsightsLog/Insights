"use server";

import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { checkAdminRole } from "@/lib/supabase/auth";

/**
 * Result type for analytics actions.
 */
export type AnalyticsActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * A data point for time-series charts.
 */
export type DailyDataPoint = {
  date: string;
  count: number;
};

/**
 * A row in the most-watched indicators table.
 */
export type WatchedIndicator = {
  indicator_id: string;
  indicator_name: string;
  watch_count: number;
};

/**
 * All analytics data for the dashboard.
 */
export type AnalyticsDashboardData = {
  totalUsers: number;
  activeSubscriptions: number;
  apiCallsLast30d: number;
  webhooksDelivered: number;
  dailySignups: DailyDataPoint[];
  dailyApiCalls: DailyDataPoint[];
  topWatchedIndicators: WatchedIndicator[];
};

/**
 * Fetch all analytics data needed for the admin analytics dashboard.
 * Requires admin role. Uses service-role client to access protected tables.
 */
export async function getAnalyticsData(): Promise<
  AnalyticsActionResult<AnalyticsDashboardData>
> {
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const supabase = createSupabaseServiceClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

  try {
    // Run all queries in parallel for performance
    const [
      totalUsersResult,
      activeSubsResult,
      apiCallsResult,
      webhooksResult,
      dailySignupsResult,
      dailyApiCallsResult,
      topWatchedResult,
    ] = await Promise.all([
      // Total users
      supabase.from("profiles").select("id", { count: "exact", head: true }),

      // Active subscriptions
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),

      // API calls in last 30 days
      supabase
        .from("request_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgoIso),

      // Total webhooks delivered
      supabase
        .from("webhook_deliveries")
        .select("id", { count: "exact", head: true }),

      // Daily signups over last 30 days (raw SQL via rpc not available, fetch rows and group)
      supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", thirtyDaysAgoIso)
        .order("created_at", { ascending: true }),

      // API calls per day over last 30 days
      supabase
        .from("request_logs")
        .select("created_at")
        .gte("created_at", thirtyDaysAgoIso)
        .order("created_at", { ascending: true }),

      // Top 10 most-watched indicators.
      // PostgREST doesn't support GROUP BY directly, so we fetch all rows and
      // aggregate in JS. For production scale, consider an RPC/DB view instead.
      supabase
        .from("watchlist")
        .select("indicator_id, indicators!inner(name)")
        .limit(5000),
    ]);

    // Check for errors
    if (totalUsersResult.error) {
      console.error("Failed to count users:", totalUsersResult.error);
      return { success: false, error: "Failed to fetch analytics data" };
    }
    if (activeSubsResult.error) {
      console.error("Failed to count subscriptions:", activeSubsResult.error);
      return { success: false, error: "Failed to fetch analytics data" };
    }
    if (apiCallsResult.error) {
      console.error("Failed to count API calls:", apiCallsResult.error);
      return { success: false, error: "Failed to fetch analytics data" };
    }
    if (webhooksResult.error) {
      console.error("Failed to count webhooks:", webhooksResult.error);
      return { success: false, error: "Failed to fetch analytics data" };
    }
    if (dailySignupsResult.error) {
      console.error("Failed to fetch daily signups:", dailySignupsResult.error);
      return { success: false, error: "Failed to fetch analytics data" };
    }
    if (dailyApiCallsResult.error) {
      console.error(
        "Failed to fetch daily API calls:",
        dailyApiCallsResult.error
      );
      return { success: false, error: "Failed to fetch analytics data" };
    }
    if (topWatchedResult.error) {
      console.error(
        "Failed to fetch top watched indicators:",
        topWatchedResult.error
      );
      return { success: false, error: "Failed to fetch analytics data" };
    }

    // Group profiles by day for daily signups
    const signupsByDay = new Map<string, number>();
    for (const row of dailySignupsResult.data ?? []) {
      const day = row.created_at.slice(0, 10);
      signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
    }
    const dailySignups = buildDailySeries(signupsByDay, thirtyDaysAgo);

    // Group request_logs by day for daily API calls
    const apiCallsByDay = new Map<string, number>();
    for (const row of dailyApiCallsResult.data ?? []) {
      const day = row.created_at.slice(0, 10);
      apiCallsByDay.set(day, (apiCallsByDay.get(day) ?? 0) + 1);
    }
    const dailyApiCalls = buildDailySeries(apiCallsByDay, thirtyDaysAgo);

    // Group watchlist by indicator_id to find top watched.
    // PostgREST !inner join returns an object (not array) for many-to-one FK,
    // but the generated TS types may be array-shaped, so we handle both forms
    // (same pattern used in admin.ts getReleasesForAdmin).
    const indicatorCounts = new Map<
      string,
      { name: string; count: number }
    >();
    for (const row of topWatchedResult.data ?? []) {
      const indicatorRaw = Array.isArray(row.indicators)
        ? row.indicators[0]
        : row.indicators;
      const name =
        (indicatorRaw as { name: string } | null)?.name ?? "Unknown";
      const entry = indicatorCounts.get(row.indicator_id);
      if (entry) {
        entry.count += 1;
      } else {
        indicatorCounts.set(row.indicator_id, { name, count: 1 });
      }
    }
    const topWatchedIndicators: WatchedIndicator[] = Array.from(
      indicatorCounts.entries()
    )
      .map(([indicator_id, { name, count }]) => ({
        indicator_id,
        indicator_name: name,
        watch_count: count,
      }))
      .sort((a, b) => b.watch_count - a.watch_count)
      .slice(0, 10);

    return {
      success: true,
      data: {
        totalUsers: totalUsersResult.count ?? 0,
        activeSubscriptions: activeSubsResult.count ?? 0,
        apiCallsLast30d: apiCallsResult.count ?? 0,
        webhooksDelivered: webhooksResult.count ?? 0,
        dailySignups,
        dailyApiCalls,
        topWatchedIndicators,
      },
    };
  } catch (error) {
    console.error("Failed to fetch analytics data:", error);
    return { success: false, error: "Failed to fetch analytics data" };
  }
}

/**
 * Build a complete 30-day series with zero-fill for missing days.
 */
function buildDailySeries(
  countsByDay: Map<string, number>,
  startDate: Date
): DailyDataPoint[] {
  const result: DailyDataPoint[] = [];
  const current = new Date(startDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  while (current <= today) {
    const day = current.toISOString().slice(0, 10);
    result.push({ date: day, count: countsByDay.get(day) ?? 0 });
    current.setDate(current.getDate() + 1);
  }
  return result;
}
