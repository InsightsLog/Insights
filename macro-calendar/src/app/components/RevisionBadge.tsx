"use client";

import { useMemo, useState, useCallback } from "react";
import type { RevisionRecord } from "./RevisionHistory";
import { formatRevisionDate } from "./RevisionHistory";

type RevisionBadgeProps = {
  /**
   * Array of revision records from the releases.revision_history column.
   * Badge will only display if this array is non-empty.
   */
  revisions: RevisionRecord[];
};

/**
 * Gets the latest revision from an array of revisions.
 * Returns null if the array is empty.
 * Exported for testing purposes.
 */
export function getLatestRevision(revisions: RevisionRecord[]): RevisionRecord | null {
  if (!revisions || revisions.length === 0) return null;

  // Find the revision with the most recent revised_at timestamp
  return revisions.reduce((latest, current) =>
    new Date(current.revised_at) > new Date(latest.revised_at) ? current : latest
  );
}

/**
 * Client component that displays a "Revised" badge with a tooltip showing the latest revision details.
 *
 * States:
 * - Hidden: when revision_history is empty (renders null)
 * - Visible: shows "Revised" badge with hover tooltip showing latest revision
 *
 * Usage:
 * ```tsx
 * <RevisionBadge revisions={release.revision_history} />
 * ```
 */
export function RevisionBadge({ revisions }: RevisionBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const latestRevision = useMemo(() => getLatestRevision(revisions), [revisions]);

  const handleMouseEnter = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  // Don't render anything if there are no revisions
  if (!latestRevision) {
    return null;
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      tabIndex={0}
      data-testid="revision-badge-container"
    >
      <span
        className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        role="status"
        aria-label="This release has been revised"
        data-testid="revision-badge"
      >
        Revised
      </span>

      {/* Tooltip showing latest revision details */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
          role="tooltip"
          data-testid="revision-badge-tooltip"
        >
          {/* Arrow */}
          <div
            className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-100"
            aria-hidden="true"
          />

          {/* Tooltip content */}
          <div className="space-y-1">
            <div className="font-medium">Latest Revision</div>
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-red-500/20 px-1 text-red-300 dark:bg-red-500/30 dark:text-red-700">
                {latestRevision.previous_actual}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500" aria-label="changed to">→</span>
              <span className="rounded bg-green-500/20 px-1 text-green-300 dark:bg-green-500/30 dark:text-green-700">
                {latestRevision.new_actual}
              </span>
            </div>
            <div className="text-zinc-400 dark:text-zinc-500">
              {formatRevisionDate(latestRevision.revised_at)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
