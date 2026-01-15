"use client";

import { useState, useEffect } from "react";

interface CMESourceInfo {
  name: string;
  description: string;
  coverage: string;
  apiKeyRequired: boolean;
  features: string[];
  url: string;
}

interface UpcomingImportStatus {
  configured: boolean;
  source: CMESourceInfo;
  message: string;
  supportedCountries: string[];
}

interface ScheduleChange {
  indicatorId: string;
  indicatorName: string;
  country: string;
  changeType: "time_changed" | "date_changed" | "cancelled" | "new";
  oldValue?: string;
  newValue?: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  result: {
    source: {
      name: string;
      events: number;
      errors: string[];
    };
    totalEvents: number;
    indicatorsCreated: number;
    releasesCreated: number;
    releasesUpdated: number;
    releasesSkipped: number;
    schedulesChanged: ScheduleChange[];
    countriesCovered: string[];
    errors?: string[];
  };
}

/**
 * Determines the styling state for an import result.
 */
function getResultState(result: ImportResult): "success" | "warning" {
  if (result.result.totalEvents === 0) {
    return "warning";
  }
  return result.success ? "success" : "warning";
}

/** Result styling classes for container */
const resultContainerStyles = {
  success: "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20",
};

/** Result styling classes for text */
const resultTextStyles = {
  success: "text-green-800 dark:text-green-400",
  warning: "text-amber-800 dark:text-amber-400",
};

/**
 * UpcomingReleasesImportButton component for admin dashboard.
 * Displays CME calendar status and allows triggering upcoming events imports.
 * Uses CME Group's Economic Releases Calendar - no API key required.
 */
export function UpcomingReleasesImportButton() {
  const [status, setStatus] = useState<UpcomingImportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch import status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch("/api/admin/upcoming-import");
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to fetch status");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch status");
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/upcoming-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: 2 }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Import failed");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error during import");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Checking CME calendar status...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              📊 Upcoming Releases Import (CME Group)
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Import economic events from CME&apos;s calendar - no API key required
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
              ✓ Ready
            </span>
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
          <div className={`mb-4 rounded-md border px-4 py-3 ${resultContainerStyles[getResultState(result)]}`}>
            <p className={`text-sm font-medium ${resultTextStyles[getResultState(result)]}`}>
              {result.message}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <p>Total events: {result.result.totalEvents.toLocaleString()}</p>
              <p>Releases created: {result.result.releasesCreated.toLocaleString()}</p>
              <p>Releases updated: {result.result.releasesUpdated.toLocaleString()}</p>
              <p>Countries: {result.result.countriesCovered.length}</p>
            </div>
            {/* Source info */}
            <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Source:</p>
              <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                {result.result.source.name}: {result.result.source.events} events fetched
              </div>
            </div>
            {/* Schedule changes alert */}
            {result.result.schedulesChanged && result.result.schedulesChanged.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 dark:border-amber-700 dark:bg-amber-900/30">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  ⚠️ {result.result.schedulesChanged.length} Schedule Change(s) Detected
                </p>
                <div className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                  {result.result.schedulesChanged.slice(0, 3).map((change, i) => (
                    <p key={i}>
                      • <strong>{change.indicatorName}</strong> ({change.country}): {change.changeType.replace("_", " ")}
                    </p>
                  ))}
                  {result.result.schedulesChanged.length > 3 && (
                    <p>...and {result.result.schedulesChanged.length - 3} more</p>
                  )}
                </div>
              </div>
            )}
            {result.result.errors && result.result.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Errors:</p>
                <ul className="list-disc ml-4 text-sm text-red-600 dark:text-red-400">
                  {result.result.errors.slice(0, 3).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {result.result.errors.length > 3 && (
                    <li>...and {result.result.errors.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <div>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Import upcoming economic events for the next 2 months from CME Group&apos;s calendar.
            Schedule changes are automatically detected and tracked.
          </p>
          
          {/* Source info */}
          {status?.source && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                <span className="font-medium text-green-800 dark:text-green-300">{status.source.name}</span>
              </div>
              <p className="mt-1 text-xs text-green-700 dark:text-green-400">{status.source.coverage}</p>
              <div className="mt-2 space-y-1">
                {status.source.features.map((feature, i) => (
                  <p key={i} className="text-xs text-green-600 dark:text-green-400">• {feature}</p>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing}
            className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Importing... (this may take a minute)
              </>
            ) : (
              "🚀 Import Upcoming Releases"
            )}
          </button>

          {/* Supported Countries */}
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {showDetails ? "Hide" : "Show"} supported countries ({status?.supportedCountries?.length ?? 0})
            </button>
            {showDetails && status?.supportedCountries && (
              <div className="mt-2 rounded border border-zinc-200 p-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                {status.supportedCountries.join(", ")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
