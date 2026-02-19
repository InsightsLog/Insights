import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWatchlistWithAlertPreferences } from "@/app/actions/alert-preferences";
import { AlertPreferencesClient } from "./AlertPreferencesClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alert Preferences",
  description: "Configure email and push notification alerts per indicator",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Alert preferences settings page.
 * Requires authentication — redirects to home if not signed in.
 * Server component: fetches watchlist + alert preferences, then passes
 * the combined data to the interactive client component.
 */
export default async function AlertPreferencesPage() {
  const supabase = await createSupabaseServerClient();

  // Auth guard
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  // Fetch watchlist combined with current alert preferences
  const result = await getWatchlistWithAlertPreferences();

  return (
    <AlertPreferencesClient
      initialItems={result.success ? result.data : []}
      fetchError={result.success ? null : result.error}
    />
  );
}
