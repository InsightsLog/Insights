"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { updateAlertPreferences } from "@/app/actions/alert-preferences";
import type { WatchlistWithPreference } from "@/app/actions/alert-preferences";

type ImpactFilter = "all" | "medium" | "high";

const IMPACT_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const IMPACT_BADGE_CLASSES: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

type Props = {
  initialItems: WatchlistWithPreference[];
  fetchError: string | null;
};

/**
 * Alert preferences page client component.
 * Shows per-indicator toggles for email alerts and push notifications.
 * Provides a client-side impact-threshold filter (high / medium & above / all).
 */
export function AlertPreferencesClient({ initialItems, fetchError }: Props) {
  const [items, setItems] = useState<WatchlistWithPreference[]>(initialItems);
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Apply impact threshold filter
  const filteredItems = items.filter((item) => {
    if (impactFilter === "high") return item.importance === "high";
    if (impactFilter === "medium")
      return item.importance === "high" || item.importance === "medium";
    return true;
  });

  const handleToggle = async (
    indicatorId: string,
    field: "emailEnabled" | "pushEnabled",
    currentValue: boolean
  ) => {
    if (savingId === indicatorId) return;

    // Optimistic update
    const newValue = !currentValue;
    setItems((prev) =>
      prev.map((item) =>
        item.indicatorId === indicatorId
          ? { ...item, [field]: newValue }
          : item
      )
    );
    setErrorById((prev) => ({ ...prev, [indicatorId]: "" }));
    setSavingId(indicatorId);

    const current = items.find((i) => i.indicatorId === indicatorId);
    if (!current) {
      setSavingId(null);
      return;
    }

    const emailEnabled =
      field === "emailEnabled" ? newValue : current.emailEnabled;
    const pushEnabled =
      field === "pushEnabled" ? newValue : current.pushEnabled;

    const result = await updateAlertPreferences(
      indicatorId,
      emailEnabled,
      pushEnabled
    );

    if (!isMountedRef.current) return;

    if (!result.success) {
      // Revert optimistic update on error
      setItems((prev) =>
        prev.map((item) =>
          item.indicatorId === indicatorId
            ? { ...item, [field]: currentValue }
            : item
        )
      );
      setErrorById((prev) => ({ ...prev, [indicatorId]: result.error }));
    }

    setSavingId(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to Calendar
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Alert Preferences
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Configure email and push notification alerts for your watchlisted
            indicators.
          </p>
        </div>

        {/* Fetch error */}
        {fetchError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              {fetchError}
            </p>
          </div>
        )}

        {/* Impact threshold filter */}
        {items.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Impact threshold:
            </span>
            {(["all", "medium", "high"] as ImpactFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setImpactFilter(f)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  impactFilter === f
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {f === "all" ? "All" : f === "medium" ? "Medium +" : "High only"}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && !fetchError && (
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
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                No indicators in watchlist
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Add indicators to your watchlist first to configure alerts.
              </p>
              <div className="mt-6">
                <Link
                  href="/"
                  className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                >
                  Browse Calendar
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* No results after filter */}
        {items.length > 0 && filteredItems.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-8 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              No indicators match the selected impact threshold.
            </p>
          </div>
        )}

        {/* Indicator cards */}
        {filteredItems.length > 0 && (
          <div className="space-y-3">
            {/* Column headers — desktop only */}
            <div className="hidden rounded-lg border border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900 sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Indicator
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Impact
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Email
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Push
              </span>
            </div>

            {filteredItems.map((item) => {
              const isSaving = savingId === item.indicatorId;
              const itemError = errorById[item.indicatorId];

              return (
                <div
                  key={item.indicatorId}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* Mobile layout: stacked */}
                  <div className="sm:hidden">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {item.indicatorName}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {item.countryCode} · {item.category}
                        </p>
                      </div>
                      <span
                        className={`ml-2 inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          IMPACT_BADGE_CLASSES[item.importance] ??
                          IMPACT_BADGE_CLASSES.medium
                        }`}
                      >
                        {IMPACT_LABELS[item.importance] ?? item.importance}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-6">
                      <ToggleButton
                        label="Email"
                        enabled={item.emailEnabled}
                        disabled={isSaving}
                        onToggle={() =>
                          handleToggle(
                            item.indicatorId,
                            "emailEnabled",
                            item.emailEnabled
                          )
                        }
                      />
                      <ToggleButton
                        label="Push"
                        enabled={item.pushEnabled}
                        disabled={isSaving}
                        onToggle={() =>
                          handleToggle(
                            item.indicatorId,
                            "pushEnabled",
                            item.pushEnabled
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Desktop layout: grid */}
                  <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {item.indicatorName}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {item.countryCode} · {item.category}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        IMPACT_BADGE_CLASSES[item.importance] ??
                        IMPACT_BADGE_CLASSES.medium
                      }`}
                    >
                      {IMPACT_LABELS[item.importance] ?? item.importance}
                    </span>

                    <ToggleSwitch
                      enabled={item.emailEnabled}
                      disabled={isSaving}
                      ariaLabel={`Email alerts for ${item.indicatorName}`}
                      onToggle={() =>
                        handleToggle(
                          item.indicatorId,
                          "emailEnabled",
                          item.emailEnabled
                        )
                      }
                    />

                    <ToggleSwitch
                      enabled={item.pushEnabled}
                      disabled={isSaving}
                      ariaLabel={`Push notifications for ${item.indicatorName}`}
                      onToggle={() =>
                        handleToggle(
                          item.indicatorId,
                          "pushEnabled",
                          item.pushEnabled
                        )
                      }
                    />
                  </div>

                  {/* Inline error */}
                  {itemError && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                      {itemError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        {items.length > 0 && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              About alerts
            </h2>
            <ul className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <li>• <strong className="text-zinc-700 dark:text-zinc-300">Email</strong> — receive an email when a new release is published for this indicator.</li>
              <li>• <strong className="text-zinc-700 dark:text-zinc-300">Push</strong> — receive a browser push notification (requires push notifications to be enabled in Settings).</li>
              <li>• Use the <strong className="text-zinc-700 dark:text-zinc-300">Impact threshold</strong> filter to focus on the indicators that matter most.</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type ToggleSwitchProps = {
  enabled: boolean;
  disabled: boolean;
  ariaLabel: string;
  onToggle: () => void;
};

/** Accessible toggle switch used in desktop grid layout. */
function ToggleSwitch({ enabled, disabled, ariaLabel, onToggle }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-900 ${
        enabled ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-700"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

type ToggleButtonProps = {
  label: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
};

/** Compact labelled toggle button used in mobile card layout. */
function ToggleButton({ label, enabled, disabled, onToggle }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        enabled
          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
      aria-pressed={enabled}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          enabled ? "bg-blue-500" : "bg-zinc-400 dark:bg-zinc-500"
        }`}
      />
      {label}
    </button>
  );
}
