"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { z } from "zod";

/**
 * Schema for validating email input.
 * Uses Zod for consistent validation with the rest of the codebase.
 */
const emailSchema = z.string().email("Please enter a valid email address");

interface AuthModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
}

/**
 * Modal component for magic link sign-in.
 *
 * Features:
 * - Email input with validation
 * - Magic link sign-in via Supabase
 * - Success/error state handling
 * - Keyboard accessible (Escape to close)
 * - Backdrop click to close
 */
export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Memoize the Supabase client
  const supabase = useMemo(() => createSupabaseClient(), []);

  // Reset form state when closing the modal
  const handleClose = useCallback(() => {
    setEmail("");
    setError(null);
    setSuccess(false);
    setLoading(false);
    onClose();
  }, [onClose]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validate email
      const validation = emailSchema.safeParse(email);
      if (!validation.success) {
        setError(validation.error.issues[0].message);
        return;
      }

      setLoading(true);

      // Send magic link via Supabase
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Redirect to /auth/callback after clicking the magic link
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      setLoading(false);

      if (signInError) {
        setError(signInError.message);
        return;
      }

      setSuccess(true);
    },
    [email, supabase]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking the backdrop, not the modal content
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-800">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="auth-modal-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Sign In
          </h2>
          <button
            onClick={handleClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-green-600 dark:text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Check your email
            </h3>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              We sent a magic link to <strong>{email}</strong>. Click the link
              in the email to sign in.
            </p>
            <button
              onClick={handleClose}
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              Enter your email address and we&apos;ll send you a magic link to
              sign in.
            </p>

            <form onSubmit={handleSubmit}>
              <label
                htmlFor="email-input"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email address
              </label>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mb-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-400"
                disabled={loading}
                autoComplete="email"
                autoFocus
              />

              {error && (
                <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Magic Link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
