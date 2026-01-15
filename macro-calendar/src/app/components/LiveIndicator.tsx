/**
 * LiveIndicator Component
 *
 * Shows real-time connection status and updates count.
 * Displays a pulsing green dot when connected to Supabase Realtime.
 *
 * Task: T400.3 - Add real-time indicator to calendar page
 */

"use client";

import { useRealtimeReleases } from "@/lib/hooks/useRealtimeReleases";

export function LiveIndicator() {
  const { isConnected, updateCount, latestUpdate } = useRealtimeReleases();

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Connection status dot */}
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isConnected
              ? "animate-pulse bg-green-500"
              : "bg-zinc-400 dark:bg-zinc-600"
          }`}
          aria-hidden="true"
        />
        <span
          className={`font-medium ${
            isConnected
              ? "text-green-700 dark:text-green-400"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {isConnected ? "Live" : "Connecting..."}
        </span>
      </div>

      {/* Update count badge */}
      {updateCount > 0 && (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {updateCount} update{updateCount !== 1 ? "s" : ""}
        </span>
      )}

      {/* Latest update info */}
      {latestUpdate && (
        <span className="hidden text-zinc-500 dark:text-zinc-400 sm:inline">
          Last: {latestUpdate.eventType.toLowerCase()} at{" "}
          {latestUpdate.timestamp.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
