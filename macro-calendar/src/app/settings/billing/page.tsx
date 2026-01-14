import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BillingClient } from "./BillingClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage your subscription and billing",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Billing settings page.
 * Shows current plan, usage, and upgrade options.
 * Requires authentication - redirects to home if not logged in.
 *
 * Task: T323 - Add billing page
 */
export default async function BillingPage() {
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

  return <BillingClient />;
}
