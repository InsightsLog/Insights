import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CalendarFilters } from "./components/CalendarFilters";

// Type for the joined release with indicator data
type ReleaseWithIndicator = {
  id: string;
  release_at: string;
  period: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  revised: string | null;
  indicator: {
    id: string;
    name: string;
    country_code: string;
    category: string;
  } | null;
};

type FilterOptions = {
  countries: string[];
  categories: string[];
};

/**
 * Fetches distinct country codes and categories from indicators table for filter dropdowns.
 */
async function getFilterOptions(): Promise<FilterOptions> {
  const supabase = await createSupabaseServerClient();

  const [countriesResult, categoriesResult] = await Promise.all([
    supabase.from("indicators").select("country_code").order("country_code"),
    supabase.from("indicators").select("category").order("category"),
  ]);

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

  return { countries, categories };
}

/**
 * Fetches releases scheduled within the next 7 days, joined with indicator data.
 * Optionally filters by country_code and/or category.
 * Returns releases ordered by release_at ascending.
 */
async function getUpcomingReleases(filters: {
  country?: string;
  category?: string;
  search?: string;
}): Promise<ReleaseWithIndicator[]> {
  const supabase = await createSupabaseServerClient();

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
      revised,
      indicator:indicators!inner (
        id,
        name,
        country_code,
        category
      )
    `
    )
    .gte("release_at", now.toISOString())
    .lte("release_at", sevenDaysFromNow.toISOString());

  // Apply filters on the joined indicators table
  if (filters.country) {
    query = query.eq("indicator.country_code", filters.country);
  }
  if (filters.category) {
    query = query.eq("indicator.category", filters.category);
  }
  if (filters.search) {
    // Case-insensitive search on indicator name using ilike
    query = query.ilike("indicator.name", `%${filters.search}%`);
  }

  const { data, error } = await query.order("release_at", { ascending: true });

  if (error) {
    console.error("Error fetching releases:", error);
    return [];
  }

  // Cast the data to our expected type
  return (data as unknown as ReleaseWithIndicator[]) ?? [];
}

/**
 * Determines release status based on whether actual value exists.
 */
function getReleaseStatus(actual: string | null): "released" | "scheduled" {
  return actual ? "released" : "scheduled";
}

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
  searchParams: Promise<{ country?: string; category?: string; search?: string }>;
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    country: params.country,
    category: params.category,
    search: params.search,
  };

  const [releases, filterOptions] = await Promise.all([
    getUpcomingReleases(filters),
    getFilterOptions(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Macro Calendar
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Upcoming economic releases — next 7 days
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Filters — T022 */}
        <CalendarFilters
          countries={filterOptions.countries}
          categories={filterOptions.categories}
        />

        {/* Search placeholder — T023 */}

        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Country
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Indicator
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Period
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Actual
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Forecast
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Previous
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Revised
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {releases.map((release) => {
                const status = getReleaseStatus(release.actual);

                return (
                  <tr
                    key={release.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                      {formatReleaseTime(release.release_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {release.indicator?.country_code ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {release.indicator?.name ?? "Unknown"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {release.period}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {release.actual ? (
                        <span className="font-semibold text-green-700 dark:text-green-400">
                          {release.actual}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {release.forecast ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {release.previous ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {release.revised ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
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
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
