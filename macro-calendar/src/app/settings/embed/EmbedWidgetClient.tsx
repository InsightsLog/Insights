"use client";

import { useState, useCallback } from "react";

interface EmbedWidgetClientProps {
  defaultBaseUrl: string;
}

/**
 * Client component for the embed widget settings page.
 * Lets users configure widget options and generates the embed snippet.
 */
export function EmbedWidgetClient({ defaultBaseUrl }: EmbedWidgetClientProps) {
  const [countries, setCountries] = useState("");
  const [impact, setImpact] = useState<"all" | "high" | "medium" | "low">("all");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [height, setHeight] = useState(400);
  const [copied, setCopied] = useState(false);

  const widgetParams = new URLSearchParams();
  if (countries.trim()) widgetParams.set("countries", countries.trim());
  if (impact !== "all") widgetParams.set("impact", impact);
  if (theme !== "light") widgetParams.set("theme", theme);

  const widgetUrl = `${defaultBaseUrl}/widget/calendar${widgetParams.size > 0 ? `?${widgetParams.toString()}` : ""}`;

  const snippet = `<iframe\n  src="${widgetUrl}"\n  width="100%"\n  height="${height}"\n  frameborder="0"\n  title="Macro Economic Calendar"\n  style="border:none;overflow:hidden;"\n  loading="lazy"\n></iframe>`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const ta = document.createElement("textarea");
      ta.value = snippet;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [snippet]);

  return (
    <div className="min-h-screen bg-[#0b0e11] text-zinc-100">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold text-zinc-100">Embed Widget</h1>
        <p className="mb-8 text-sm text-zinc-400">
          Add the macro calendar to any website with a simple iframe snippet.
        </p>

        {/* Configuration */}
        <section className="mb-6 rounded-xl border border-[#1e2530] bg-[#0f1419] p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Configure
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="countries" className="mb-1 block text-xs font-medium text-zinc-300">
                Countries
              </label>
              <input
                id="countries"
                type="text"
                placeholder="US,EU,GB"
                value={countries}
                onChange={(e) => setCountries(e.target.value)}
                className="w-full rounded-lg border border-[#1e2530] bg-[#0b0e11] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Comma-separated country codes, e.g. US,EU
              </p>
            </div>
            <div>
              <label htmlFor="impact" className="mb-1 block text-xs font-medium text-zinc-300">
                Impact level
              </label>
              <select
                id="impact"
                value={impact}
                onChange={(e) =>
                  setImpact(e.target.value as "all" | "high" | "medium" | "low")
                }
                className="w-full rounded-lg border border-[#1e2530] bg-[#0b0e11] px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="high">High only</option>
                <option value="medium">Medium only</option>
                <option value="low">Low only</option>
              </select>
            </div>
            <div>
              <label htmlFor="theme" className="mb-1 block text-xs font-medium text-zinc-300">
                Theme
              </label>
              <select
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value as "light" | "dark")}
                className="w-full rounded-lg border border-[#1e2530] bg-[#0b0e11] px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div>
              <label htmlFor="height" className="mb-1 block text-xs font-medium text-zinc-300">
                Height (px)
              </label>
              <input
                id="height"
                type="number"
                min={100}
                max={2000}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full rounded-lg border border-[#1e2530] bg-[#0b0e11] px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        {/* Embed code */}
        <section className="mb-6 rounded-xl border border-[#1e2530] bg-[#0f1419] p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Embed Code
            </h2>
            <button
              onClick={handleCopy}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f1419]"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-[#1e2530] bg-[#0b0e11] p-4 text-xs leading-relaxed text-zinc-300">
            <code>{snippet}</code>
          </pre>
        </section>

        {/* Live preview */}
        <section className="rounded-xl border border-[#1e2530] bg-[#0f1419] p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Preview
          </h2>
          <div className="overflow-hidden rounded-lg border border-[#1e2530]">
            <iframe
              src={widgetUrl}
              width="100%"
              height={height}
              title="Macro Economic Calendar Preview"
              style={{ border: "none", overflow: "hidden", display: "block" }}
              loading="lazy"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
