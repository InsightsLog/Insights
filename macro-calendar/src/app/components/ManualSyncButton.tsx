"use client";

import { useState } from "react";

interface SyncResult {
  success: boolean;
  duration_ms: number;
  sources?: {
    fmp: { available: boolean; events: number; errors: number };
    finnhub: { available: boolean; events: number; errors: number };
    trading_economics: { available: boolean; events: number; errors: number };
  };
  summary?: {
    total_events_from_sources: number;
    unique_events: number;
    indicators_created: number;
    releases_created: number;
    releases_skipped: number;
    countries_covered: number;
  };
  error?: string;
}

/**
 * ManualSyncButton component for admin dashboard.
 * Allows admins to manually trigger a data sync outside of the scheduled cron job.
 * Useful when Vercel Hobby plan limits cron to once per day.
 */
export function ManualSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      // Call the cron endpoint directly with admin auth
      const response = await fetch("/api/cron/sync-data", {
        method: "GET",
        headers: {
          "x-dev-cron-bypass": "true", // For development
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Sync failed");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error during sync");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              ⏰ Manual Data Sync
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Trigger a data sync manually (same as scheduled cron job)
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            Daily at 5 PM CT
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              {error}
            </p>
          </div>
        )}

        {result && (
          <div
            className={`mb-4 rounded-md border px-4 py-3 ${
              result.success
                ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20"
                : "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20"
            }`}
          >
            <p
              className={`text-sm font-medium ${
                result.success
                  ? "text-green-800 dark:text-green-400"
                  : "text-red-800 dark:text-red-400"
              }`}
            >
              {result.success
                ? `Sync completed in ${(result.duration_ms / 1000).toFixed(1)}s`
                : `Sync failed: ${result.error}`}
            </p>
            {result.success && result.summary && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <p>Events fetched: {result.summary.total_events_from_sources}</p>
                <p>After dedup: {result.summary.unique_events}</p>
                <p>Releases created: {result.summary.releases_created}</p>
                <p>Countries: {result.summary.countries_covered}</p>
              </div>
            )}
            {result.success && result.sources && (
              <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Source Breakdown:
                </p>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                  <div
                    className={
                      result.sources.fmp.available
                        ? "text-green-600 dark:text-green-400"
                        : "text-zinc-400"
                    }
                  >
                    FMP: {result.sources.fmp.events} events
                  </div>
                  <div
                    className={
                      result.sources.finnhub.available
                        ? "text-green-600 dark:text-green-400"
                        : "text-zinc-400"
                    }
                  >
                    Finnhub: {result.sources.finnhub.events} events
                  </div>
                  <div
                    className={
                      result.sources.trading_economics.available
                        ? "text-green-600 dark:text-green-400"
                        : "text-zinc-400"
                    }
                  >
                    TE: {result.sources.trading_economics.events} events
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          The scheduled cron runs daily at 5 PM Central Time (23:00 UTC). Use
          this button to run a sync immediately without waiting for the
          scheduled time.
        </p>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Syncing... (this may take a minute)
            </>
          ) : (
            "🔄 Run Sync Now"
          )}
        </button>

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          <strong>Note:</strong> This calls the same endpoint as the Vercel Cron
          job. To change the scheduled time, update <code>vercel.json</code> in
          the repository and redeploy.
        </p>
      </div>
    </div>
  );
}
