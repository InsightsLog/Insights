"use client";

import { useState, useEffect } from "react";

interface WorldBankImportStatus {
  configured: boolean;
  message: string;
  keyHint: string;
  availableIndicators: Array<{
    id: string;
    name: string;
    category: string;
    frequency: string;
  }>;
  totalIndicators: number;
  availableCountries: Array<{
    code: string;
    name: string;
  }>;
  totalCountries: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  result: {
    totalIndicators: number;
    totalCountries: number;
    successfulImports: number;
    failedImports: number;
    totalObservations: number;
    totalInserted: number;
    totalUpdated: number;
    totalSkipped: number;
    errors?: string[];
  };
}

/**
 * WorldBankImportButton component for admin dashboard.
 * Displays World Bank API status and allows triggering data imports.
 * World Bank Open Data API is free and open - no API key required.
 */
export function WorldBankImportButton() {
  const [status, setStatus] = useState<WorldBankImportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch World Bank configuration status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch("/api/admin/world-bank-import");
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to fetch World Bank status");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch World Bank status");
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
      const response = await fetch("/api/admin/world-bank-import", {
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
            Checking World Bank API status...
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
              World Bank Data Import
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Import global development data from World Bank Open Data
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
              No Key Required
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
              const { successfulImports, totalIndicators, totalCountries, totalObservations, totalInserted, totalUpdated, errors } = result.result;
              return (
                <>
                  <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <p>Imports: {successfulImports} successful ({totalIndicators} indicators × {totalCountries} countries)</p>
                    <p>Observations: {totalObservations.toLocaleString()}</p>
                    <p>Inserted: {totalInserted.toLocaleString()}, Updated: {totalUpdated.toLocaleString()}</p>
                  </div>
                  {errors && errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Errors:</p>
                      <ul className="list-disc ml-4 text-sm text-red-600 dark:text-red-400">
                        {errors.slice(0, 5).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {errors.length > 5 && (
                          <li>... and {errors.length - 5} more errors</li>
                        )}
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
            Import historical global data for {status?.totalIndicators ?? 0} indicators across {status?.totalCountries ?? 0} countries including 
            GDP, inflation, unemployment, trade, and investment from the World Bank Open Data platform.
          </p>
          <button
            onClick={handleImport}
            disabled={importing}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Importing... (this may take several minutes)
              </>
            ) : (
              "Import World Bank Data"
            )}
          </button>

          {/* Show available indicators */}
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {showDetails ? "Hide" : "Show"} available indicators ({status?.totalIndicators ?? 0})
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
                    {status.availableIndicators.map((indicator) => (
                      <tr key={indicator.id}>
                        <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">{indicator.id}</td>
                        <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">{indicator.name}</td>
                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{indicator.category}</td>
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
