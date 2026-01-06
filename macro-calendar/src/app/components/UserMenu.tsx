"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Client component that shows authentication state and sign in/out controls.
 * 
 * - When logged out: shows "Sign In" button
 * - When logged in: shows user email and "Sign Out" button
 * 
 * Uses Supabase client-side auth state subscription to stay reactive to changes.
 */
export function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseClient();

    // Get initial auth state
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    // The onAuthStateChange subscription will update the UI
  };

  // Show nothing while loading to prevent layout shift
  if (loading) {
    return (
      <div className="h-8 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {user.email}
        </span>
        <button
          onClick={handleSignOut}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        // T111 will add AuthModal that opens on click
        // For now, this is a placeholder button
      }}
      className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
    >
      Sign In
    </button>
  );
}
