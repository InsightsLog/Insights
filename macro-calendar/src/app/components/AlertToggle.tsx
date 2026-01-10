"use client";

import { useCallback, useState } from "react";
import { toggleEmailAlert } from "@/app/actions/alerts";

type AlertToggleProps = {
  indicatorId: string;
  initialEmailEnabled: boolean;
};

/**
 * Client component that allows users to toggle email alerts for an indicator.
 * 
 * States:
 * - Loading: shows loading indicator during toggle
 * - Enabled: shows enabled state (bell icon active)
 * - Disabled: shows disabled state (bell icon inactive)
 * 
 * Uses server action toggleEmailAlert to update preferences.
 */
export function AlertToggle({ indicatorId, initialEmailEnabled }: AlertToggleProps) {
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = useCallback(async () => {
    if (isToggling) return;

    setIsToggling(true);
    setError(null);

    try {
      const result = await toggleEmailAlert(indicatorId);
      
      if (result.success && result.data) {
        setEmailEnabled(result.data.email_enabled);
      } else if (!result.success) {
        console.error("Failed to toggle email alert:", result.error);
        setError(result.error);
        // Revert optimistic update if any
      }
    } catch (err) {
      console.error("Error toggling email alert:", err);
      setError("Failed to update alert preference");
    } finally {
      setIsToggling(false);
    }
  }, [indicatorId, isToggling]);

  // Show loading skeleton while toggling
  if (isToggling) {
    return (
      <button
        disabled
        className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
        aria-busy="true"
        aria-label="Loading alert status"
      >
        <span className="text-sm text-zinc-400 dark:text-zinc-500">⋯</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggle}
        className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
          emailEnabled
            ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
            : "border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        aria-label={emailEnabled ? "Disable email alerts" : "Enable email alerts"}
        title={emailEnabled ? "Email alerts enabled" : "Email alerts disabled"}
      >
        {emailEnabled ? (
          <svg
            className="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z" />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z" />
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.708-.708l10-10a.5.5 0 0 1 .708 0z" />
          </svg>
        )}
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
