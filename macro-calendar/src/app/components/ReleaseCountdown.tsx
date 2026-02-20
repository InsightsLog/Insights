"use client";

import { useState, useEffect, useRef, useMemo } from "react";

export type CountdownRelease = {
  id: string;
  release_at: string;
  actual: string | null;
  indicator: {
    name: string;
    country_code: string;
    importance: string;
  } | null;
};

type Props = {
  releases: CountdownRelease[];
};

/**
 * Formats a duration in milliseconds as HH:MM:SS.
 * Clamps to 00:00:00 if ms is negative.
 */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":");
}

/**
 * Formats an ISO timestamp as a readable local date/time string.
 */
function formatExactTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * ReleaseCountdown shows a sticky banner at the top of the calendar counting
 * down to the next high-impact (importance = "high") scheduled release.
 *
 * - Updates every second.
 * - Automatically advances to the next release once the current one has passed.
 * - Hides when there are no upcoming high-impact releases.
 * - Mobile responsive.
 *
 * Task: T471
 */
export function ReleaseCountdown({ releases }: Props) {
  // null until mounted to avoid hydration mismatch with Date.now()
  const [now, setNow] = useState<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const tick = () => {
      if (isMountedRef.current) {
        setNow(Date.now());
      }
    };

    // Defer the first tick to avoid synchronous setState in effect body
    const initTimeout = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(initTimeout);
      clearInterval(timer);
    };
  }, []);

  // Pre-parse timestamps and sort once when releases change (not every second)
  const sortedHighImpact = useMemo(
    () =>
      releases
        .filter((r) => r.indicator?.importance === "high" && !r.actual)
        .map((r) => ({ ...r, releaseTime: new Date(r.release_at).getTime() }))
        .sort((a, b) => a.releaseTime - b.releaseTime),
    [releases],
  );

  // Don't render until client-side hydration is complete
  if (now === null) return null;

  // Find the first upcoming release based on current time
  const nextRelease = sortedHighImpact.find((r) => r.releaseTime > now);

  if (!nextRelease?.indicator) return null;

  const msRemaining = nextRelease.releaseTime - now;
  const countdown = formatCountdown(msRemaining);

  return (
    <div
      className="sticky top-0 z-10 mb-4 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-900/10 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      role="status"
      aria-live="polite"
      aria-label={`Countdown to ${nextRelease.indicator.name}`}
    >
      {/* Left: clock icon + indicator info */}
      <div className="flex min-w-0 items-center gap-3">
        <svg
          className="h-5 w-5 flex-shrink-0 text-amber-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {nextRelease.indicator.name}
            </span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              {nextRelease.indicator.country_code}
            </span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {formatExactTime(nextRelease.release_at)}
          </p>
        </div>
      </div>

      {/* Right: live countdown */}
      <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-0">
        <span className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-500">
          Next release in
        </span>
        <span className="font-mono text-xl font-bold tabular-nums text-amber-900 dark:text-amber-200 sm:text-2xl">
          {countdown}
        </span>
      </div>
    </div>
  );
}
