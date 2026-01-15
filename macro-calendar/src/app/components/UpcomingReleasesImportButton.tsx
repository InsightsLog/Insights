"use client";

import { useState, useEffect } from "react";

interface SourceInfo {
  configured: boolean;
  name: string;
  coverage: string;
  freeLimit: string;
  registrationUrl: string;
}

interface UpcomingImportStatus {
  configured: boolean;
  sources: {
    fmp: SourceInfo;
    finnhub: SourceInfo;
    tradingEconomics: SourceInfo;
  };
  message: string;
  g20Countries: string[];
}

interface SourceResult {
  available: boolean;
  events: number;
  errors: string[];
}

interface ImportResult {
  success: boolean;
  message: string;
  result: {
    sources: {
      fmp: SourceResult;
      finnhub: SourceResult;
      tradingEconomics: SourceResult;
    };
    totalEventsFromSources: number;
    uniqueEventsAfterDedup: number;
    indicatorsCreated: number;
    releasesCreated: number;
    releasesSkipped: number;
    countriesCovered: string[];
    errors?: string[];
  };
}

/**
 * UpcomingReleasesImportButton component for admin dashboard.
 * Displays calendar API status and allows triggering upcoming events imports.
 * Supports 3 sources: FMP, Finnhub, and Trading Economics.
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
        body: JSON.stringify({ days: 30 }),
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
            Checking calendar API status...
          </span>
        </div>
      </div>
    );
  }

  const configuredCount = status
    ? [status.sources.fmp.configured, status.sources.finnhub.configured, status.sources.tradingEconomics.configured].filter(Boolean).length
    : 0;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              🌍 Upcoming Releases Import (G20+)
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Import upcoming economic events from multiple sources
            </p>
          </div>
          <div className="flex items-center gap-2">
            {configuredCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                {configuredCount}/3 Sources Ready
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                Not Configured
              </span>
            )}
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
          <div className={`mb-4 rounded-md border px-4 py-3 ${
            result.success 
              ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20"
              : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20"
          }`}>
            <p className={`text-sm font-medium ${
              result.success 
                ? "text-green-800 dark:text-green-400"
                : "text-amber-800 dark:text-amber-400"
            }`}>
              {result.message}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <p>Total from sources: {result.result.totalEventsFromSources.toLocaleString()}</p>
              <p>After deduplication: {result.result.uniqueEventsAfterDedup.toLocaleString()}</p>
              <p>Releases created: {result.result.releasesCreated.toLocaleString()}</p>
              <p>Countries: {result.result.countriesCovered.length}</p>
            </div>
            {/* Source breakdown */}
            <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Source Breakdown:</p>
              <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                <div className={result.result.sources.fmp.available ? "text-green-600 dark:text-green-400" : "text-zinc-400"}>
                  FMP: {result.result.sources.fmp.events} events
                </div>
                <div className={result.result.sources.finnhub.available ? "text-green-600 dark:text-green-400" : "text-zinc-400"}>
                  Finnhub: {result.result.sources.finnhub.events} events
                </div>
                <div className={result.result.sources.tradingEconomics.available ? "text-green-600 dark:text-green-400" : "text-zinc-400"}>
                  TE: {result.result.sources.tradingEconomics.events} events
                </div>
              </div>
            </div>
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

        {configuredCount > 0 ? (
          <div>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              Import upcoming economic events for the next 30 days from G20+ countries.
              Events are deduplicated across sources to avoid duplicates.
            </p>
            
            {/* Source status */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {status && Object.entries(status.sources).map(([key, source]) => (
                <div 
                  key={key}
                  className={`rounded-md p-2 text-xs ${
                    source.configured 
                      ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                  }`}
                >
                  <div className="font-medium">{source.name}</div>
                  <div className="text-xs opacity-75">
                    {source.configured ? "✓ Ready" : "✗ Not configured"}
                  </div>
                </div>
              ))}
            </div>

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

            {/* G20 Countries */}
            <div className="mt-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                {showDetails ? "Hide" : "Show"} G20+ countries ({status?.g20Countries.length ?? 0})
              </button>
              {showDetails && status && (
                <div className="mt-2 rounded border border-zinc-200 p-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                  {status.g20Countries.join(", ")}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              To import upcoming economic events, configure at least one calendar API key:
            </p>
            <div className="mb-4 space-y-3">
              {status && Object.entries(status.sources).map(([key, source]) => (
                <div key={key} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {source.name}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500">
                        ({source.freeLimit})
                      </span>
                    </div>
                    <a
                      href={source.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Get API Key →
                    </a>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{source.coverage}</p>
                </div>
              ))}
            </div>
            <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Add the API key(s) to Vercel environment variables:
              </p>
              <ul className="mt-1 list-disc ml-4 text-xs text-zinc-500 font-mono">
                <li>FMP_API_KEY</li>
                <li>FINNHUB_API_KEY</li>
                <li>TRADING_ECONOMICS_API_KEY</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
