"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
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
 * - When logged out: shows "Sign In" button that opens AuthModal and API Docs link
 * - When logged in: shows user email, settings dropdown, and "Sign Out" button
 * 
 * Uses Supabase client-side auth state subscription to stay reactive to changes.
 * Receives initial auth state from server to prevent layout shift during hydration.
 */
export function UserMenu({ initialUser }: UserMenuProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside - only attach listener when dropdown is open
  useEffect(() => {
    if (!settingsOpen) return;
    
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsOpen]);

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

  const toggleSettings = useCallback(() => {
    setSettingsOpen((prev) => !prev);
  }, []);

  // Use initial user state to prevent layout shift during hydration
  // Once client-side auth state is loaded, always use that instead
  const currentUser = isInitialized ? user : initialUser;
  const displayEmail = currentUser?.email;

  if (currentUser && displayEmail) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <span 
          className="max-w-[150px] truncate text-xs text-zinc-600 dark:text-zinc-400 sm:max-w-none sm:text-sm"
          title={displayEmail}
        >
          {displayEmail}
        </span>
        
        {/* Settings Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={toggleSettings}
            aria-expanded={settingsOpen}
            aria-haspopup="menu"
            className="flex-shrink-0 rounded-md border border-zinc-300 bg-white p-1.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:p-2"
            title="Settings"
          >
            <svg 
              className="h-4 w-4 sm:h-5 sm:w-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
              />
            </svg>
          </button>
          
          {settingsOpen && (
            <div 
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
            >
              <Link
                href="/docs/api"
                role="menuitem"
                onClick={() => setSettingsOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                API Documentation
              </Link>
              <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" role="separator" />
              <Link
                href="/settings/api-keys"
                role="menuitem"
                onClick={() => setSettingsOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                API Keys
              </Link>
              <Link
                href="/settings/webhooks"
                role="menuitem"
                onClick={() => setSettingsOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Webhooks
              </Link>
              <Link
                href="/settings/billing"
                role="menuitem"
                onClick={() => setSettingsOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Billing
              </Link>
              <Link
                href="/watchlist"
                role="menuitem"
                onClick={() => setSettingsOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                My Watchlist
              </Link>
            </div>
          )}
        </div>
        
        <button
          onClick={handleSignOut}
          className="flex-shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // When logged out, show API docs link and sign in button
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        href="/docs/api"
        className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 sm:text-sm"
      >
        API Docs
      </Link>
      <button
        onClick={handleOpenAuthModal}
        className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Sign In
      </button>
      <AuthModal isOpen={authModalOpen} onClose={handleCloseAuthModal} />
    </div>
  );
}
