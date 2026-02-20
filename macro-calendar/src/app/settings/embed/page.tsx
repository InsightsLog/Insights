import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmbedWidgetClient } from "./EmbedWidgetClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Embed Widget",
  description: "Generate an embeddable iframe widget for your website",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Embed widget settings page.
 * Requires authentication - redirects to home if not logged in.
 */
export default async function EmbedPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://insights-econ-watchs-projects.vercel.app";

  return <EmbedWidgetClient defaultBaseUrl={baseUrl} />;
}
