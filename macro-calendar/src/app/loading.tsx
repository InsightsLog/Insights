/**
 * Loading skeleton for the Calendar page.
 * Displayed automatically by Next.js while the page is loading data.
 */
export default function CalendarLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Filters skeleton */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="h-9 w-32 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-9 w-32 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-9 w-48 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
        </div>

        {/* Table skeleton */}
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {/* Table header skeleton */}
          <div className="flex gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800">
            {[80, 60, 120, 60, 60, 60, 60, 60, 70].map((width, i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-600"
                style={{ width }}
              />
            ))}
          </div>

          {/* Table rows skeleton */}
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="flex gap-4 border-b border-zinc-100 px-4 py-3 last:border-0 dark:border-zinc-800"
            >
              {[80, 40, 140, 60, 50, 50, 50, 50, 70].map((width, colIndex) => (
                <div
                  key={colIndex}
                  className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700"
                  style={{ width, animationDelay: `${(rowIndex * 50 + colIndex * 20)}ms` }}
                />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
