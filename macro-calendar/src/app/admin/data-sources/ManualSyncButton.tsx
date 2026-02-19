"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { getServerEnv } from "@/lib/env";

type ManualSyncButtonProps = {
  dataSourceId: string;
  dataSourceName: string;
};

/**
 * Client component that triggers a manual sync for a data source.
 * Calls the sync-release-schedules edge function.
 */
export function ManualSyncButton({
  dataSourceId,
  dataSourceName,
}: ManualSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Ref to track component mount state
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setError(null);
    setSuccess(false);

    try {
      // Call the sync-release-schedules edge function
      // Note: This is a placeholder - the actual edge function URL will be determined at runtime
      const response = await fetch("/api/admin/sync-data-source", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dataSourceId }),
      });

      if (!isMountedRef.current) return;

      if (response.ok) {
        setSuccess(true);
        // Hide success message after 3 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setSuccess(false);
          }
        }, 3000);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        setError(errorData.error || "Sync failed");
        setTimeout(() => {
          if (isMountedRef.current) {
            setError(null);
          }
        }, 3000);
      }
    } catch (err) {
      console.error("Error triggering sync:", err);
      if (isMountedRef.current) {
        setError("Failed to trigger sync");
        setTimeout(() => {
          if (isMountedRef.current) {
            setError(null);
          }
        }, 3000);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [dataSourceId, isSyncing]);

  if (error) {
    return (
      <span className="text-xs text-red-400" title={error}>
        {error}
      </span>
    );
  }

  if (success) {
    return (
      <span className="text-xs text-green-400">
        Sync started
      </span>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`text-xs text-blue-600 hover:underline dark:text-blue-400 ${
        isSyncing ? "cursor-wait opacity-50" : "cursor-pointer"
      }`}
      title={`Trigger manual sync for ${dataSourceName}`}
    >
      {isSyncing ? "Syncing..." : "Sync Now"}
    </button>
  );
}
