"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { AuthModal } from "./AuthModal";
import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/supabase/auth";

type UserMenuProps = {
  initialUser: UserProfile | null;
};

/**
 * Client component that shows authentication state and sign in/out controls.
 * 
 * - When logged out: shows "Sign In" button that opens AuthModal
 * - When logged in: shows user email and "Sign Out" button
 * 
 * Uses Supabase client-side auth state subscription to stay reactive to changes.
 * Receives initial auth state from server to prevent layout shift during hydration.
 */
export function UserMenu({ initialUser }: UserMenuProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Memoize the Supabase client to reuse across effect and handlers
  const supabase = useMemo(() => createSupabaseClient(), []);

  useEffect(() => {
    // Get initial auth state with error handling
    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        setUser(user);
        setIsInitialized(true);
      })
      .catch(() => {
        // On error, treat as logged out
        setUser(null);
        setIsInitialized(true);
      });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // The onAuthStateChange subscription will update the UI
  };

  const handleOpenAuthModal = useCallback(() => {
    setAuthModalOpen(true);
  }, []);

  const handleCloseAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  // Use initial user state to prevent layout shift during hydration
  // Once client-side auth state is loaded, always use that instead
  const currentUser = isInitialized ? user : initialUser;
  const displayEmail = currentUser?.email;

  if (currentUser && displayEmail) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="max-w-[150px] truncate text-xs text-zinc-600 dark:text-zinc-400 sm:max-w-none sm:text-sm">
          {displayEmail}
        </span>
        <button
          onClick={handleSignOut}
          className="flex-shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleOpenAuthModal}
        className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Sign In
      </button>
      <AuthModal isOpen={authModalOpen} onClose={handleCloseAuthModal} />
    </>
  );
}
