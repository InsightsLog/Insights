/**
 * Loading skeleton for the Indicator Detail page.
 * Displayed automatically by Next.js while the page is loading data.
 */
export default function IndicatorDetailLoading() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back link skeleton */}
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200 mb-4" />

        {/* Indicator Header skeleton */}
        <header className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="h-7 w-64 animate-pulse rounded bg-gray-200 mb-4" />
          <div className="flex flex-wrap gap-4">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
          </div>
        </header>

        {/* Historical Releases Table skeleton */}
        <section className="bg-white rounded-lg shadow p-6">
          <div className="h-6 w-40 animate-pulse rounded bg-gray-200 mb-4" />

          {/* Table header skeleton */}
          <div className="border-b border-gray-200 pb-3 mb-2">
            <div className="flex gap-4">
              {[100, 80, 60, 60, 60, 60].map((width, i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded bg-gray-200"
                  style={{ width }}
                />
              ))}
            </div>
          </div>

          {/* Table rows skeleton */}
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="flex gap-4 border-b border-gray-100 py-3 last:border-0"
            >
              {[120, 80, 50, 50, 50, 50].map((width, colIndex) => (
                <div
                  key={colIndex}
                  className="h-4 animate-pulse rounded bg-gray-100"
                  style={{ width, animationDelay: `${(rowIndex * 40 + colIndex * 15)}ms` }}
                />
              ))}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
