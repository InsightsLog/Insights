import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://insights-econ-watchs-projects.vercel.app";

/**
 * Generates the sitemap for the application.
 * Lists public pages and all indicator detail pages.
 * Next.js serves this at /sitemap.xml automatically.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/calendar`,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/docs/api`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Fetch all public indicator IDs for dynamic routes
  let indicatorEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("indicators")
      .select("id")
      .order("name", { ascending: true });

    if (data) {
      indicatorEntries = data.map((indicator) => ({
        url: `${BASE_URL}/indicator/${indicator.id}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    }
  } catch {
    // If the DB is unavailable during build, return static pages only
  }

  return [...staticPages, ...indicatorEntries];
}
