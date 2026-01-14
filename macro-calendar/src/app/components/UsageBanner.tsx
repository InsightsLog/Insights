"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getUsageStatus } from "@/app/actions/billing";

/**
 * UsageBanner component displays a warning banner when a user approaches
 * or exceeds their API usage quota.
 *
 * Task: T325 - Add usage alerts
 *
 * Threshold levels:
 * - 80%: Yellow warning banner
 * - 90%: Orange warning banner
 * - 100%: Red critical banner
 */
export function UsageBanner() {
  const [usageData, setUsageData] = useState<{
    usagePercent: number;
    currentUsage: number;
    limit: number;
    planName: string;
    resetAt: string;
    shouldShowWarning: boolean;
    warningThreshold: number | null;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function fetchUsageStatus() {
      const result = await getUsageStatus();
      if (result.success) {
        setUsageData(result.data);
      }
    }

    fetchUsageStatus();
  }, []);

  // Don't show banner if dismissed, no data, or no warning needed
  if (dismissed || !usageData || !usageData.shouldShowWarning) {
    return null;
  }

  const { usagePercent, currentUsage, limit, planName, warningThreshold } = usageData;

  // Determine banner style based on threshold
  const bannerStyles = {
    80: {
      container: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/50",
      text: "text-amber-800 dark:text-amber-400",
      icon: "text-amber-500",
      progressBar: "bg-amber-500",
    },
    90: {
      container: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-900/50",
      text: "text-orange-800 dark:text-orange-400",
      icon: "text-orange-500",
      progressBar: "bg-orange-500",
    },
    100: {
      container: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/50",
      text: "text-red-800 dark:text-red-400",
      icon: "text-red-500",
      progressBar: "bg-red-500",
    },
  };

  const threshold = warningThreshold as 80 | 90 | 100;
  const styles = bannerStyles[threshold] || bannerStyles[80];

  const warningMessages = {
    80: `You've used ${Math.round(usagePercent)}% of your monthly API quota.`,
    90: `You're almost at your limit! ${Math.round(usagePercent)}% of your monthly API quota used.`,
    100: `You've reached your API quota limit. API access may be restricted.`,
  };

  const message = warningMessages[threshold] || warningMessages[80];

  return (
    <div className={`border-b px-4 py-3 ${styles.container}`}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Warning Icon */}
          <svg
            className={`h-5 w-5 flex-shrink-0 ${styles.icon}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>

          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <span className={`text-sm font-medium ${styles.text}`}>
              {message}
            </span>
            <span className={`text-sm ${styles.text} opacity-75`}>
              {currentUsage.toLocaleString()} / {limit.toLocaleString()} calls • {planName} plan
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/settings/billing"
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${styles.text} hover:underline`}
          >
            Upgrade Plan
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className={`rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/5 ${styles.text}`}
            aria-label="Dismiss banner"
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

      {/* Mini progress bar */}
      <div className="mx-auto mt-2 max-w-5xl">
        <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
          <div
            className={`h-full rounded-full transition-all ${styles.progressBar}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
