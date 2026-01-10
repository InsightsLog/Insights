import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Get the Supabase service role key.
 * Validates the key exists and throws a clear error if missing.
 */
function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
  }
  return key;
}

/**
 * Creates a Supabase client with service role permissions.
 * This client bypasses Row Level Security (RLS) and should be used with extreme caution.
 * 
 * **Use cases:**
 * - Unauthenticated operations that need to modify user data (e.g., email unsubscribe)
 * - Admin operations that need to bypass RLS
 * 
 * **Security notes:**
 * - Never expose service role key to the client
 * - Always validate input thoroughly before using this client
 * - Use only for operations that absolutely require bypassing RLS
 * 
 * @returns Supabase client with service role permissions
 */
export function createSupabaseServiceClient() {
  const serviceRoleKey = getServiceRoleKey();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
