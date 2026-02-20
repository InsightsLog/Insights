"use client";

import { useState, useTransition } from "react";
import { updateReleaseConsensus } from "@/app/actions/admin";
import type { AdminReleaseRow } from "@/app/actions/admin";

type Props = {
  initialReleases: AdminReleaseRow[];
};

/**
 * Client component for editing consensus values on releases.
 * Allows admins to input or update analyst consensus forecasts.
 */
export function ReleasesClient({ initialReleases }: Props) {
  const [releases, setReleases] = useState<AdminReleaseRow[]>(initialReleases);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function startEdit(release: AdminReleaseRow) {
    setEditing(release.id);
    setEditValue(release.consensus ?? "");
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setEditValue("");
    setError(null);
  }

  function saveEdit(releaseId: string) {
    const value = editValue.trim() === "" ? null : editValue.trim();
    startTransition(async () => {
      const result = await updateReleaseConsensus(releaseId, value);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setReleases((prev) =>
        prev.map((r) => (r.id === releaseId ? { ...r, consensus: value } : r))
      );
      setEditing(null);
      setEditValue("");
      setError(null);
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-[#0f1419]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Indicator
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Period
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Previous
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Consensus
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Actual
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {releases.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  No releases found
                </td>
              </tr>
            ) : (
              releases.map((release) => (
                <tr
                  key={release.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {formatDate(release.release_at)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {release.indicator_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {release.period}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-zinc-600 dark:text-zinc-400">
                    {release.previous ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    {editing === release.id ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(release.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        placeholder="e.g. 3.2"
                        autoFocus
                      />
                    ) : (
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {release.consensus ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    {release.actual ? (
                      <span className="font-semibold text-green-700 dark:text-green-400">
                        {release.actual}
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {editing === release.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(release.id)}
                          disabled={isPending}
                          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isPending ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={isPending}
                          className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(release)}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
