import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PushNotificationsClient } from "./PushNotificationsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Push Notifications",
  description: "Manage browser push notifications for release alerts",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Push notifications settings page.
 * Requires authentication - redirects to home if not logged in.
 * Task: T420
 */
export default async function PushNotificationsPage() {
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

  return <PushNotificationsClient />;
}
