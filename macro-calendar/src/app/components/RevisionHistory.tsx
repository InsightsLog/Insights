"use client";

import { useMemo } from "react";

/**
 * Schema for a single revision record.
 * Matches the format stored in releases.revision_history.
 */
export type RevisionRecord = {
  previous_actual: string;
  new_actual: string;
  revised_at: string;
};

type RevisionHistoryProps = {
  /**
   * Array of revision records from the releases.revision_history column.
   * Should be in chronological order (oldest first) or will be sorted.
   */
  revisions: RevisionRecord[];
  /**
   * Optional unit to display after values (e.g., "%", "K").
   */
  unit?: string | null;
};

/**
 * Formats a revision timestamp for display.
 * Shows date and time in a readable format.
 * Exported for testing purposes.
 */
export function formatRevisionDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Sorts revision records chronologically (oldest to newest).
 * Exported for testing purposes.
 */
export function sortRevisions(revisions: RevisionRecord[]): RevisionRecord[] {
  if (!revisions || revisions.length === 0) return [];
  return [...revisions].sort(
    (a, b) => new Date(a.revised_at).getTime() - new Date(b.revised_at).getTime()
  );
}

/**
 * Returns appropriate pluralization for revision count.
 * Exported for testing purposes.
 */
export function getRevisionCountText(count: number): string {
  return `${count} revision${count !== 1 ? "s" : ""} recorded`;
}

/**
 * Client component that displays a timeline of revisions for a release.
 *
 * States:
 * - Empty: shows message when no revisions exist
 * - Timeline: shows chronological list of revisions with old → new values
 *
 * Usage:
 * ```tsx
 * <RevisionHistory revisions={release.revision_history} unit={release.unit} />
 * ```
 */
export function RevisionHistory({ revisions, unit }: RevisionHistoryProps) {
  // Sort revisions chronologically (oldest to newest) for timeline display
  const sortedRevisions = useMemo(() => sortRevisions(revisions), [revisions]);

  // Empty state when no revisions exist
  if (sortedRevisions.length === 0) {
    return (
      <div
        className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
        data-testid="revision-history-empty"
      >
        No revisions have been made to this release.
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      data-testid="revision-history"
      role="region"
      aria-label="Revision history timeline"
    >
      <ol className="relative border-l border-zinc-300 dark:border-zinc-600">
        {sortedRevisions.map((revision, index) => (
          <li
            key={revision.revised_at}
            className="mb-6 ml-6 last:mb-0"
            data-testid={`revision-item-${index}`}
          >
            {/* Timeline dot */}
            <span
              className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 ring-4 ring-white dark:ring-zinc-900"
              aria-hidden="true"
            />

            {/* Revision content */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
              {/* Timestamp */}
              <time
                className="mb-2 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
                dateTime={revision.revised_at}
              >
                {formatRevisionDate(revision.revised_at)}
              </time>

              {/* Value change */}
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded bg-red-100 px-2 py-0.5 font-mono text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {revision.previous_actual}
                  {unit && <span className="ml-0.5 text-red-500 dark:text-red-400/70">{unit}</span>}
                </span>
                <span
                  className="text-zinc-400 dark:text-zinc-500"
                  aria-label="changed to"
                >
                  →
                </span>
                <span className="rounded bg-green-100 px-2 py-0.5 font-mono text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {revision.new_actual}
                  {unit && <span className="ml-0.5 text-green-500 dark:text-green-400/70">{unit}</span>}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Revision count summary */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {getRevisionCountText(sortedRevisions.length)}
      </p>
    </div>
  );
}
