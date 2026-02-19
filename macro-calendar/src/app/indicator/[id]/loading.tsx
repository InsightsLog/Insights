/**
 * Loading skeleton for the Indicator Detail page.
 * Displayed automatically by Next.js while the page is loading data.
 */
export default function IndicatorDetailLoading() {
  return (
    <main className="min-h-screen bg-[#0b0e11] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Back link skeleton */}
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-zinc-800" />

        {/* Indicator Header skeleton */}
        <header className="mb-6 rounded-lg border border-[#1e2530] bg-[#0f1419] p-4 sm:p-6">
          <div className="mb-3 h-7 w-64 animate-pulse rounded bg-zinc-700" />
          <div className="flex flex-wrap gap-4">
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
          </div>
        </header>

        {/* Chart skeleton */}
        <section className="mb-6 rounded-lg border border-[#1e2530] bg-[#0f1419] p-4 sm:p-6">
          <div className="mb-4 h-5 w-48 animate-pulse rounded bg-zinc-700" />
          <div className="h-60 w-full animate-pulse rounded bg-zinc-800" />
        </section>

        {/* Upcoming releases skeleton */}
        <section className="mb-6 rounded-lg border border-[#1e2530] bg-[#0f1419] p-4 sm:p-6">
          <div className="mb-4 h-5 w-40 animate-pulse rounded bg-zinc-700" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-[#1e2530] py-3 last:border-0">
              <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
              <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
            </div>
          ))}
        </section>

        {/* Historical Releases Table skeleton */}
        <section className="rounded-lg border border-[#1e2530] bg-[#0f1419] p-4 sm:p-6">
          <div className="mb-4 h-6 w-40 animate-pulse rounded bg-zinc-700" />
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="flex gap-4 border-b border-[#1e2530] py-3 last:border-0"
            >
              {[120, 80, 50, 50, 50, 50].map((width, colIndex) => (
                <div
                  key={colIndex}
                  className="h-4 animate-pulse rounded bg-zinc-800"
                  style={{ width, animationDelay: `${rowIndex * 40 + colIndex * 15}ms` }}
                />
              ))}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
