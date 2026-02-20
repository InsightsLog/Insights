import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://insights-econ-watchs-projects.vercel.app";

/**
 * Generates robots.txt for the application.
 * Allows crawling of public pages and disallows private sections.
 * Next.js serves this at /robots.txt automatically.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/calendar", "/indicator/", "/docs/api"],
        disallow: ["/admin", "/settings", "/api/", "/org/", "/watchlist", "/onboarding"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
