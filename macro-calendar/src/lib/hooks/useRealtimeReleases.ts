/**
 * Real-time releases subscription hook
 *
 * Provides sub-second updates for releases table changes via Supabase Realtime.
 * Database changes propagate to all connected clients in < 500ms.
 *
 * Usage:
 *   const { latestUpdate, isConnected } = useRealtimeReleases();
 *
 * Task: T400.2 - Create useRealtimeReleases React hook for live updates
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Release update payload from Supabase Realtime.
 */
export interface ReleaseUpdate {
  id: string;
  indicator_id: string;
  release_at: string;
  period: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  timestamp: Date;
}

/**
 * Hook return type.
 */
export interface UseRealtimeReleasesResult {
  /** Latest update received from Supabase Realtime */
  latestUpdate: ReleaseUpdate | null;
  /** Whether the WebSocket connection is active */
  isConnected: boolean;
  /** Number of updates received since hook mounted */
  updateCount: number;
  /** Time since last update in milliseconds */
  timeSinceLastUpdate: number | null;
}

/**
 * React hook for real-time releases updates.
 *
 * Subscribes to Supabase Realtime for the releases table and provides
 * instant updates when releases are inserted, updated, or deleted.
 *
 * @returns Object with latestUpdate, isConnected, updateCount, and timeSinceLastUpdate
 */
export function useRealtimeReleases(): UseRealtimeReleasesResult {
  const [latestUpdate, setLatestUpdate] = useState<ReleaseUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [timeSinceLastUpdate, setTimeSinceLastUpdate] = useState<number | null>(null);

  // Update time since last update every second
  useEffect(() => {
    if (!latestUpdate) return;

    const interval = setInterval(() => {
      setTimeSinceLastUpdate(Date.now() - latestUpdate.timestamp.getTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [latestUpdate]);

  // Handle incoming realtime payload
  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
      const record = eventType === "DELETE" ? payload.old : payload.new;

      if (!record || typeof record !== "object") return;

      const update: ReleaseUpdate = {
        id: (record as Record<string, unknown>).id as string,
        indicator_id: (record as Record<string, unknown>).indicator_id as string,
        release_at: (record as Record<string, unknown>).release_at as string,
        period: (record as Record<string, unknown>).period as string,
        actual: (record as Record<string, unknown>).actual as string | null,
        forecast: (record as Record<string, unknown>).forecast as string | null,
        previous: (record as Record<string, unknown>).previous as string | null,
        eventType,
        timestamp: new Date(),
      };

      setLatestUpdate(update);
      setUpdateCount((prev) => prev + 1);
      setTimeSinceLastUpdate(0);
    },
    []
  );

  useEffect(() => {
    const supabase = createSupabaseClient();
    let channel: RealtimeChannel | null = null;

    // Subscribe to releases table changes
    channel = supabase
      .channel("releases-realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "releases",
        },
        handlePayload
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    // Cleanup on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [handlePayload]);

  return {
    latestUpdate,
    isConnected,
    updateCount,
    timeSinceLastUpdate,
  };
}

/**
 * Hook for real-time indicator updates.
 *
 * Similar to useRealtimeReleases but for the indicators table.
 */
export function useRealtimeIndicators() {
  const [isConnected, setIsConnected] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    const supabase = createSupabaseClient();
    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel("indicators-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "indicators",
        },
        () => {
          setUpdateCount((prev) => prev + 1);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return { isConnected, updateCount };
}
