"use client";

import { useState } from "react";

/**
 * Props for the ExportButton component.
 */
interface ExportButtonProps {
  /**
   * The URL to download from.
   */
  downloadUrl: string;

  /**
   * Optional: Label for the button. Defaults to "Export".
   */
  label?: string;

  /**
   * Optional: Additional CSS classes.
   */
  className?: string;
}

/**
 * ExportButton component that triggers a download for the specified URL.
 * Shows loading state while download is in progress.
 * Handles errors gracefully.
 *
 * Task: T340 - Add data export functionality
 */
export function ExportButton({
  downloadUrl,
  label = "Export",
  className = "",
}: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: "csv" | "json") => {
    setIsLoading(true);
    setError(null);

    try {
      const url = `${downloadUrl}?format=${format}`;
      const response = await fetch(url);

      if (!response.ok) {
        // Try to parse JSON error response, but handle non-JSON responses gracefully
        const contentType = response.headers.get("Content-Type") ?? "";
        let errorMessage = `Export failed (${response.status})`;
        
        if (contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // JSON parsing failed, use default error message
          }
        }
        
        throw new Error(errorMessage);
      }

      // Get the filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `export-${new Date().toISOString().slice(0, 10)}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="inline-flex rounded-md shadow-sm">
        <button
          type="button"
          onClick={() => handleExport("csv")}
          disabled={isLoading}
          className="inline-flex items-center rounded-l-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          title={`${label} as CSV`}
        >
          {isLoading ? (
            <svg
              className="mr-1.5 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="mr-1.5 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
          )}
          CSV
        </button>
        <button
          type="button"
          onClick={() => handleExport("json")}
          disabled={isLoading}
          className="inline-flex items-center rounded-r-md border-y border-r border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          title={`${label} as JSON`}
        >
          JSON
        </button>
      </div>
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
