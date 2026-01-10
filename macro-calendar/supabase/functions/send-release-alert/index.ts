/**
 * Edge Function: send-release-alert
 * This is a Deno-based Supabase Edge Function
 */

import { createClient } from "npm:@supabase/supabase-js@2";

// Deno-specific environment access
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  return new Response(JSON.stringify({ message: "Hello from Edge Function" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
