"use client";

import { useState, useEffect } from "react";

interface BLSImportStatus {
  configured: boolean;
  message: string;
  keyHint: string;
  limits: {
    queriesPerDay: number;
    yearsPerQuery: number;
    seriesPerQuery: number;
  };
  availableSeries: Array<{
    id: string;
    name: string;
    category: string;
    countryCode: string;
    frequency: string;
  }>;
  totalSeries: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  result: {
    totalSeries: number;
    successfulSeries: number;
    failedSeries: number;
    totalObservations: number;
    totalInserted: number;
    totalUpdated: number;
    totalSkipped: number;
    errors?: string[];
  };
}

/**
 * BLSImportButton component for admin dashboard.
 * Displays BLS API status and allows triggering data imports.
 */
export function BLSImportButton() {
  const [status, setStatus] = useState<BLSImportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch BLS configuration status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch("/api/admin/bls-import");
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to fetch BLS status");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch BLS status");
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
      const response = await fetch("/api/admin/bls-import", {
        method: "POST",
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
            Checking BLS API status...
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
              BLS Data Import
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Import economic data from Bureau of Labor Statistics
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status?.configured ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                API Key Configured
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                Limited Mode
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
            {(() => {
              const { successfulSeries, totalSeries, totalObservations, totalInserted, totalUpdated, errors } = result.result;
              return (
                <>
                  <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <p>Series: {successfulSeries}/{totalSeries} successful</p>
                    <p>Observations: {totalObservations.toLocaleString()}</p>
                    <p>Inserted: {totalInserted.toLocaleString()}, Updated: {totalUpdated.toLocaleString()}</p>
                  </div>
                  {errors && errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Errors:</p>
                      <ul className="list-disc ml-4 text-sm text-red-600 dark:text-red-400">
                        {errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        <div>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Import historical economic data for {status?.totalSeries ?? 0} indicators including 
            unemployment rate, CPI, PPI, and employment statistics.
            {!status?.configured && " Running in limited mode (25 queries/day)."}
          </p>
          <button
            onClick={handleImport}
            disabled={importing}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Importing... (this may take a few minutes)
              </>
            ) : (
              "Import BLS Data"
            )}
          </button>

          {!status?.configured && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              For higher limits (500 queries/day, 20 years of data), set BLS_API_KEY.{" "}
              <a 
                href="https://data.bls.gov/registrationEngine/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Register for free
              </a>
            </p>
          )}

          {/* Show available series */}
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {showDetails ? "Hide" : "Show"} available series ({status?.totalSeries ?? 0})
            </button>
            {showDetails && status && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-700">
                <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
                  <thead className="bg-zinc-50 dark:bg-zinc-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">ID</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {status.availableSeries.map((series) => (
                      <tr key={series.id}>
                        <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">{series.id}</td>
                        <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">{series.name}</td>
                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{series.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
