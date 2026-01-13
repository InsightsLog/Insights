"use client";

import { useState, useEffect, useRef } from "react";
import {
  getAllApiKeysUsage,
  type ApiKeyUsageStats,
} from "@/app/actions/api-usage";

/**
 * Formats a number with thousands separator.
 */
function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

/**
 * Formats response time in milliseconds.
 */
function formatResponseTime(ms: number | null): string {
  if (ms === null) return "—";
  return `${ms}ms`;
}

/**
 * Simple bar chart for daily usage visualization.
 */
function UsageChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        No usage data available
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Only show last 14 days for readability
  const displayData = data.slice(-14);

  return (
    <div className="flex items-end gap-1 h-24">
      {displayData.map((d) => {
        const height = d.count > 0 ? Math.max((d.count / maxCount) * 100, 4) : 0;
        return (
          <div
            key={d.date}
            className="flex-1 min-w-1"
            title={`${d.date}: ${d.count} calls`}
          >
            <div
              className={`w-full rounded-t ${
                d.count > 0
                  ? "bg-blue-500 dark:bg-blue-600"
                  : "bg-zinc-200 dark:bg-zinc-700"
              }`}
              style={{ height: `${height}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * API Usage Dashboard widget for the API Keys page.
 * Shows usage statistics for all API keys.
 *
 * Task: T314 - Add API usage tracking
 */
export function ApiUsageDashboard() {
  const [stats, setStats] = useState<ApiKeyUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  const hasFetched = useRef(false);

  useEffect(() => {
    // Avoid duplicate fetches on strict mode
    if (hasFetched.current && period === 30) {
      return;
    }
    hasFetched.current = true;

    let cancelled = false;

    async function fetchUsage() {
      setLoading(true);
      setError(null);

      const result = await getAllApiKeysUsage(period);

      if (cancelled) return;

      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }

    fetchUsage();

    return () => {
      cancelled = true;
    };
  }, [period]);

  // Handle period change
  const handlePeriodChange = (newPeriod: number) => {
    hasFetched.current = false;
    setPeriod(newPeriod);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          API Usage
        </h2>
        <select
          value={period}
          onChange={(e) => handlePeriodChange(Number(e.target.value))}
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Loading usage data...
        </div>
      ) : error ? (
        <div className="py-4 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <div className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                Total Calls
              </div>
              <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatNumber(stats.total_calls)}
              </div>
            </div>
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <div className="text-xs font-medium uppercase text-green-600 dark:text-green-400">
                Successful
              </div>
              <div className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">
                {formatNumber(stats.successful_calls)}
              </div>
            </div>
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <div className="text-xs font-medium uppercase text-red-600 dark:text-red-400">
                Errors
              </div>
              <div className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">
                {formatNumber(stats.error_calls)}
              </div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <div className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                Avg Response
              </div>
              <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatResponseTime(stats.avg_response_time_ms)}
              </div>
            </div>
          </div>

          {/* Daily usage chart */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Daily API Calls (Last 14 Days)
            </h3>
            <UsageChart data={stats.daily_usage} />
            <div className="mt-1 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {stats.daily_usage.length > 14
                  ? stats.daily_usage[stats.daily_usage.length - 14]?.date
                  : stats.daily_usage[0]?.date ?? "—"}
              </span>
              <span>
                {stats.daily_usage[stats.daily_usage.length - 1]?.date ?? "—"}
              </span>
            </div>
          </div>

          {/* Endpoint breakdown */}
          {stats.endpoint_usage.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Usage by Endpoint
              </h3>
              <div className="space-y-2">
                {stats.endpoint_usage.slice(0, 5).map((ep) => (
                  <div
                    key={ep.endpoint}
                    className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
                  >
                    <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300 truncate">
                      {ep.endpoint}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {formatNumber(ep.count)}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 w-14 text-right">
                        {formatResponseTime(ep.avg_response_time_ms)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Period info */}
          <div className="text-xs text-zinc-500 dark:text-zinc-400 text-right">
            {stats.period_start} — {stats.period_end}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No usage data available
        </div>
      )}
    </div>
  );
}
