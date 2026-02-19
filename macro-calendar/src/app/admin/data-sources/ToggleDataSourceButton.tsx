"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { toggleDataSource } from "@/app/actions/data-sources";

type ToggleDataSourceButtonProps = {
  dataSourceId: string;
  dataSourceName: string;
  initialEnabled: boolean;
};

/**
 * Client component that allows admins to enable/disable data sources.
 */
export function ToggleDataSourceButton({
  dataSourceId,
  dataSourceName,
  initialEnabled,
}: ToggleDataSourceButtonProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track component mount state
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleToggle = useCallback(async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    setError(null);

    try {
      const result = await toggleDataSource(dataSourceId);

      // Only update state if component is still mounted
      if (!isMountedRef.current) return;

      if (result.success) {
        setEnabled(result.data.enabled);
      } else {
        setError(result.error);
        // Reset to previous state on error
        setTimeout(() => {
          if (isMountedRef.current) {
            setError(null);
          }
        }, 3000);
      }
    } catch (err) {
      console.error("Error toggling data source:", err);
      if (isMountedRef.current) {
        setError("Failed to toggle data source");
        setTimeout(() => {
          if (isMountedRef.current) {
            setError(null);
          }
        }, 3000);
      }
    } finally {
      if (isMountedRef.current) {
        setIsUpdating(false);
      }
    }
  }, [dataSourceId, isUpdating]);

  if (error) {
    return (
      <span className="text-xs text-red-400" title={error}>
        Error
      </span>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isUpdating}
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium transition-colors ${
        enabled
          ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      } ${isUpdating ? "cursor-wait opacity-50" : "cursor-pointer"}`}
      title={`Click to ${enabled ? "disable" : "enable"} ${dataSourceName}`}
    >
      {isUpdating ? "..." : enabled ? "Enabled" : "Disabled"}
    </button>
  );
}
