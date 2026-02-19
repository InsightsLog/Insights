"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/actions/onboarding";
import type { IndicatorForOnboarding } from "@/app/actions/onboarding";

type Props = {
  indicators: IndicatorForOnboarding[];
};

const IMPORTANCE_LEVELS = ["high", "medium", "low"] as const;
type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number];

const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  high: "High — major market-moving (CPI, NFP, GDP, FOMC)",
  medium: "Medium — notable indicators tracked by analysts",
  low: "Low — supplementary / niche indicators",
};

const IMPORTANCE_COLORS: Record<ImportanceLevel, string> = {
  high: "text-red-400",
  medium: "text-yellow-400",
  low: "text-zinc-400",
};

/**
 * Three-step onboarding wizard.
 * Step 1: Choose countries of interest.
 * Step 2: Choose importance / impact levels.
 * Step 3: Pick specific indicators to add to the watchlist.
 */
export function OnboardingWizard({ indicators }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(1);
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(
    new Set()
  );
  const [selectedImportance, setSelectedImportance] = useState<
    Set<ImportanceLevel>
  >(new Set(IMPORTANCE_LEVELS));
  const [selectedIndicators, setSelectedIndicators] = useState<Set<string>>(
    new Set()
  );
  const [enableAlerts, setEnableAlerts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive unique country codes from indicators
  const countries = useMemo(
    () => [...new Set(indicators.map((i) => i.country_code))].sort(),
    [indicators]
  );

  // Indicators filtered by user's country + importance selections
  const filteredIndicators = useMemo(() => {
    return indicators.filter((ind) => {
      const countryOk =
        selectedCountries.size === 0 ||
        selectedCountries.has(ind.country_code);
      const importanceOk = selectedImportance.has(
        ind.importance as ImportanceLevel
      );
      return countryOk && importanceOk;
    });
  }, [indicators, selectedCountries, selectedImportance]);

  function toggleCountry(code: string) {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  function toggleImportance(level: ImportanceLevel) {
    setSelectedImportance((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  function toggleIndicator(id: string) {
    setSelectedIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIndicators(
      (prev) => new Set([...prev, ...filteredIndicators.map((i) => i.id)])
    );
  }

  function deselectAllFiltered() {
    const filteredIds = new Set(filteredIndicators.map((i) => i.id));
    setSelectedIndicators(
      (prev) => new Set([...prev].filter((id) => !filteredIds.has(id)))
    );
  }

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding(
        [...selectedIndicators],
        enableAlerts
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  const totalSteps = 3;

  return (
    <div className="min-h-screen bg-[#0b0e11] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-100 sm:text-3xl">
            Welcome to Macro Calendar
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Personalize your experience in a few quick steps.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  s === step
                    ? "bg-blue-600 text-white"
                    : s < step
                    ? "bg-blue-900 text-blue-300"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {s}
              </div>
              {s < totalSteps && (
                <div
                  className={`h-0.5 w-8 ${
                    s < step ? "bg-blue-600" : "bg-zinc-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step card */}
        <div className="rounded-xl border border-[#1e2530] bg-[#0f1419] p-6 sm:p-8">
          {/* ----- Step 1: Countries ----- */}
          {step === 1 && (
            <>
              <h2 className="mb-1 text-lg font-semibold text-zinc-100">
                Which countries do you follow?
              </h2>
              <p className="mb-6 text-sm text-zinc-400">
                Select the countries whose economic indicators interest you most.
                Leave all unselected to see all countries.
              </p>

              {countries.length === 0 ? (
                <p className="text-sm text-zinc-500">No countries available.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {countries.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleCountry(code)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        selectedCountries.has(code)
                          ? "border-blue-500 bg-blue-900/40 text-blue-300"
                          : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700"
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ----- Step 2: Impact levels ----- */}
          {step === 2 && (
            <>
              <h2 className="mb-1 text-lg font-semibold text-zinc-100">
                Which impact levels matter to you?
              </h2>
              <p className="mb-6 text-sm text-zinc-400">
                Select the indicator importance levels you want to track.
              </p>

              <div className="space-y-3">
                {IMPORTANCE_LEVELS.map((level) => (
                  <label
                    key={level}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                      selectedImportance.has(level)
                        ? "border-blue-500 bg-blue-900/20"
                        : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedImportance.has(level)}
                      onChange={() => toggleImportance(level)}
                      className="mt-0.5 h-4 w-4 rounded border-zinc-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span
                        className={`text-sm font-semibold capitalize ${IMPORTANCE_COLORS[level]}`}
                      >
                        {level}
                      </span>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {IMPORTANCE_LABELS[level]}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* ----- Step 3: Indicators ----- */}
          {step === 3 && (
            <>
              <h2 className="mb-1 text-lg font-semibold text-zinc-100">
                Pick indicators to watch
              </h2>
              <p className="mb-4 text-sm text-zinc-400">
                {filteredIndicators.length} indicator
                {filteredIndicators.length !== 1 ? "s" : ""} match your
                selections.{" "}
                {selectedIndicators.size > 0 &&
                  `${selectedIndicators.size} selected.`}
              </p>

              {filteredIndicators.length > 0 && (
                <div className="mb-4 flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="rounded border border-zinc-600 bg-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllFiltered}
                    className="rounded border border-zinc-600 bg-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
                  >
                    Deselect all
                  </button>
                </div>
              )}

              {filteredIndicators.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No indicators match your filters. Go back to adjust your
                  country or impact level selections.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-700 sm:max-h-96">
                  {filteredIndicators.map((ind) => (
                    <label
                      key={ind.id}
                      className={`flex cursor-pointer items-center gap-3 border-b border-zinc-700/50 px-4 py-3 last:border-b-0 hover:bg-zinc-800/50 ${
                        selectedIndicators.has(ind.id) ? "bg-blue-900/10" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIndicators.has(ind.id)}
                        onChange={() => toggleIndicator(ind.id)}
                        className="h-4 w-4 flex-shrink-0 rounded border-zinc-600 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">
                          {ind.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {ind.country_code} · {ind.category}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 text-xs font-medium capitalize ${
                          IMPORTANCE_COLORS[ind.importance as ImportanceLevel] ??
                          "text-zinc-400"
                        }`}
                      >
                        {ind.importance}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Email alerts opt-in */}
              <label className="mt-4 flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={enableAlerts}
                  onChange={(e) => setEnableAlerts(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-zinc-300">
                  Enable email alerts for selected indicators
                </span>
              </label>

              {error && (
                <p className="mt-4 text-sm text-red-400">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={isPending}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Complete setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
