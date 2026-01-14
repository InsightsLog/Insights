/**
 * FRED Historical Data Bulk Import Script
 *
 * This script imports historical economic data from FRED (Federal Reserve Economic Data)
 * into the macro calendar database.
 *
 * Usage:
 *   npx tsx src/lib/data-import/fred-import.ts
 *
 * Environment variables required:
 *   - FRED_API_KEY: Your FRED API key (get free at https://fred.stlouisfed.org/docs/api/api_key.html)
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for bypassing RLS)
 *
 * Optional environment variables:
 *   - FRED_IMPORT_START_DATE: Start date for import (default: 2014-01-01, 10+ years)
 *   - FRED_IMPORT_SERIES: Comma-separated list of series to import (default: all configured series)
 *
 * Features:
 *   - Imports historical data for all configured FRED series
 *   - Deduplicates data using (indicator_id, release_at, period) key
 *   - Handles rate limiting (120 requests/minute)
 *   - Progress tracking and error handling
 *   - Creates indicators if they don't exist
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { FredClient, FRED_SERIES_CONFIG, FredSeriesId, FredObservation } from "./fred-client";

// Default start date: 10+ years of historical data
const DEFAULT_START_DATE = "2014-01-01";

// Source information
const FRED_SOURCE_NAME = "Federal Reserve Economic Data (FRED)";
const FRED_SOURCE_URL = "https://fred.stlouisfed.org";

/**
 * Import result for a single series.
 */
interface SeriesImportResult {
  seriesId: string;
  indicatorName: string;
  observationsCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  error?: string;
}

/**
 * Overall import result.
 */
interface ImportResult {
  totalSeries: number;
  successfulSeries: number;
  failedSeries: number;
  totalObservations: number;
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
  seriesResults: SeriesImportResult[];
  errors: string[];
}

/**
 * Format a FRED observation date to a human-readable period string.
 * FRED returns dates in YYYY-MM-DD format.
 */
function formatPeriod(date: string, frequency: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  switch (frequency.toLowerCase()) {
    case "quarterly":
      const quarter = Math.ceil(month / 3);
      return `Q${quarter} ${year}`;
    case "annual":
      return `${year}`;
    case "monthly":
      return `${d.toLocaleString("en-US", { month: "short" })} ${year}`;
    case "weekly":
    case "daily":
      return date;
    default:
      return `${d.toLocaleString("en-US", { month: "short" })} ${year}`;
  }
}

/**
 * Helper to create a unique key for a release.
 */
function releaseKey(indicatorId: string, releaseAt: string, period: string): string {
  return `${indicatorId}|${releaseAt}|${period}`;
}

/**
 * Create Supabase client for import.
 */
function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get or create an indicator for a FRED series.
 */
async function getOrCreateIndicator(
  supabase: SupabaseClient,
  seriesId: FredSeriesId,
  _seriesTitle: string,
  _units: string
): Promise<string> {
  const config = FRED_SERIES_CONFIG[seriesId];
  const indicatorName = config.name;

  // Try to find existing indicator
  const { data: existing, error: fetchError } = await supabase
    .from("indicators")
    .select("id")
    .eq("name", indicatorName)
    .eq("country_code", config.countryCode)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 = no rows returned
    throw new Error(`Failed to fetch indicator: ${fetchError.message}`);
  }

  if (existing) {
    return existing.id;
  }

  // Create new indicator
  const { data: inserted, error: insertError } = await supabase
    .from("indicators")
    .insert({
      name: indicatorName,
      country_code: config.countryCode,
      category: config.category,
      source_name: FRED_SOURCE_NAME,
      source_url: `${FRED_SOURCE_URL}/series/${seriesId}`,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to create indicator: ${insertError.message}`);
  }

  return inserted.id;
}

/**
 * Import observations for a single series.
 */
async function importSeriesObservations(
  supabase: SupabaseClient,
  indicatorId: string,
  observations: FredObservation[],
  frequency: string,
  units: string
): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0;
  let updated = 0;
  const skipped = 0;

  // Prepare all releases data
  const releasesData = observations.map((obs) => ({
    indicator_id: indicatorId,
    release_at: new Date(obs.date).toISOString(),
    period: formatPeriod(obs.date, frequency),
    actual: obs.value,
    unit: units,
    notes: `Imported from FRED`,
  }));

  // Fetch existing releases to determine which to update vs insert
  // Build filters in chunks to avoid query limits
  const CHUNK_SIZE = 50;
  const existingReleaseMap = new Map<string, string>();

  for (let i = 0; i < releasesData.length; i += CHUNK_SIZE) {
    const chunk = releasesData.slice(i, i + CHUNK_SIZE);
    const filters = chunk.map(
      (rel) =>
        `and(indicator_id.eq.${rel.indicator_id},release_at.eq.${rel.release_at},period.eq.${encodeURIComponent(rel.period)})`
    );

    const { data: existingReleases, error } = await supabase
      .from("releases")
      .select("id, indicator_id, release_at, period")
      .or(filters.join(","));

    if (error) {
      throw new Error(`Failed to fetch existing releases: ${error.message}`);
    }

    for (const rel of existingReleases || []) {
      existingReleaseMap.set(
        releaseKey(rel.indicator_id, rel.release_at, rel.period),
        rel.id
      );
    }
  }

  // Separate into updates and inserts
  const toUpdate: Array<{
    id: string;
    actual: string;
    unit: string;
    notes: string;
  }> = [];
  const toInsert: typeof releasesData = [];

  for (const rel of releasesData) {
    const key = releaseKey(rel.indicator_id, rel.release_at, rel.period);
    const existingId = existingReleaseMap.get(key);

    if (existingId) {
      toUpdate.push({
        id: existingId,
        actual: rel.actual,
        unit: rel.unit,
        notes: rel.notes,
      });
    } else {
      toInsert.push(rel);
    }
  }

  // Batch update existing releases
  if (toUpdate.length > 0) {
    const updatePromises = toUpdate.map((rel) =>
      supabase
        .from("releases")
        .update({
          actual: rel.actual,
          unit: rel.unit,
          notes: rel.notes,
        })
        .eq("id", rel.id)
    );
    await Promise.all(updatePromises);
    updated = toUpdate.length;
  }

  // Batch insert new releases
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("releases")
      .insert(toInsert);

    if (insertError) {
      throw new Error(`Failed to insert releases: ${insertError.message}`);
    }
    inserted = toInsert.length;
  }

  return { inserted, updated, skipped };
}

/**
 * Import a single FRED series.
 */
async function importSeries(
  fredClient: FredClient,
  supabase: SupabaseClient,
  seriesId: FredSeriesId,
  startDate: string
): Promise<SeriesImportResult> {
  const config = FRED_SERIES_CONFIG[seriesId];

  try {
    // Get series metadata
    const seriesInfo = await fredClient.getSeriesInfo(seriesId);
    console.log(
      `  Fetching ${seriesId}: ${seriesInfo.title} (${seriesInfo.frequency})`
    );

    // Get or create indicator
    const indicatorId = await getOrCreateIndicator(
      supabase,
      seriesId,
      seriesInfo.title,
      seriesInfo.units
    );

    // Fetch observations
    const observations = await fredClient.getSeriesObservations(
      seriesId,
      startDate
    );
    console.log(`  Found ${observations.length} observations`);

    // Import observations
    const { inserted, updated, skipped } = await importSeriesObservations(
      supabase,
      indicatorId,
      observations,
      seriesInfo.frequency,
      seriesInfo.units
    );

    console.log(
      `  Imported: ${inserted} new, ${updated} updated, ${skipped} skipped`
    );

    return {
      seriesId,
      indicatorName: config.name,
      observationsCount: observations.length,
      insertedCount: inserted,
      updatedCount: updated,
      skippedCount: skipped,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`  Error importing ${seriesId}: ${errorMessage}`);

    return {
      seriesId,
      indicatorName: config.name,
      observationsCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * Main import function.
 */
export async function importFredHistoricalData(
  options: {
    startDate?: string;
    seriesIds?: FredSeriesId[];
    apiKey?: string;
  } = {}
): Promise<ImportResult> {
  const startDate = options.startDate ?? DEFAULT_START_DATE;
  const seriesIds =
    options.seriesIds ?? (Object.keys(FRED_SERIES_CONFIG) as FredSeriesId[]);

  console.log("=".repeat(60));
  console.log("FRED Historical Data Import");
  console.log("=".repeat(60));
  console.log(`Start date: ${startDate}`);
  console.log(`Series to import: ${seriesIds.length}`);
  console.log("");

  const fredClient = new FredClient(options.apiKey);
  const supabase = createSupabaseClient();

  const result: ImportResult = {
    totalSeries: seriesIds.length,
    successfulSeries: 0,
    failedSeries: 0,
    totalObservations: 0,
    totalInserted: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    seriesResults: [],
    errors: [],
  };

  for (const seriesId of seriesIds) {
    console.log(`[${result.seriesResults.length + 1}/${seriesIds.length}] Processing ${seriesId}...`);

    const seriesResult = await importSeries(
      fredClient,
      supabase,
      seriesId,
      startDate
    );
    result.seriesResults.push(seriesResult);

    if (seriesResult.error) {
      result.failedSeries++;
      result.errors.push(`${seriesId}: ${seriesResult.error}`);
    } else {
      result.successfulSeries++;
    }

    result.totalObservations += seriesResult.observationsCount;
    result.totalInserted += seriesResult.insertedCount;
    result.totalUpdated += seriesResult.updatedCount;
    result.totalSkipped += seriesResult.skippedCount;

    console.log("");
  }

  // Print summary
  console.log("=".repeat(60));
  console.log("Import Summary");
  console.log("=".repeat(60));
  console.log(`Total series: ${result.totalSeries}`);
  console.log(`Successful: ${result.successfulSeries}`);
  console.log(`Failed: ${result.failedSeries}`);
  console.log(`Total observations: ${result.totalObservations}`);
  console.log(`Inserted: ${result.totalInserted}`);
  console.log(`Updated: ${result.totalUpdated}`);
  console.log(`Skipped: ${result.totalSkipped}`);

  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }

  return result;
}

// CLI entry point
if (require.main === module) {
  const startDate = process.env.FRED_IMPORT_START_DATE ?? DEFAULT_START_DATE;
  const seriesEnv = process.env.FRED_IMPORT_SERIES;
  const seriesIds = seriesEnv
    ? (seriesEnv.split(",").map((s) => s.trim()) as FredSeriesId[])
    : undefined;

  importFredHistoricalData({ startDate, seriesIds })
    .then((result) => {
      if (result.failedSeries > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error("Import failed:", error);
      process.exit(1);
    });
}
