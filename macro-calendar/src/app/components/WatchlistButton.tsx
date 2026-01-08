"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { toggleWatchlist } from "@/app/actions/watchlist";
import type { User } from "@supabase/supabase-js";

type WatchlistButtonProps = {
  indicatorId: string;
};

/**
 * Client component that allows users to add/remove an indicator from their watchlist.
 * 
 * States:
 * - Loading: shows loading indicator
 * - Not authenticated: shows disabled button with tooltip
 * - Watching: shows "Remove from watchlist" button
 * - Not watching: shows "Add to watchlist" button
 * 
 * Uses Supabase client-side auth state subscription to stay reactive to changes.
 */
export function WatchlistButton({ indicatorId }: WatchlistButtonProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWatching, setIsWatching] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Use ref to store the Supabase client to avoid recreating it
  const supabaseRef = useRef(createSupabaseClient());

  // Helper function to check watchlist status for a user
  const checkWatchlistStatus = useCallback(async (userId: string) => {
    try {
      const { data } = await supabaseRef.current
        .from("watchlist")
        .select("id")
        .eq("user_id", userId)
        .eq("indicator_id", indicatorId)
        .maybeSingle();

      setIsWatching(!!data);
    } catch (error) {
      console.error("Error fetching watchlist status:", error);
      setIsWatching(false);
    }
  }, [indicatorId]);

  // Fetch initial auth state and watchlist status
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabaseRef.current.auth.getUser();
        setUser(user);

        if (user) {
          await checkWatchlistStatus(user.id);
        }
      } catch (error) {
        console.error("Error fetching initial auth state:", error);
      } finally {
        setLoading(false);
      }
    }

    init();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabaseRef.current.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      
      // Refresh watchlist status when user logs in
      if (newUser) {
        await checkWatchlistStatus(newUser.id);
      } else {
        // Reset watching state when user logs out
        setIsWatching(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkWatchlistStatus]);

  const handleToggle = useCallback(async () => {
    if (!user || isToggling) return;

    setIsToggling(true);
    try {
      const result = await toggleWatchlist(indicatorId);
      if (result.success && result.data) {
        setIsWatching(result.data.isWatching);
      } else if (!result.success) {
        console.error("Failed to toggle watchlist:", result.error);
      }
    } catch (error) {
      console.error("Error toggling watchlist:", error);
    } finally {
      setIsToggling(false);
    }
  }, [user, indicatorId, isToggling]);

  const handleMouseEnter = useCallback(() => {
    if (!user) {
      setShowTooltip(true);
    }
  }, [user]);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  // Show loading skeleton while loading
  if (loading) {
    return (
      <div className="h-9 w-48 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
    );
  }

  // Disabled state when not authenticated
  if (!user) {
    return (
      <div className="relative inline-block">
        <button
          disabled
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="cursor-not-allowed rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-600"
        >
          Add to Watchlist
        </button>
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
            Sign in to save
          </div>
        )}
      </div>
    );
  }

  // Authenticated state
  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        isWatching
          ? "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
      } ${isToggling ? "cursor-wait opacity-50" : ""}`}
      aria-busy={isToggling}
    >
      {isToggling ? (
        "Loading..."
      ) : isWatching ? (
        <>
          <span className="mr-1" aria-hidden="true">✓</span> Watching
        </>
      ) : (
        "Add to Watchlist"
      )}
    </button>
  );
}
