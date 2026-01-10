import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { getServerEnv } from "@/lib/env";

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
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
