// Static placeholder data for T020 — will be replaced with DB query in T021
const placeholderReleases = [
  {
    id: "1",
    releaseAt: "2026-01-06T13:30:00Z",
    countryCode: "US",
    indicatorName: "CPI (YoY)",
    period: "Dec 2025",
    forecast: "2.8%",
    previous: "2.7%",
    status: "scheduled",
  },
  {
    id: "2",
    releaseAt: "2026-01-07T10:00:00Z",
    countryCode: "EU",
    indicatorName: "GDP (QoQ)",
    period: "Q4 2025",
    forecast: "0.3%",
    previous: "0.4%",
    status: "scheduled",
  },
  {
    id: "3",
    releaseAt: "2026-01-08T07:00:00Z",
    countryCode: "GB",
    indicatorName: "Retail Sales (MoM)",
    period: "Dec 2025",
    forecast: "0.5%",
    previous: "0.2%",
    status: "scheduled",
  },
  {
    id: "4",
    releaseAt: "2026-01-05T08:30:00Z",
    countryCode: "US",
    indicatorName: "Non-Farm Payrolls",
    period: "Dec 2025",
    forecast: "180K",
    previous: "227K",
    status: "released",
  },
];

function formatReleaseTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CalendarPage() {
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
        {/* Filters placeholder — T022 */}
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
                  Forecast / Previous
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {placeholderReleases.map((release) => (
                <tr
                  key={release.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                    {formatReleaseTime(release.releaseAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {release.countryCode}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {release.indicatorName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {release.period}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {release.forecast} / {release.previous}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        release.status === "released"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {release.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
