import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Data structure for a request log entry.
 * Matches the request_logs table schema.
 */
export interface RequestLogEntry {
  ip: string;
  user_id?: string | null;
  endpoint: string;
  response_code: number;
}

/**
 * Database row structure for request_logs table insert.
 */
interface RequestLogInsert {
  ip: string;
  user_id: string | null;
  endpoint: string;
  response_code: number;
}

/**
 * Cached Supabase client for request logging.
 * Uses service role to bypass RLS and write to request_logs table.
 * Cached to avoid creating new clients on every request.
 */
let loggingClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client for request logging.
 * Returns null if service role key is not configured.
 * 
 * Note: This is a lightweight client specifically for logging.
 * We use a separate client from the main app to avoid coupling.
 */
function getLoggingClient(): SupabaseClient | null {
  if (loggingClient) {
    return loggingClient;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    // Service role key not configured, logging not available
    return null;
  }

  loggingClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return loggingClient;
}

/**
 * Log a request to the request_logs table for abuse detection.
 * This function is designed to be called asynchronously via context.waitUntil()
 * to avoid blocking the response.
 * 
 * **Important:** This function should never throw errors that affect the request.
 * All errors are caught and logged to console.
 * 
 * @param entry - The request log entry to save
 * @returns Promise that resolves when logging is complete (or fails silently)
 */
export async function logRequest(entry: RequestLogEntry): Promise<void> {
  try {
    const client = getLoggingClient();
    if (!client) {
      // Logging not configured, skip silently
      return;
    }

    const insertData: RequestLogInsert = {
      ip: entry.ip,
      user_id: entry.user_id ?? null,
      endpoint: entry.endpoint,
      response_code: entry.response_code,
    };

    const { error } = await client.from("request_logs").insert(insertData);

    if (error) {
      // Log to console but don't throw - logging should never break the app
      console.error("[request-logger] Failed to log request:", error.message);
    }
  } catch (err) {
    // Catch any unexpected errors - logging should never break the app
    console.error("[request-logger] Unexpected error:", err);
  }
}

/**
 * Create a request log entry from request data.
 * Utility function to construct a properly typed entry.
 * 
 * @param ip - Client IP address
 * @param endpoint - Request path/endpoint
 * @param responseCode - HTTP response status code
 * @param userId - Optional authenticated user ID
 * @returns RequestLogEntry ready for logging
 */
export function createLogEntry(
  ip: string,
  endpoint: string,
  responseCode: number,
  userId?: string | null
): RequestLogEntry {
  return {
    ip,
    endpoint,
    response_code: responseCode,
    user_id: userId,
  };
}
