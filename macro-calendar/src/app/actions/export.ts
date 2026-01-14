"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema for validating export format
const exportFormatSchema = z.enum(["csv", "json"]);

// Schema for validating UUID indicator IDs
const indicatorIdSchema = z.string().uuid("Invalid indicator ID");

/**
 * Maximum number of releases to export per request.
 * Prevents oversized exports and excessive database load.
 */
const MAX_EXPORT_RELEASES = 1000;

/**
 * Maximum length for indicator name in exported filenames.
 * Ensures filenames remain reasonable and compatible with file systems.
 */
const MAX_FILENAME_LENGTH = 50;

/**
 * Type for export format options.
 */
export type ExportFormat = z.infer<typeof exportFormatSchema>;

/**
 * Result type for export actions.
 */
export type ExportResult =
  | { success: true; data: string; filename: string; contentType: string }
  | { success: false; error: string };

/**
 * Indicator data structure for exports.
 */
interface IndicatorData {
  id: string;
  name: string;
  country_code: string;
  category: string;
}

/**
 * Release data structure for exports.
 */
interface ReleaseData {
  id: string;
  release_at: string;
  period: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  revised: string | null;
  unit: string | null;
  indicator?: IndicatorData;
}

/**
 * Watchlist release data structure for exports.
 */
interface WatchlistReleaseData {
  indicator_name: string;
  country_code: string;
  category: string;
  release_at: string;
  period: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  revised: string | null;
  unit: string | null;
}

/**
 * Convert a value to CSV-safe format.
 * Escapes quotes and wraps in quotes if needed.
 */
function escapeCSVValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  // If the value contains a comma, newline, or quote, wrap it in quotes
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert releases data to CSV format.
 */
function releasesToCSV(releases: ReleaseData[], includeIndicator: boolean): string {
  const headers = includeIndicator
    ? ["Indicator", "Country", "Category", "Release Date", "Period", "Actual", "Forecast", "Previous", "Revised", "Unit"]
    : ["Release Date", "Period", "Actual", "Forecast", "Previous", "Revised", "Unit"];

  const rows = releases.map((r) => {
    const baseFields = [
      escapeCSVValue(r.release_at),
      escapeCSVValue(r.period),
      escapeCSVValue(r.actual),
      escapeCSVValue(r.forecast),
      escapeCSVValue(r.previous),
      escapeCSVValue(r.revised),
      escapeCSVValue(r.unit),
    ];

    if (includeIndicator) {
      return [
        escapeCSVValue(r.indicator?.name),
        escapeCSVValue(r.indicator?.country_code),
        escapeCSVValue(r.indicator?.category),
        ...baseFields,
      ].join(",");
    }

    return baseFields.join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Convert watchlist releases data to CSV format.
 */
function watchlistReleasesToCSV(releases: WatchlistReleaseData[]): string {
  const headers = [
    "Indicator",
    "Country",
    "Category",
    "Release Date",
    "Period",
    "Actual",
    "Forecast",
    "Previous",
    "Revised",
    "Unit",
  ];

  const rows = releases.map((r) =>
    [
      escapeCSVValue(r.indicator_name),
      escapeCSVValue(r.country_code),
      escapeCSVValue(r.category),
      escapeCSVValue(r.release_at),
      escapeCSVValue(r.period),
      escapeCSVValue(r.actual),
      escapeCSVValue(r.forecast),
      escapeCSVValue(r.previous),
      escapeCSVValue(r.revised),
      escapeCSVValue(r.unit),
    ].join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Export the current user's watchlist releases to CSV or JSON.
 * Fetches all releases for indicators in the user's watchlist.
 *
 * @param format - Export format: "csv" or "json"
 * @returns Export result with data string, filename, and content type
 */
export async function exportWatchlistReleases(
  format: ExportFormat
): Promise<ExportResult> {
  // Validate format
  const formatResult = exportFormatSchema.safeParse(format);
  if (!formatResult.success) {
    return { success: false, error: "Invalid export format. Use 'csv' or 'json'." };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch user's watchlist indicator IDs
  const { data: watchlistData, error: watchlistError } = await supabase
    .from("watchlist")
    .select("indicator_id")
    .eq("user_id", user.id)
    .is("org_id", null); // Only personal watchlist

  if (watchlistError) {
    return { success: false, error: "Failed to fetch watchlist" };
  }

  if (!watchlistData || watchlistData.length === 0) {
    return { success: false, error: "No indicators in watchlist" };
  }

  const indicatorIds = watchlistData.map((w) => w.indicator_id);

  // Fetch releases for all watchlist indicators with indicator details
  const { data: releasesData, error: releasesError } = await supabase
    .from("releases")
    .select(
      `
      id, release_at, period, actual, forecast, previous, revised, unit,
      indicator:indicators!inner(id, name, country_code, category)
    `
    )
    .in("indicator_id", indicatorIds)
    .order("release_at", { ascending: false })
    .limit(MAX_EXPORT_RELEASES);

  if (releasesError) {
    return { success: false, error: "Failed to fetch releases" };
  }

  // Transform data to flat structure for export
  const exportData: WatchlistReleaseData[] = (releasesData ?? []).map((r) => {
    // Handle Supabase's embedded relation format (can be array or object)
    const indicator = Array.isArray(r.indicator) ? r.indicator[0] : r.indicator;
    return {
      indicator_name: indicator?.name ?? "",
      country_code: indicator?.country_code ?? "",
      category: indicator?.category ?? "",
      release_at: r.release_at,
      period: r.period,
      actual: r.actual,
      forecast: r.forecast,
      previous: r.previous,
      revised: r.revised,
      unit: r.unit,
    };
  });

  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  if (format === "json") {
    return {
      success: true,
      data: JSON.stringify(exportData, null, 2),
      filename: `watchlist-releases-${timestamp}.json`,
      contentType: "application/json",
    };
  }

  // CSV format
  return {
    success: true,
    data: watchlistReleasesToCSV(exportData),
    filename: `watchlist-releases-${timestamp}.csv`,
    contentType: "text/csv",
  };
}

/**
 * Export historical data for a specific indicator to CSV or JSON.
 *
 * @param indicatorId - UUID of the indicator
 * @param format - Export format: "csv" or "json"
 * @returns Export result with data string, filename, and content type
 */
export async function exportIndicatorHistory(
  indicatorId: string,
  format: ExportFormat
): Promise<ExportResult> {
  // Validate indicator ID format
  const idResult = indicatorIdSchema.safeParse(indicatorId);
  if (!idResult.success) {
    return { success: false, error: "Invalid indicator ID format" };
  }

  // Validate format
  const formatResult = exportFormatSchema.safeParse(format);
  if (!formatResult.success) {
    return { success: false, error: "Invalid export format. Use 'csv' or 'json'." };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch indicator details
  const { data: indicatorData, error: indicatorError } = await supabase
    .from("indicators")
    .select("id, name, country_code, category")
    .eq("id", indicatorId)
    .single();

  if (indicatorError) {
    if (indicatorError.code === "PGRST116") {
      return { success: false, error: "Indicator not found" };
    }
    return { success: false, error: "Failed to fetch indicator" };
  }

  // Fetch all releases for this indicator
  const { data: releasesData, error: releasesError } = await supabase
    .from("releases")
    .select("id, release_at, period, actual, forecast, previous, revised, unit")
    .eq("indicator_id", indicatorId)
    .order("release_at", { ascending: false })
    .limit(MAX_EXPORT_RELEASES);

  if (releasesError) {
    return { success: false, error: "Failed to fetch releases" };
  }

  const releases: ReleaseData[] = (releasesData ?? []).map((r) => ({
    id: r.id,
    release_at: r.release_at,
    period: r.period,
    actual: r.actual,
    forecast: r.forecast,
    previous: r.previous,
    revised: r.revised,
    unit: r.unit,
  }));

  // Create safe filename from indicator name
  const safeIndicatorName = indicatorData.name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, MAX_FILENAME_LENGTH);
  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  if (format === "json") {
    const exportData = {
      indicator: indicatorData,
      releases: releases,
      exported_at: new Date().toISOString(),
    };
    return {
      success: true,
      data: JSON.stringify(exportData, null, 2),
      filename: `${safeIndicatorName}-${timestamp}.json`,
      contentType: "application/json",
    };
  }

  // CSV format (no indicator column since it's all the same indicator)
  return {
    success: true,
    data: releasesToCSV(releases, false),
    filename: `${safeIndicatorName}-${timestamp}.csv`,
    contentType: "text/csv",
  };
}
