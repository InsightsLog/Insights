import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import Link from "next/link";
import { SignInButton } from "./components/SignInButton";

export default async function LandingPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/calendar");
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-zinc-100">
      <main className="mx-auto max-w-4xl px-6 py-20 sm:py-32">
        {/* Hero */}
        <div className="mb-16 text-center">
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-zinc-100 sm:text-6xl">
            The macro calendar<br />
            <span className="text-blue-400">built for traders</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400 sm:text-xl">
            Track CPI, NFP, GDP, and 100+ economic releases. Get alerts before
            market-moving events. Never miss a data release again.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/calendar"
              className="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0b0e11]"
            >
              View Calendar
            </Link>
            <SignInButton
              className="rounded-lg border border-[#1e2530] bg-[#0f1419] px-8 py-3 text-base font-semibold text-zinc-300 hover:bg-[#1e2530] focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-[#0b0e11]"
            >
              Sign Up Free
            </SignInButton>
          </div>
        </div>

        {/* Feature bullets */}
        <div className="mb-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ),
              title: "Live Release Calendar",
              description: "Upcoming economic releases with forecast, previous, and actual values — updated in real time.",
            },
            {
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              ),
              title: "Smart Alerts",
              description: "Get notified before high-impact releases on your watchlist. Email and push notifications.",
            },
            {
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              ),
              title: "Personal Watchlist",
              description: "Save the indicators you care about. Filter the calendar to your watchlist with one click.",
            },
            {
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ),
              title: "Historical Data",
              description: "Access years of release history with revision tracking and trend charts for every indicator.",
            },
            {
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              ),
              title: "REST API & Webhooks",
              description: "Integrate release data into your own tools. Versioned API with per-key rate limits and webhooks.",
            },
            {
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              ),
              title: "Calendar Export",
              description: "Export releases to iCal, Google Calendar, or Outlook. Keep your trading calendar in sync.",
            },
          ].map(({ icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-[#1e2530] bg-[#0f1419] p-6"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900/40 text-blue-400">
                {icon}
              </div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">{title}</h3>
              <p className="text-sm text-zinc-400">{description}</p>
            </div>
          ))}
        </div>

        {/* CTA footer */}
        <div className="rounded-xl border border-[#1e2530] bg-[#0f1419] p-8 text-center">
          <h2 className="mb-3 text-2xl font-bold text-zinc-100">
            Start tracking macro events today
          </h2>
          <p className="mb-6 text-zinc-400">
            Free to sign up. No credit card required.
          </p>
          <Link
            href="/calendar"
            className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f1419]"
          >
            Open Calendar →
          </Link>
        </div>
      </main>
    </div>
  );
}
