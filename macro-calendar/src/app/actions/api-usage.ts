"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * Daily usage data point for charts.
 */
export interface DailyUsage {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Number of API calls on this date */
  count: number;
  /** Average response time in ms (null if no calls) */
  avg_response_time_ms: number | null;
}

/**
 * Usage breakdown by endpoint.
 */
export interface EndpointUsage {
  /** Endpoint path (e.g., '/api/v1/indicators') */
  endpoint: string;
  /** Number of API calls to this endpoint */
  count: number;
  /** Average response time in ms */
  avg_response_time_ms: number | null;
}

/**
 * API key usage statistics.
 */
export interface ApiKeyUsageStats {
  /** Total API calls in the period */
  total_calls: number;
  /** Total API calls with successful response (2xx) */
  successful_calls: number;
  /** Total API calls with error response (4xx, 5xx) */
  error_calls: number;
  /** Average response time in ms */
  avg_response_time_ms: number | null;
  /** Daily usage breakdown for charts */
  daily_usage: DailyUsage[];
  /** Usage breakdown by endpoint */
  endpoint_usage: EndpointUsage[];
  /** Period start date */
  period_start: string;
  /** Period end date */
  period_end: string;
}

/**
 * Result type for API usage actions.
 */
export type ApiUsageActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Schema for validating API key ID
const apiKeyIdSchema = z.string().uuid("Invalid API key ID");

// Schema for validating period (days)
const periodSchema = z.coerce.number().int().min(1).max(90).default(30);

/**
 * Get usage statistics for a specific API key.
 *
 * @param keyId - The ID of the API key
 * @param days - Number of days to include (default 30, max 90)
 * @returns Usage statistics or error
 *
 * Task: T314 - Add API usage tracking
 */
export async function getApiKeyUsage(
  keyId: string,
  days: number = 30
): Promise<ApiUsageActionResult<ApiKeyUsageStats>> {
  // Validate inputs
  const keyIdResult = apiKeyIdSchema.safeParse(keyId);
  if (!keyIdResult.success) {
    return { success: false, error: "Invalid API key ID" };
  }

  const periodResult = periodSchema.safeParse(days);
  if (!periodResult.success) {
    return { success: false, error: "Invalid period (must be 1-90 days)" };
  }

  const validatedDays = periodResult.data;

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify the API key belongs to the user
  const { data: keyData, error: keyError } = await supabase
    .from("api_keys")
    .select("id, user_id")
    .eq("id", keyId)
    .single();

  if (keyError || !keyData) {
    return { success: false, error: "API key not found" };
  }

  if (keyData.user_id !== user.id) {
    return { success: false, error: "API key not found" };
  }

  // Calculate period dates
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - validatedDays);

  const periodStart = startDate.toISOString().split("T")[0];
  const periodEnd = endDate.toISOString().split("T")[0];

  // Fetch usage data from request_logs
  const { data: usageData, error: usageError } = await supabase
    .from("request_logs")
    .select("endpoint, response_code, response_time_ms, created_at")
    .eq("api_key_id", keyId)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });

  if (usageError) {
    console.error("Failed to fetch API usage:", usageError);
    return { success: false, error: "Failed to fetch usage data" };
  }

  const logs = usageData ?? [];

  // Calculate totals
  const totalCalls = logs.length;
  const successfulCalls = logs.filter(
    (l) => l.response_code >= 200 && l.response_code < 300
  ).length;
  const errorCalls = logs.filter((l) => l.response_code >= 400).length;

  // Calculate average response time
  const responseTimes = logs
    .map((l) => l.response_time_ms)
    .filter((t): t is number => t !== null);
  const avgResponseTimeMs =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        )
      : null;

  // Calculate daily usage
  const dailyMap = new Map<
    string,
    { count: number; responseTimes: number[] }
  >();

  // Initialize all days in the period with zero counts
  // Use a counter-based loop to avoid date mutation issues with DST
  const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateKey = d.toISOString().split("T")[0];
    dailyMap.set(dateKey, { count: 0, responseTimes: [] });
  }

  // Fill in actual usage
  for (const log of logs) {
    const dateKey = log.created_at.split("T")[0];
    const existing = dailyMap.get(dateKey);
    if (existing) {
      existing.count += 1;
      if (log.response_time_ms !== null) {
        existing.responseTimes.push(log.response_time_ms);
      }
    }
  }

  const dailyUsage: DailyUsage[] = Array.from(dailyMap.entries()).map(
    ([date, data]) => ({
      date,
      count: data.count,
      avg_response_time_ms:
        data.responseTimes.length > 0
          ? Math.round(
              data.responseTimes.reduce((a, b) => a + b, 0) /
                data.responseTimes.length
            )
          : null,
    })
  );

  // Calculate endpoint usage
  const endpointMap = new Map<
    string,
    { count: number; responseTimes: number[] }
  >();

  for (const log of logs) {
    const existing = endpointMap.get(log.endpoint) ?? {
      count: 0,
      responseTimes: [],
    };
    existing.count += 1;
    if (log.response_time_ms !== null) {
      existing.responseTimes.push(log.response_time_ms);
    }
    endpointMap.set(log.endpoint, existing);
  }

  const endpointUsage: EndpointUsage[] = Array.from(endpointMap.entries())
    .map(([endpoint, data]) => ({
      endpoint,
      count: data.count,
      avg_response_time_ms:
        data.responseTimes.length > 0
          ? Math.round(
              data.responseTimes.reduce((a, b) => a + b, 0) /
                data.responseTimes.length
            )
          : null,
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending

  const stats: ApiKeyUsageStats = {
    total_calls: totalCalls,
    successful_calls: successfulCalls,
    error_calls: errorCalls,
    avg_response_time_ms: avgResponseTimeMs,
    daily_usage: dailyUsage,
    endpoint_usage: endpointUsage,
    period_start: periodStart,
    period_end: periodEnd,
  };

  return { success: true, data: stats };
}

/**
 * Get aggregated usage statistics for all API keys belonging to the current user.
 *
 * @param days - Number of days to include (default 30, max 90)
 * @returns Aggregated usage statistics or error
 *
 * Task: T314 - Add API usage tracking
 */
export async function getAllApiKeysUsage(
  days: number = 30
): Promise<ApiUsageActionResult<ApiKeyUsageStats>> {
  const periodResult = periodSchema.safeParse(days);
  if (!periodResult.success) {
    return { success: false, error: "Invalid period (must be 1-90 days)" };
  }

  const validatedDays = periodResult.data;

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get all API keys for the user
  const { data: keys, error: keysError } = await supabase
    .from("api_keys")
    .select("id")
    .eq("user_id", user.id);

  if (keysError) {
    return { success: false, error: "Failed to fetch API keys" };
  }

  if (!keys || keys.length === 0) {
    // No keys, return empty stats
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - validatedDays);

    return {
      success: true,
      data: {
        total_calls: 0,
        successful_calls: 0,
        error_calls: 0,
        avg_response_time_ms: null,
        daily_usage: [],
        endpoint_usage: [],
        period_start: startDate.toISOString().split("T")[0],
        period_end: endDate.toISOString().split("T")[0],
      },
    };
  }

  // Calculate period dates
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - validatedDays);

  const periodStart = startDate.toISOString().split("T")[0];
  const periodEnd = endDate.toISOString().split("T")[0];

  // Fetch usage data for all user's API keys
  const keyIds = keys.map((k) => k.id);
  const { data: usageData, error: usageError } = await supabase
    .from("request_logs")
    .select("endpoint, response_code, response_time_ms, created_at")
    .in("api_key_id", keyIds)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });

  if (usageError) {
    console.error("Failed to fetch API usage:", usageError);
    return { success: false, error: "Failed to fetch usage data" };
  }

  const logs = usageData ?? [];

  // Calculate totals
  const totalCalls = logs.length;
  const successfulCalls = logs.filter(
    (l) => l.response_code >= 200 && l.response_code < 300
  ).length;
  const errorCalls = logs.filter((l) => l.response_code >= 400).length;

  // Calculate average response time
  const responseTimes = logs
    .map((l) => l.response_time_ms)
    .filter((t): t is number => t !== null);
  const avgResponseTimeMs =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        )
      : null;

  // Calculate daily usage
  const dailyMap = new Map<
    string,
    { count: number; responseTimes: number[] }
  >();

  // Initialize all days in the period
  // Use a counter-based loop to avoid date mutation issues with DST
  const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateKey = d.toISOString().split("T")[0];
    dailyMap.set(dateKey, { count: 0, responseTimes: [] });
  }

  // Fill in actual usage
  for (const log of logs) {
    const dateKey = log.created_at.split("T")[0];
    const existing = dailyMap.get(dateKey);
    if (existing) {
      existing.count += 1;
      if (log.response_time_ms !== null) {
        existing.responseTimes.push(log.response_time_ms);
      }
    }
  }

  const dailyUsage: DailyUsage[] = Array.from(dailyMap.entries()).map(
    ([date, data]) => ({
      date,
      count: data.count,
      avg_response_time_ms:
        data.responseTimes.length > 0
          ? Math.round(
              data.responseTimes.reduce((a, b) => a + b, 0) /
                data.responseTimes.length
            )
          : null,
    })
  );

  // Calculate endpoint usage
  const endpointMap = new Map<
    string,
    { count: number; responseTimes: number[] }
  >();

  for (const log of logs) {
    const existing = endpointMap.get(log.endpoint) ?? {
      count: 0,
      responseTimes: [],
    };
    existing.count += 1;
    if (log.response_time_ms !== null) {
      existing.responseTimes.push(log.response_time_ms);
    }
    endpointMap.set(log.endpoint, existing);
  }

  const endpointUsage: EndpointUsage[] = Array.from(endpointMap.entries())
    .map(([endpoint, data]) => ({
      endpoint,
      count: data.count,
      avg_response_time_ms:
        data.responseTimes.length > 0
          ? Math.round(
              data.responseTimes.reduce((a, b) => a + b, 0) /
                data.responseTimes.length
            )
          : null,
    }))
    .sort((a, b) => b.count - a.count);

  const stats: ApiKeyUsageStats = {
    total_calls: totalCalls,
    successful_calls: successfulCalls,
    error_calls: errorCalls,
    avg_response_time_ms: avgResponseTimeMs,
    daily_usage: dailyUsage,
    endpoint_usage: endpointUsage,
    period_start: periodStart,
    period_end: periodEnd,
  };

  return { success: true, data: stats };
}
