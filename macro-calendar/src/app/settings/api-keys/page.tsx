import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApiKeysClient } from "./ApiKeysClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Keys",
  description: "Manage your API keys for programmatic access",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * API Keys settings page.
 * Requires authentication - redirects to home if not logged in.
 */
export default async function ApiKeysPage() {
  const supabase = await createSupabaseServerClient();

  // Check if user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Redirect to home if not authenticated
  if (authError || !user) {
    redirect("/");
  }

  return <ApiKeysClient userId={user.id} />;
}
