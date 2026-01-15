"use client";

import { useState } from "react";
import { clearHistoricalData, ClearDataResult } from "@/app/actions/admin";

/**
 * ClearDataButton component for admin dashboard.
 * Allows admins to clear seed data, FRED data, or all data.
 */
export function ClearDataButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClearDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClear = async (
    clearSeedData: boolean,
    clearFredData: boolean,
    clearAllData: boolean
  ) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await clearHistoricalData({
        clearSeedData,
        clearFredData,
        clearAllData,
      });

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear data");
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Clear Data
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Remove seed, FRED, or all historical data
            </p>
          </div>
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
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-900/20">
            <p className="text-sm font-medium text-green-800 dark:text-green-400">
              Data cleared successfully
            </p>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              <p>Deleted {result.deletedReleases.toLocaleString()} releases</p>
              <p>Deleted {result.deletedIndicators.toLocaleString()} indicators</p>
            </div>
          </div>
        )}

        {!isOpen ? (
          <button
            onClick={() => setIsOpen(true)}
            disabled={loading}
            className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear Historical Data
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              What data would you like to clear?
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleClear(true, false, false)}
                disabled={loading}
                className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Clearing..." : "Clear Seed Data"}
              </button>
              <button
                onClick={() => handleClear(false, true, false)}
                disabled={loading}
                className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Clearing..." : "Clear FRED Data"}
              </button>
              <button
                onClick={() => handleClear(true, true, false)}
                disabled={loading}
                className="inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Clearing..." : "Clear Both"}
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete ALL data? This cannot be undone.")) {
                    handleClear(false, false, true);
                  }
                }}
                disabled={loading}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Clearing..." : "Clear ALL Data"}
              </button>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              disabled={loading}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        )}

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          <strong>Seed Data:</strong> Test indicators from initial setup<br />
          <strong>FRED Data:</strong> Imported economic data from Federal Reserve<br />
          <strong>All Data:</strong> Everything (use with caution!)
        </p>
      </div>
    </div>
  );
}
