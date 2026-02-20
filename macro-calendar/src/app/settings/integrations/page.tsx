import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { IntegrationsClient } from "./IntegrationsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect Slack and other services to receive release alerts",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Integrations settings page.
 * Requires authentication - redirects to home if not logged in.
 */
export default async function IntegrationsPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  return <IntegrationsClient />;
}
