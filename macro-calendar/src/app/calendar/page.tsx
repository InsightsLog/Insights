import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { CalendarFilters } from "@/app/components/CalendarFilters";
import { RevisionBadge } from "@/app/components/RevisionBadge";
import { z } from "zod";
import Link from "next/link";

// Zod schemas for Supabase response validation
const indicatorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  country_code: z.string(),
  category: z.string(),
});

// Supabase returns embedded relations as arrays even for many-to-one relationships.
// This schema handles both array format (from Supabase) and single object format,
// transforming arrays to extract the first element.
const embeddedIndicatorSchema = z.union([
  indicatorSchema,
  z.array(indicatorSchema).transform((arr) => arr[0] ?? null),
]).nullable();

// Zod schema for revision record validation
const revisionRecordSchema = z.object({
  previous_actual: z.string(),
  new_actual: z.string(),
  revised_at: z.string(),
});

const releaseWithIndicatorSchema = z.object({
  id: z.string().uuid(),
  release_at: z.string(),
  period: z.string(),
  actual: z.string().nullable(),
  forecast: z.string().nullable(),
  previous: z.string().nullable(),
  revised: z.string().nullable(),
  // .catch([]) handles null, undefined, or invalid data gracefully.
  // Unlike .default([]) which only handles undefined, .catch([])
  // handles any validation failure (e.g., null from database).
  revision_history: z.array(revisionRecordSchema).catch([]),
  indicator: embeddedIndicatorSchema,
});

const filterOptionsSchema = z.object({
  countries: z.array(z.string()),
  categories: z.array(z.string()),
});

// Type for the joined release with indicator data
type ReleaseWithIndicator = z.infer<typeof releaseWithIndicatorSchema>;

type FilterOptions = z.infer<typeof filterOptionsSchema>;

type DataResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Fetches distinct country codes and categories from indicators table for filter dropdowns.
 */
async function getFilterOptions(): Promise<DataResult<FilterOptions>> {
  const supabase = await createSupabaseServerClient();

  const [countriesResult, categoriesResult] = await Promise.all([
    supabase.from("indicators").select("country_code").order("country_code"),
    supabase.from("indicators").select("category").order("category"),
  ]);

  // Check for errors
  if (countriesResult.error || categoriesResult.error) {
    console.error("Error fetching filter options:", countriesResult.error || categoriesResult.error);
    return {
      success: false,
      error: "Unable to load filter options. Please check your connection and try again."
    };
  }

  // Extract unique values
  const countries = [
    ...new Set(
      (countriesResult.data ?? []).map((row) => row.country_code).filter(Boolean)
    ),
  ];
  const categories = [
    ...new Set(
      (categoriesResult.data ?? []).map((row) => row.category).filter(Boolean)
    ),
  ];

  // Validate the response with Zod
  try {
    const validated = filterOptionsSchema.parse({ countries, categories });
    return { success: true, data: validated };
  } catch (zodError) {
    console.error("Filter options validation failed:", zodError);
    return {
      success: false,
      error: "Received invalid data format from database."
    };
  }
}

/**
 * Fetches releases scheduled within the next 30 days, joined with indicator data.
 * Optionally filters by country_code, category, search, and watchlist.
 * Returns releases ordered by release_at ascending.
 */
async function getUpcomingReleases(filters: {
  country?: string;
  category?: string;
  search?: string;
  watchlistOnly?: boolean;
  userId?: string;
}): Promise<DataResult<ReleaseWithIndicator[]>> {
  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // If filtering by watchlist, fetch user's watchlist indicator IDs first
  let watchlistIndicatorIds: string[] = [];
  if (filters.watchlistOnly && filters.userId) {
    const { data: watchlistData, error: watchlistError } = await supabase
      .from("watchlist")
      .select("indicator_id")
      .eq("user_id", filters.userId);

    if (watchlistError) {
      console.error("Error fetching watchlist:", watchlistError);
      return {
        success: false,
        error: "Unable to load watchlist data. Please check your connection and try again."
      };
    }

    watchlistIndicatorIds = watchlistData.map(row => row.indicator_id);

    // If watchlist is empty, return empty results early
    if (watchlistIndicatorIds.length === 0) {
      return { success: true, data: [] };
    }
  }

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
      revised,
      revision_history,
      indicator:indicators!inner (
        id,
        name,
        country_code,
        category
      )
    `
    )
    .gte("release_at", now.toISOString())
    .lte("release_at", thirtyDaysFromNow.toISOString());

  // Apply watchlist filter
  if (filters.watchlistOnly && watchlistIndicatorIds.length > 0) {
    query = query.in("indicator_id", watchlistIndicatorIds);
  }

  // Apply filters on the joined indicators table
  if (filters.country) {
    query = query.eq("indicator.country_code", filters.country);
  }
  if (filters.category) {
    query = query.eq("indicator.category", filters.category);
  }
  if (filters.search) {
    // Case-insensitive search on indicator name using ilike
    // SQL injection safe: Supabase uses parameterized queries internally,
    // treating the search string as a literal value, not executable SQL
    query = query.ilike("indicator.name", `%${filters.search}%`);
  }

  const { data, error } = await query.order("release_at", { ascending: true });

  if (error) {
    console.error("Error fetching releases:", error);
    return {
      success: false,
      error: "Unable to load calendar data. Please check your connection and try again."
    };
  }

  // Validate the response with Zod
  try {
    const validated = z.array(releaseWithIndicatorSchema).parse(data ?? []);
    return { success: true, data: validated };
  } catch (zodError) {
    console.error("Release data validation failed:", zodError);
    return {
      success: false,
      error: "Received invalid data format from database."
    };
  }
}

/**
 * Determines release status based on whether actual value exists.
 */
function getReleaseStatus(actual: string | null): "released" | "scheduled" {
  return actual ? "released" : "scheduled";
}

/**
 * Formats release time from ISO8601 string to human-readable format.
 * 
 * Timezone assumptions:
 * - Input: ISO8601 timestamp from Supabase (stored in UTC)
 * - Output: Formatted using en-US locale in the user's browser timezone
 * - The Date constructor automatically converts UTC to local time
 */
function formatReleaseTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PageProps = {
  searchParams: Promise<{ country?: string; category?: string; search?: string; watchlist?: string }>;
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  
  const filters = {
    country: params.country,
    category: params.category,
    search: params.search,
    watchlistOnly: params.watchlist === "true",
    userId: user?.id,
  };

  const [releasesResult, filterOptionsResult] = await Promise.all([
    getUpcomingReleases(filters),
    getFilterOptions(),
  ]);

  // Check for errors
  const hasError = !releasesResult.success || !filterOptionsResult.success;
  const errorMessage = !releasesResult.success 
    ? releasesResult.error 
    : !filterOptionsResult.success 
    ? filterOptionsResult.error 
    : null;

  const releases = releasesResult.success ? releasesResult.data : [];
  const filterOptions = filterOptionsResult.success 
    ? filterOptionsResult.data 
    : { countries: [], categories: [] };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-6">
        {/* Filters — T022 */}
        <CalendarFilters
          countries={filterOptions.countries}
          categories={filterOptions.categories}
          isAuthenticated={!!user}
        />

        {/* Search placeholder — T023 */}

        {/* Error message */}
        {hasError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              {errorMessage}
            </p>
          </div>
        )}

        {/* Mobile scroll hint */}
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400 sm:hidden" aria-hidden="true">
          Scroll horizontally to see all columns
        </p>

        <div className="-mx-2 overflow-x-auto sm:mx-0 sm:rounded-lg sm:border sm:border-zinc-200 sm:dark:border-zinc-800">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-lg sm:border-y-0">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:px-4 sm:py-3">
                      Time
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:px-4 sm:py-3">
                      Country
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:px-4 sm:py-3">
                      Indicator
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:px-4 sm:py-3">
                      Period
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:px-4 sm:py-3">
                      Actual
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:px-4 sm:py-3">
                      Forecast
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:px-4 sm:py-3">
                      Previous
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:px-4 sm:py-3">
                      Revised
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:px-4 sm:py-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {releases.length === 0 && !hasError ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <div className="text-zinc-400 dark:text-zinc-500">
                          <svg
                            className="mx-auto mb-4 h-12 w-12"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            No upcoming releases
                          </p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                            {filters.country || filters.category || filters.search
                              ? "Try adjusting your filters or search terms."
                              : "No economic releases scheduled for the next 30 days."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    releases.map((release) => {
                      const status = getReleaseStatus(release.actual);

                      return (
                        <tr
                          key={release.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        >
                          <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-900 dark:text-zinc-100 sm:px-4 sm:py-3 sm:text-sm">
                            {formatReleaseTime(release.release_at)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400 sm:px-4 sm:py-3 sm:text-sm">
                            {release.indicator?.country_code ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 sm:px-4 sm:py-3 sm:text-sm">
                            <div className="flex items-center gap-1 sm:gap-2">
                              {release.indicator ? (
                                <Link
                                  href={`/indicator/${release.indicator.id}`}
                                  className="text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  {release.indicator.name}
                                </Link>
                              ) : (
                                "Unknown"
                              )}
                              <RevisionBadge revisions={release.revision_history} />
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400 sm:px-4 sm:py-3 sm:text-sm">
                            {release.period}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm">
                            {release.actual ? (
                              <span className="font-semibold text-green-700 dark:text-green-400">
                                {release.actual}
                              </span>
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400 sm:px-4 sm:py-3 sm:text-sm">
                            {release.forecast ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400 sm:px-4 sm:py-3 sm:text-sm">
                            {release.previous ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400 sm:px-4 sm:py-3 sm:text-sm">
                            {release.revised ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm">
                            <span
                              className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium sm:px-2 sm:py-1 ${
                                status === "released"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
