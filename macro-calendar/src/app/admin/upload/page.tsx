"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setStatus({ type: "idle", message: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setStatus({ type: "error", message: "Please select a CSV file." });
      return;
    }

    if (!secret.trim()) {
      setStatus({ type: "error", message: "Admin secret is required." });
      return;
    }

    setStatus({ type: "loading", message: "Uploading..." });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("secret", secret);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Format validation errors if present
        let errorMessage = data.error || "Upload failed";
        if (data.details && Array.isArray(data.details)) {
          const detailMessages = data.details
            .map((d: { row: number; errors: string[] }) => `Row ${d.row}: ${d.errors.join(", ")}`)
            .join("\n");
          errorMessage = `${errorMessage}\n\n${detailMessages}`;
          if (data.totalErrors > data.details.length) {
            errorMessage += `\n... and ${data.totalErrors - data.details.length} more errors`;
          }
        } else if (data.details && typeof data.details === "string") {
          errorMessage = `${errorMessage}: ${data.details}`;
        }
        setStatus({ type: "error", message: errorMessage });
        return;
      }

      setStatus({
        type: "success",
        message: `${data.message}. Indicators: ${data.indicatorsUpserted}, Releases: ${data.releasesInserted}`,
      });
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById("csv-file") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Network error during upload",
      });
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          Admin: Upload CSV
        </h1>
        <p className="mb-6 text-gray-600">
          Upload a CSV file to add or update indicators and releases.
        </p>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          {/* Secret Input */}
          <div className="mb-4">
            <label
              htmlFor="secret"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Admin Secret
            </label>
            <input
              type="password"
              id="secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter admin secret"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* File Input */}
          <div className="mb-4">
            <label
              htmlFor="csv-file"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              CSV File
            </label>
            <input
              type="file"
              id="csv-file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="mt-1 text-sm text-gray-500">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* CSV Format Help */}
          <details className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              CSV Format Requirements
            </summary>
            <div className="mt-2 text-sm text-gray-600">
              <p className="mb-2">
                <strong>Required columns:</strong>
              </p>
              <ul className="mb-2 ml-4 list-disc">
                <li>indicator_name</li>
                <li>country_code</li>
                <li>category</li>
                <li>source_name</li>
                <li>source_url</li>
                <li>release_at (ISO8601 format)</li>
                <li>period</li>
              </ul>
              <p className="mb-2">
                <strong>Optional columns:</strong>
              </p>
              <ul className="ml-4 list-disc">
                <li>actual, forecast, previous, revised, unit, notes</li>
              </ul>
            </div>
          </details>

          {/* Status Message */}
          {status.message && (
            <div
              className={`mb-4 rounded-md p-3 text-sm whitespace-pre-wrap ${
                status.type === "error"
                  ? "bg-red-50 text-red-700"
                  : status.type === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-blue-50 text-blue-700"
              }`}
            >
              {status.message}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={status.type === "loading"}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status.type === "loading" ? "Uploading..." : "Upload CSV"}
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-4">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Back to Calendar
          </Link>
        </div>
      </div>
    </main>
  );
}
