import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WebhooksClient } from "./WebhooksClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Webhooks",
  description: "Manage your webhook endpoints for release notifications",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Webhook management settings page.
 * Requires authentication - redirects to home if not logged in.
 */
export default async function WebhooksPage() {
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

  return <WebhooksClient />;
}
