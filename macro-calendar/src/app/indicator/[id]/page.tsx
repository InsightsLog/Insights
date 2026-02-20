import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import type { Metadata } from "next";
import { WatchlistButton } from "@/app/components/WatchlistButton";
import { RevisionHistory } from "@/app/components/RevisionHistory";
import { ExportButton } from "@/app/components/ExportButton";
import { IndicatorChart } from "@/app/components/IndicatorChart";

// Zod schema for indicator validation
const indicatorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  country_code: z.string(),
  category: z.string(),
  source_name: z.string().nullable(),
  source_url: z.string().nullable(),
});

// Zod schema for revision record validation
const revisionRecordSchema = z.object({
  previous_actual: z.string(),
  new_actual: z.string(),
  revised_at: z.string(),
});

// Zod schema for historical release validation
const releaseSchema = z.object({
  id: z.string().uuid(),
  release_at: z.string(),
  period: z.string(),
  actual: z.string().nullable(),
  forecast: z.string().nullable(),
  consensus: z.string().nullable(),
  previous: z.string().nullable(),
  revised: z.string().nullable(),
  unit: z.string().nullable(),
  // .catch([]) handles null, undefined, or invalid data gracefully.
  // Unlike .default([]) which only handles undefined, .catch([])
  // handles any validation failure (e.g., null from database).
  revision_history: z.array(revisionRecordSchema).catch([]),
});

type Indicator = z.infer<typeof indicatorSchema>;
type Release = z.infer<typeof releaseSchema>;

type DataResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Fetches a single indicator by ID from the database.
 * Returns the indicator data or an error result.
 */
async function getIndicator(id: string): Promise<DataResult<Indicator>> {
  // Validate UUID format before querying
  const uuidResult = z.string().uuid().safeParse(id);
  if (!uuidResult.success) {
    return { success: false, error: "Invalid indicator ID format." };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("indicators")
    .select("id, name, country_code, category, source_name, source_url")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching indicator:", error);
    if (error.code === "PGRST116") {
      // Row not found
      return { success: false, error: "Indicator not found." };
    }
    return {
      success: false,
      error: "Unable to load indicator. Please try again.",
    };
  }

  // Validate the response with Zod
  const validated = indicatorSchema.safeParse(data);
  if (!validated.success) {
    console.error("Indicator validation failed:", validated.error);
    return {
      success: false,
      error: "Received invalid data format from database.",
    };
  }

  return { success: true, data: validated.data };
}

/**
 * Fetches historical releases for an indicator, ordered by release_at descending.
 * Limits to 200 rows per L0 spec (pagination deferred to later milestone).
 */
async function getHistoricalReleases(indicatorId: string): Promise<DataResult<Release[]>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("releases")
    .select("id, release_at, period, actual, forecast, consensus, previous, revised, unit, revision_history")
    .eq("indicator_id", indicatorId)
    .order("release_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Error fetching historical releases:", error);
    return {
      success: false,
      error: "Unable to load historical releases. Please try again.",
    };
  }

  // Validate the response with Zod
  const validated = z.array(releaseSchema).safeParse(data ?? []);
  if (!validated.success) {
    console.error("Releases validation failed:", validated.error);
    return {
      success: false,
      error: "Received invalid data format from database.",
    };
  }

  return { success: true, data: validated.data };
}

// Zod schema for upcoming release validation (no revision_history needed)
const upcomingReleaseSchema = z.object({
  id: z.string().uuid(),
  release_at: z.string(),
  period: z.string(),
  forecast: z.string().nullable(),
});

type UpcomingRelease = z.infer<typeof upcomingReleaseSchema>;

/**
 * Fetches the next 3 scheduled releases for an indicator.
 */
async function getUpcomingReleases(indicatorId: string): Promise<DataResult<UpcomingRelease[]>> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("releases")
    .select("id, release_at, period, forecast")
    .eq("indicator_id", indicatorId)
    .is("actual", null)
    .gte("release_at", now)
    .order("release_at", { ascending: true })
    .limit(3);

  if (error) {
    console.error("Error fetching upcoming releases:", error);
    return {
      success: false,
      error: "Unable to load upcoming releases. Please try again.",
    };
  }

  const validated = z.array(upcomingReleaseSchema).safeParse(data ?? []);
  if (!validated.success) {
    console.error("Upcoming releases validation failed:", validated.error);
    return {
      success: false,
      error: "Received invalid data format from database.",
    };
  }

  return { success: true, data: validated.data };
}

/**
 * Compares actual vs consensus numerically.
 * Returns 'beat' if actual > consensus, 'missed' if actual < consensus, null otherwise.
 */
function getActualVsConsensus(
  actual: string | null,
  consensus: string | null
): "beat" | "missed" | null {
  if (!actual || !consensus) return null;
  const a = parseFloat(actual);
  const c = parseFloat(consensus);
  if (isNaN(a) || isNaN(c)) return null;
  if (a > c) return "beat";
  if (a < c) return "missed";
  return null;
}

/**
 * Formats a release date/time for display.
 * Shows date and time in a readable format.
 */
function formatReleaseDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats a release date for the chart X-axis (compact).
 */
function formatChartDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/**
 * Builds chart data points from the last 12 historical releases that have actual values.
 * Releases are expected to be in descending order (newest first); chart shows oldest first.
 */
function buildChartData(
  releases: Release[]
): { date: string; value: number; consensus: number | null; period: string }[] {
  return releases
    .filter((r) => r.actual !== null)
    .slice(0, 12)
    .reverse()
    .flatMap((r) => {
      const num = parseFloat(r.actual!);
      if (isNaN(num)) return [];
      const consensusNum = r.consensus ? parseFloat(r.consensus) : null;
      return [{ date: formatChartDate(r.release_at), value: num, consensus: consensusNum !== null && !isNaN(consensusNum) ? consensusNum : null, period: r.period }];
    });
}

// Page props type for Next.js dynamic route
type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Generates dynamic metadata for the indicator detail page.
 * Fetches indicator name and country to create a meaningful page title.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getIndicator(id);

  if (!result.success) {
    return {
      title: "Indicator Not Found",
    };
  }

  const indicator = result.data;
  const title = `${indicator.name} (${indicator.country_code})`;
  const description = `View historical releases for ${indicator.name} - ${indicator.category} indicator from ${indicator.country_code}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Macro Calendar`,
      description,
    },
  };
}

export default async function IndicatorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getIndicator(id);

  if (!result.success) {
    if (result.error === "Indicator not found." || result.error === "Invalid indicator ID format.") {
      notFound();
    }
    // Show error state for other errors
    return (
      <main className="min-h-screen bg-[#0b0e11] px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="mb-4 inline-block text-blue-400 hover:underline"
          >
            ← Back to Calendar
          </Link>
          <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-4 text-red-400">
            {result.error}
          </div>
        </div>
      </main>
    );
  }

  const indicator = result.data;

  // Fetch historical releases and upcoming releases in parallel
  const [releasesResult, upcomingResult] = await Promise.all([
    getHistoricalReleases(id),
    getUpcomingReleases(id),
  ]);

  // Build chart data from last 12 historical releases with actual values
  const chartData = releasesResult.success
    ? buildChartData(releasesResult.data)
    : [];

  // Unit from most recent release that has one
  const unit = releasesResult.success
    ? (releasesResult.data.find((r) => r.unit)?.unit ?? null)
    : null;

  return (
    <main className="min-h-screen bg-[#0b0e11] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Back link */}
        <Link
          href="/"
          className="mb-4 inline-block text-blue-400 hover:underline"
        >
          ← Back to Calendar
        </Link>

        {/* Indicator Header */}
        <header className="mb-6 rounded-lg border border-[#1e2530] bg-[#0f1419] p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">
              {indicator.name}
            </h1>
            <WatchlistButton indicatorId={indicator.id} />
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
            <span>
              <span className="font-medium text-zinc-300">Country:</span>{" "}
              {indicator.country_code}
            </span>
            <span>
              <span className="font-medium text-zinc-300">Category:</span>{" "}
              {indicator.category}
            </span>
            {indicator.source_name && (
              <span>
                <span className="font-medium text-zinc-300">Source:</span>{" "}
                {indicator.source_url ? (
                  <a
                    href={indicator.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {indicator.source_name}
                  </a>
                ) : (
                  indicator.source_name
                )}
              </span>
            )}
          </div>
        </header>

        {/* Historical Chart */}
        <section className="mb-6 rounded-lg border border-[#1e2530] bg-[#0f1419] p-4 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-zinc-100 sm:text-lg">
            Historical Trend (last 12 releases)
          </h2>
          <IndicatorChart data={chartData} unit={unit} />
        </section>

        {/* Upcoming Releases */}
        <section className="mb-6 rounded-lg border border-[#1e2530] bg-[#0f1419] p-4 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-zinc-100 sm:text-lg">
            Upcoming Releases
          </h2>
          {!upcomingResult.success ? (
            <p className="text-sm text-red-400">{upcomingResult.error}</p>
          ) : upcomingResult.data.length === 0 ? (
            <p className="text-sm text-zinc-500">No upcoming releases scheduled.</p>
          ) : (
            <ul className="divide-y divide-[#1e2530]">
              {upcomingResult.data.map((release) => (
                <li key={release.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="text-zinc-300">{formatReleaseDate(release.release_at)}</span>
                  <span className="text-zinc-500">{release.period}</span>
                  <span className="text-zinc-400">
                    Forecast:{" "}
                    <span className="font-medium text-zinc-200">
                      {release.forecast ?? "—"}
                    </span>
                  </span>
                  <span className="inline-flex rounded-full bg-yellow-900/30 px-2 py-0.5 text-xs font-medium text-yellow-400">
                    scheduled
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Historical Releases Table */}
        <section className="mb-6 rounded-lg border border-[#1e2530] bg-[#0f1419] p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-zinc-100 sm:text-lg">
              Historical Releases
            </h2>
            {releasesResult.success && releasesResult.data.length > 0 && (
              <ExportButton
                downloadUrl={`/api/export/indicators/${indicator.id}`}
                label="Export History"
              />
            )}
          </div>

          {!releasesResult.success ? (
            <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-4 text-sm text-red-400">
              {releasesResult.error}
            </div>
          ) : releasesResult.data.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No historical releases available for this indicator.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-[#1e2530] bg-[#0b0e11] text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3 sm:px-0 sm:pr-4">Date</th>
                    <th className="px-4 py-3 sm:px-0 sm:pr-4">Period</th>
                    <th className="px-4 py-3 text-right sm:px-0 sm:pr-4">Actual</th>
                    <th className="px-4 py-3 text-right sm:px-0 sm:pr-4">Consensus</th>
                    <th className="px-4 py-3 text-right sm:px-0 sm:pr-4">Previous</th>
                    <th className="px-4 py-3 text-right sm:px-0">Revised</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2530]">
                  {releasesResult.data.map((release) => {
                    const vsConsensus = getActualVsConsensus(release.actual, release.consensus);
                    return (
                    <tr
                      key={release.id}
                      className="hover:bg-[#0b0e11]/60"
                    >
                      <td className="px-4 py-3 text-zinc-400 sm:px-0 sm:pr-4">
                        {formatReleaseDate(release.release_at)}
                      </td>
                      <td className="px-4 py-3 text-zinc-200 sm:px-0 sm:pr-4">
                        {release.period}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-0 sm:pr-4">
                        {release.actual ? (
                          <span
                            className={`font-semibold ${
                              vsConsensus === "beat"
                                ? "text-green-400"
                                : vsConsensus === "missed"
                                ? "text-red-400"
                                : "text-green-400"
                            }`}
                          >
                            {release.actual}
                            {release.unit && (
                              <span className="ml-1 font-normal text-zinc-500">
                                {release.unit}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-400 sm:px-0 sm:pr-4">
                        {release.consensus ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-400 sm:px-0 sm:pr-4">
                        {release.previous ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-400 sm:px-0">
                        {release.revised ?? "—"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {releasesResult.data.length >= 200 && (
                <p className="mt-4 px-4 text-xs text-zinc-600 sm:px-0">
                  Showing most recent 200 releases.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Revision History Section */}
        {releasesResult.success && (
          <section className="rounded-lg border border-[#1e2530] bg-[#0f1419] p-4 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-zinc-100 sm:text-lg">
              Revision History
            </h2>
            <RevisionHistory
              revisions={releasesResult.data.flatMap((release) => release.revision_history)}
            />
          </section>
        )}
      </div>
    </main>
  );
}
