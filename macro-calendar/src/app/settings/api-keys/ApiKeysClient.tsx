"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  getApiKeys,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  type ApiKey,
} from "@/app/actions/api-keys";

/**
 * Formats a date string to a human-readable format.
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * API Keys management client component.
 * Displays list of API keys and allows creation/revocation.
 */
export function ApiKeysClient() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Track if this is the initial mount
  const hasFetched = useRef(false);

  // Fetch API keys on mount and when refreshTrigger changes
  useEffect(() => {
    // Avoid duplicate fetches
    if (refreshTrigger === 0 && hasFetched.current) {
      return;
    }
    hasFetched.current = true;

    let cancelled = false;
    
    async function fetchKeys() {
      setLoading(true);
      setError(null);
      const result = await getApiKeys();
      if (cancelled) return;
      if (result.success) {
        setKeys(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }

    fetchKeys();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  // Helper to trigger a refresh
  const refreshKeys = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Handle creating a new API key
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setCreating(true);
    setError(null);
    setCreatedKey(null);

    const result = await createApiKey(newKeyName.trim());
    if (result.success) {
      setCreatedKey(result.data.key);
      setNewKeyName("");
      // Refresh the list
      refreshKeys();
    } else {
      setError(result.error);
    }
    setCreating(false);
  };

  // Handle revoking an API key
  const handleRevoke = async (keyId: string) => {
    setRevokingKeyId(keyId);
    setError(null);

    const result = await revokeApiKey(keyId);
    if (result.success) {
      // Refresh the list
      refreshKeys();
    } else {
      setError(result.error);
    }
    setRevokingKeyId(null);
  };

  // Handle deleting an API key
  const handleDelete = async (keyId: string) => {
    setDeletingKeyId(keyId);
    setError(null);
    setShowDeleteConfirm(null);

    const result = await deleteApiKey(keyId);
    if (result.success) {
      // Refresh the list
      refreshKeys();
    } else {
      setError(result.error);
    }
    setDeletingKeyId(null);
  };

  // Copy key to clipboard
  const handleCopyKey = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
    }
  };

  // Dismiss the created key banner
  const handleDismissKey = () => {
    setCreatedKey(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to Calendar
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            API Keys
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your API keys for programmatic access to Macro Calendar
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              {error}
            </p>
          </div>
        )}

        {/* Created key banner */}
        {createdKey && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-4 dark:border-green-900/50 dark:bg-green-900/20">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-green-800 dark:text-green-400">
                  API Key Created Successfully
                </h3>
                <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                  Copy your API key now. You won&apos;t be able to see it again!
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="rounded bg-green-100 px-2 py-1 font-mono text-sm text-green-900 dark:bg-green-900/40 dark:text-green-200">
                    {createdKey}
                  </code>
                  <button
                    onClick={handleCopyKey}
                    className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <button
                onClick={handleDismissKey}
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                aria-label="Dismiss"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Create new key form */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Create New API Key
          </h2>
          <form onSubmit={handleCreate} className="flex items-end gap-4">
            <div className="flex-1">
              <label
                htmlFor="keyName"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Key Name
              </label>
              <input
                type="text"
                id="keyName"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., My Production Key"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                disabled={creating}
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newKeyName.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Key"}
            </button>
          </form>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Use descriptive names like &quot;Production App&quot; or &quot;Local Development&quot;
          </p>
        </div>

        {/* API keys list */}
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Your API Keys
            </h2>
          </div>

          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Loading...
            </div>
          ) : keys.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              <h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                No API keys
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Create your first API key to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Key
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Last Used
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {keys.map((key) => (
                    <tr
                      key={key.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {key.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-zinc-600 dark:text-zinc-400">
                        {key.key_prefix}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        {formatDateTime(key.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        {key.last_used_at
                          ? formatDateTime(key.last_used_at)
                          : "Never"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {key.revoked_at ? (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Revoked
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {showDeleteConfirm === key.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(key.id)}
                              disabled={deletingKeyId === key.id}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                              {deletingKeyId === key.id
                                ? "Deleting..."
                                : "Confirm"}
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : key.revoked_at ? (
                          <button
                            onClick={() => setShowDeleteConfirm(key.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRevoke(key.id)}
                            disabled={revokingKeyId === key.id}
                            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                          >
                            {revokingKeyId === key.id ? "Revoking..." : "Revoke"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Usage info */}
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Using API Keys
          </h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Include your API key in the <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">Authorization</code> header:
          </p>
          <pre className="overflow-x-auto rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
            <code className="text-zinc-800 dark:text-zinc-200">
              Authorization: Bearer mc_your_api_key_here
            </code>
          </pre>
        </div>
      </main>
    </div>
  );
}
