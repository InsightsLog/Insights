/**
 * /widget/calendar — Embeddable calendar widget
 *
 * Stripped-down calendar view for embedding in external sites.
 * - No navigation, no authentication required
 * - Shows next 7 days of releases
 * - Supports query params: countries=US,EU  impact=high  theme=dark|light
 *
 * Task: T510
 */

import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { z } from "zod";

// Cache for 5 minutes (public, no user-specific data)
export const revalidate = 300;

export const metadata = {
  title: "Macro Calendar Widget",
  robots: { index: false, follow: false },
};

const indicatorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  country_code: z.string(),
  importance: z.string(),
});

const releaseSchema = z.object({
  id: z.string().uuid(),
  release_at: z.string(),
  period: z.string(),
  actual: z.string().nullable(),
  forecast: z.string().nullable(),
  previous: z.string().nullable(),
  indicator: z.union([
    indicatorSchema,
    z.array(indicatorSchema).transform((arr) => arr[0] ?? null),
  ]).nullable(),
});

type Release = z.infer<typeof releaseSchema>;

const queryParamsSchema = z.object({
  countries: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
        : []
    ),
  impact: z
    .enum(["high", "medium", "low", "all"])
    .optional()
    .default("all"),
  theme: z.enum(["dark", "light"]).optional().default("light"),
});

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function impactColor(importance: string, theme: "dark" | "light"): string {
  if (importance === "high") {
    return theme === "dark" ? "text-red-400" : "text-red-600";
  }
  if (importance === "medium") {
    return theme === "dark" ? "text-yellow-400" : "text-yellow-600";
  }
  return theme === "dark" ? "text-zinc-400" : "text-zinc-500";
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WidgetCalendarPage({ searchParams }: PageProps) {
  const raw = await searchParams;

  // Parse and validate query params
  const parsed = queryParamsSchema.safeParse({
    countries: typeof raw.countries === "string" ? raw.countries : undefined,
    impact: typeof raw.impact === "string" ? raw.impact : undefined,
    theme: typeof raw.theme === "string" ? raw.theme : undefined,
  });

  const { countries, impact, theme } = parsed.success
    ? parsed.data
    : { countries: [], impact: "all" as const, theme: "light" as const };

  const supabase = createSupabaseServiceClient();

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let query = supabase
    .from("releases")
    .select(
      `
      id,
      release_at,
      period,
      actual,
      forecast,
      previous,
      indicator:indicators!inner (
        id,
        name,
        country_code,
        importance
      )
    `
    )
    .gte("release_at", now.toISOString())
    .lte("release_at", sevenDaysFromNow.toISOString())
    .order("release_at", { ascending: true })
    .limit(50);

  // Filter by impact level
  if (impact !== "all") {
    query = query.eq("indicator.importance", impact);
  }

  const { data, error } = await query;

  let releases: Release[] = [];

  if (!error && data) {
    const parseResult = z.array(releaseSchema).safeParse(data);
    if (parseResult.success) {
      releases = parseResult.data;
    }
  }

  // Filter by country client-side after fetch (Supabase join filters are applied above)
  if (countries.length > 0) {
    releases = releases.filter(
      (r) => r.indicator && countries.includes(r.indicator.country_code)
    );
  }

  // Theme classes
  const bg = theme === "dark" ? "bg-[#0b0e11]" : "bg-white";
  const textPrimary = theme === "dark" ? "text-zinc-100" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-500";
  const borderColor = theme === "dark" ? "border-[#1e2530]" : "border-zinc-200";
  const headerBg = theme === "dark" ? "bg-[#0f1419]" : "bg-zinc-50";
  const rowHover = theme === "dark" ? "hover:bg-[#0f1419]" : "hover:bg-zinc-50";
  const divideColor = theme === "dark" ? "divide-[#1e2530]" : "divide-zinc-200";

  return (
    <div className={`${bg} min-h-screen`}>
      <div className={`px-3 py-2 border-b ${borderColor} flex items-center justify-between`}>
        <span className={`text-xs font-semibold ${textPrimary}`}>
          Macro Calendar
        </span>
        <span className={`text-xs ${textSecondary}`}>
          Next 7 days
          {countries.length > 0 && ` · ${countries.join(", ")}`}
          {impact !== "all" && ` · ${impact} impact`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className={`min-w-full divide-y ${divideColor}`}>
          <thead className={headerBg}>
            <tr>
              <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                Time
              </th>
              <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                Ctry
              </th>
              <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                Indicator
              </th>
              <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                Fcst
              </th>
              <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                Prev
              </th>
              <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                Actual
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${divideColor}`}>
            {releases.length === 0 ? (
              <tr>
                <td colSpan={6} className={`px-3 py-8 text-center text-sm ${textSecondary}`}>
                  No upcoming releases
                </td>
              </tr>
            ) : (
              releases.map((release) => (
                <tr key={release.id} className={rowHover}>
                  <td className={`whitespace-nowrap px-3 py-2 text-xs ${textSecondary}`}>
                    {formatTime(release.release_at)}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-xs font-medium ${textSecondary}`}>
                    {release.indicator?.country_code ?? "—"}
                  </td>
                  <td className={`px-3 py-2 text-xs font-medium ${textPrimary}`}>
                    <span>{release.indicator?.name ?? "Unknown"}</span>
                    {release.indicator && (
                      <span className={`ml-1 text-xs ${impactColor(release.indicator.importance, theme)}`}>
                        ●
                      </span>
                    )}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-xs ${textSecondary}`}>
                    {release.forecast ?? "—"}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-xs ${textSecondary}`}>
                    {release.previous ?? "—"}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-xs font-semibold`}>
                    {release.actual ? (
                      <span className="text-green-500">{release.actual}</span>
                    ) : (
                      <span className={textSecondary}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={`px-3 py-1.5 border-t ${borderColor} text-right`}>
        <a
          href="https://insights-econ-watchs-projects.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs ${textSecondary} hover:underline`}
        >
          powered by Macro Calendar
        </a>
      </div>
    </div>
  );
}
