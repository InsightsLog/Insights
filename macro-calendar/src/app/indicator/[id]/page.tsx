import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import type { Metadata } from "next";
import { WatchlistButton } from "@/app/components/WatchlistButton";
import { AlertToggle } from "@/app/components/AlertToggle";

// Zod schema for indicator validation
const indicatorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  country_code: z.string(),
  category: z.string(),
  source_name: z.string().nullable(),
  source_url: z.string().nullable(),
});

// Zod schema for historical release validation
const releaseSchema = z.object({
  id: z.string().uuid(),
  release_at: z.string(),
  period: z.string(),
  actual: z.string().nullable(),
  forecast: z.string().nullable(),
  previous: z.string().nullable(),
  revised: z.string().nullable(),
  unit: z.string().nullable(),
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
 * Fetches the alert preference status for the current user and indicator.
 * Returns false if user is not authenticated or preference doesn't exist.
 */
async function getAlertPreferenceStatus(indicatorId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  // Fetch alert preference for this indicator
  const { data } = await supabase
    .from("alert_preferences")
    .select("email_enabled")
    .eq("user_id", user.id)
    .eq("indicator_id", indicatorId)
    .maybeSingle();

  return data?.email_enabled ?? false;
}

/**
 * Fetches historical releases for an indicator, ordered by release_at descending.
 * Limits to 200 rows per L0 spec (pagination deferred to later milestone).
 */
async function getHistoricalReleases(indicatorId: string): Promise<DataResult<Release[]>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("releases")
    .select("id, release_at, period, actual, forecast, previous, revised, unit")
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
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="text-blue-600 hover:underline mb-4 inline-block"
          >
            ← Back to Calendar
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            {result.error}
          </div>
        </div>
      </main>
    );
  }

  const indicator = result.data;
  
  // Fetch user authentication status and alert preference in parallel with historical releases
  const [user, emailAlertEnabled, releasesResult] = await Promise.all([
    getCurrentUser(),
    getAlertPreferenceStatus(id),
    getHistoricalReleases(id),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Back to Calendar
        </Link>

        {/* Indicator Header */}
        <header className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {indicator.name}
            </h1>
            <div className="flex items-center gap-3">
              {user && (
                <AlertToggle
                  indicatorId={indicator.id}
                  initialEmailEnabled={emailAlertEnabled}
                />
              )}
              <WatchlistButton indicatorId={indicator.id} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium text-gray-700">Country:</span>{" "}
              {indicator.country_code}
            </div>
            <div>
              <span className="font-medium text-gray-700">Category:</span>{" "}
              {indicator.category}
            </div>
            {indicator.source_name && (
              <div>
                <span className="font-medium text-gray-700">Source:</span>{" "}
                {indicator.source_url ? (
                  <a
                    href={indicator.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {indicator.source_name}
                  </a>
                ) : (
                  indicator.source_name
                )}
              </div>
            )}
          </div>
        </header>

        {/* Historical Releases Table */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Historical Releases
          </h2>
          
          {!releasesResult.success ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {releasesResult.error}
            </div>
          ) : releasesResult.data.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No historical releases available for this indicator.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Period</th>
                    <th className="pb-3 pr-4 font-medium text-right">Actual</th>
                    <th className="pb-3 pr-4 font-medium text-right">Forecast</th>
                    <th className="pb-3 pr-4 font-medium text-right">Previous</th>
                    <th className="pb-3 font-medium text-right">Revised</th>
                  </tr>
                </thead>
                <tbody>
                  {releasesResult.data.map((release) => (
                    <tr
                      key={release.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 pr-4 text-gray-600">
                        {formatReleaseDate(release.release_at)}
                      </td>
                      <td className="py-3 pr-4 text-gray-900">
                        {release.period}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {release.actual ? (
                          <span className="font-semibold text-green-700">
                            {release.actual}
                            {release.unit && <span className="text-gray-500 font-normal ml-1">{release.unit}</span>}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-600">
                        {release.forecast ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-600">
                        {release.previous ?? "—"}
                      </td>
                      <td className="py-3 text-right text-gray-600">
                        {release.revised ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {releasesResult.data.length >= 200 && (
                <p className="text-gray-500 text-xs mt-4">
                  Showing most recent 200 releases.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
