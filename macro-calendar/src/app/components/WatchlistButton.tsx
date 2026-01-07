"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { toggleWatchlist, type WatchlistActionResult } from "@/app/actions/watchlist";
import type { User } from "@supabase/supabase-js";

interface WatchlistButtonProps {
  /** UUID of the indicator to add/remove from watchlist */
  indicatorId: string;
  /** Initial watching state (from server) */
  initialWatching?: boolean;
}

/**
 * Client component for adding/removing indicators from watchlist.
 *
 * States:
 * - Loading: Shows spinner while checking auth or toggling watchlist
 * - Not authenticated: Shows tooltip prompting user to sign in
 * - Watching: Shows filled star icon
 * - Not watching: Shows outline star icon
 *
 * Uses Supabase client-side auth state to determine if user is logged in,
 * and server actions to toggle watchlist state.
 */
export function WatchlistButton({ indicatorId, initialWatching = false }: WatchlistButtonProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isWatching, setIsWatching] = useState(initialWatching);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Memoize the Supabase client
  const supabase = useMemo(() => createSupabaseClient(), []);

  // Subscribe to auth state changes
  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        setUser(user);
        setAuthLoading(false);
      })
      .catch(() => {
        setUser(null);
        setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Reset watching state when initialWatching prop changes
  useEffect(() => {
    setIsWatching(initialWatching);
  }, [initialWatching]);

  const handleClick = useCallback(async () => {
    // If not authenticated, show tooltip instead of toggling
    if (!user) {
      setShowTooltip(true);
      // Hide tooltip after 3 seconds
      setTimeout(() => setShowTooltip(false), 3000);
      return;
    }

    setActionLoading(true);
    setError(null);

    const result: WatchlistActionResult = await toggleWatchlist(indicatorId);

    setActionLoading(false);

    if (result.success && result.data) {
      setIsWatching(result.data.isWatching);
    } else if (!result.success) {
      setError(result.error);
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    }
  }, [user, indicatorId]);

  const handleMouseEnter = useCallback(() => {
    if (!user && !authLoading) {
      setShowTooltip(true);
    }
  }, [user, authLoading]);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  const isLoading = authLoading || actionLoading;

  // Determine button styling based on state
  const buttonClasses = user
    ? isWatching
      ? "text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300"
      : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
    : "text-zinc-300 dark:text-zinc-600 cursor-not-allowed";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={isLoading}
        className={`p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 ${buttonClasses}`}
        aria-label={
          isLoading
            ? "Loading..."
            : user
            ? isWatching
              ? "Remove from watchlist"
              : "Add to watchlist"
            : "Sign in to add to watchlist"
        }
        title={
          user
            ? isWatching
              ? "Remove from watchlist"
              : "Add to watchlist"
            : undefined
        }
      >
        {isLoading ? (
          // Loading spinner
          <svg
            className="h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
        ) : isWatching ? (
          // Filled star (watching)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          // Outline star (not watching)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        )}
      </button>

      {/* Tooltip for unauthenticated users */}
      {showTooltip && !user && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs font-medium text-white bg-zinc-900 rounded-lg shadow-lg whitespace-nowrap dark:bg-zinc-700 z-10"
        >
          Sign in to save indicators
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-700" />
        </div>
      )}

      {/* Error message tooltip */}
      {error && (
        <div
          role="alert"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-lg shadow-lg whitespace-nowrap z-10"
        >
          {error}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-600" />
        </div>
      )}
    </div>
  );
}
