import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getIndicatorsForOnboarding } from "@/app/actions/onboarding";
import { OnboardingWizard } from "./OnboardingWizard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started",
  description: "Set up your Macro Calendar preferences",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Onboarding page — shown to new users after signup.
 * Redirects to / if not authenticated or onboarding already complete.
 * Fetches all indicators and delegates to the client-side wizard.
 */
export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();

  // Require authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  // If onboarding already done, send user to the calendar
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_complete) {
    redirect("/");
  }

  // Fetch indicators for the wizard (public data — shows empty list on error)
  const indicatorsResult = await getIndicatorsForOnboarding();
  const indicators = indicatorsResult.success ? indicatorsResult.data : [];

  return <OnboardingWizard indicators={indicators} />;
}
