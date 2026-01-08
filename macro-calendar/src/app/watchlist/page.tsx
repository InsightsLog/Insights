import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Watchlist",
  description: "View your saved macroeconomic indicators",
};

// Zod schema for watchlist item with indicator and next release
const watchlistItemSchema = z.object({
  id: z.string().uuid(),
  indicator_id: z.string().uuid(),
  indicator: z.object({
    id: z.string().uuid(),
    name: z.string(),
    country_code: z.string(),
    category: z.string(),
  }).nullable(),
  next_release: z.object({
    release_at: z.string(),
    period: z.string(),
  }).nullable(),
});

type WatchlistItem = z.infer<typeof watchlistItemSchema>;

type DataResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Fetches the current user's watchlist with indicator details and next release date.
 * Returns empty array if user is not authenticated.
 */
async function getUserWatchlist(): Promise<DataResult<WatchlistItem[]>> {
  const supabase = await createSupabaseServerClient();

  // Check if user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch watchlist items with indicator details
  const { data: watchlistData, error: watchlistError } = await supabase
    .from("watchlist")
    .select(`
      id,
      indicator_id,
      indicator:indicators (
        id,
        name,
        country_code,
        category
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (watchlistError) {
    console.error("Error fetching watchlist:", watchlistError);
    return {
      success: false,
      error: "Unable to load watchlist. Please try again.",
    };
  }

  // Fetch next releases for all indicators in one query
  const indicatorIds = (watchlistData ?? []).map(item => item.indicator_id);
  const { data: releasesData } = await supabase
    .from("releases")
    .select("indicator_id, release_at, period")
    .in("indicator_id", indicatorIds)
    .gte("release_at", new Date().toISOString())
    .order("release_at", { ascending: true });

  // Group releases by indicator_id and take the first (next) one for each
  const nextReleasesByIndicator = new Map<string, { release_at: string; period: string }>();
  for (const release of releasesData ?? []) {
    if (!nextReleasesByIndicator.has(release.indicator_id)) {
      nextReleasesByIndicator.set(release.indicator_id, {
        release_at: release.release_at,
        period: release.period,
      });
    }
  }

  // Combine watchlist items with their next releases
  const watchlistWithReleases = (watchlistData ?? []).map((item) => ({
    ...item,
    next_release: nextReleasesByIndicator.get(item.indicator_id) ?? null,
  }));

  // Validate the response with Zod
  try {
    const validated = z.array(watchlistItemSchema).parse(watchlistWithReleases);
    return { success: true, data: validated };
  } catch (zodError) {
    console.error("Watchlist data validation failed:", zodError);
    return {
      success: false,
      error: "Received invalid data format from database.",
    };
  }
}

/**
 * Formats release time from ISO8601 string to human-readable format.
 */
function formatReleaseTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function WatchlistPage() {
  // Fetch user's watchlist (includes authentication check)
  const result = await getUserWatchlist();

  // Redirect to home if not authenticated
  if (!result.success && result.error === "Not authenticated") {
    redirect("/");
  }

  // Handle errors
  if (!result.success) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <main className="mx-auto max-w-5xl px-4 py-6">
          <div className="mb-6">
            <Link
              href="/"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              ← Back to Calendar
            </Link>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              {result.error}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const watchlistItems = result.data;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to Calendar
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            My Watchlist
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Track your saved macroeconomic indicators
          </p>
        </div>

        {/* Empty state */}
        {watchlistItems.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-12 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              <h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                No indicators saved
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Start watching indicators from the calendar to track their releases.
              </p>
              <div className="mt-6">
                <Link
                  href="/"
                  className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Browse Calendar
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Watchlist table */
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Indicator
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Country
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Next Release
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Period
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {watchlistItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {item.indicator ? (
                        <Link
                          href={`/indicator/${item.indicator.id}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {item.indicator.name}
                        </Link>
                      ) : (
                        "Unknown"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {item.indicator?.country_code ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {item.indicator?.category ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {item.next_release
                        ? formatReleaseTime(item.next_release.release_at)
                        : "No upcoming release"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {item.next_release?.period ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
