/**
 * BLS Historical Data Bulk Import Script
 *
 * This script imports historical economic data from BLS (Bureau of Labor Statistics)
 * into the macro calendar database.
 *
 * Usage:
 *   npx tsx src/lib/data-import/bls-import.ts
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for bypassing RLS)
 *
 * Optional environment variables:
 *   - BLS_API_KEY: Your BLS API key (register at https://data.bls.gov/registrationEngine/)
 *   - BLS_IMPORT_START_YEAR: Start year for import (default: 2014, 10+ years)
 *   - BLS_IMPORT_SERIES: Comma-separated list of series to import (default: all configured series)
 *
 * Features:
 *   - Imports historical data for all configured BLS series
 *   - Deduplicates data using (indicator_id, release_at, period) key
 *   - Handles rate limiting (25 requests/day without key, 500 with key)
 *   - Progress tracking and error handling
 *   - Creates indicators if they don't exist
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { BLSClient, BLS_SERIES_CONFIG, BLSSeriesId, NormalizedBLSObservation } from "./bls-client";
import {
  filterValidObservations,
  ValidationOptions,
} from "./validation";

// Default start year: 10+ years of historical data
const DEFAULT_START_YEAR = "2014";

// Source information
const BLS_SOURCE_NAME = "Bureau of Labor Statistics (BLS)";
const BLS_SOURCE_URL = "https://www.bls.gov";

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
 * Get or create an indicator for a BLS series.
 */
async function getOrCreateIndicator(
  supabase: SupabaseClient,
  seriesId: BLSSeriesId,
  _seriesTitle: string
): Promise<string> {
  const config = BLS_SERIES_CONFIG[seriesId];
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
      source_name: BLS_SOURCE_NAME,
      source_url: `${BLS_SOURCE_URL}/data/#${seriesId}`,
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
  observations: NormalizedBLSObservation[],
  frequency: string,
  validationOptions: ValidationOptions = {}
): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // Convert BLS observations to ObservationData format for validation
  const observationData = observations.map((obs) => ({
    date: obs.date,
    value: obs.value,
    indicatorId,
    period: obs.period,
  }));

  // Validate observations (T401.6)
  const { valid: validObservations, skipped: skippedObs } = filterValidObservations(
    observationData,
    validationOptions
  );
  skipped = skippedObs.length;

  // Log skipped observations for debugging
  if (skippedObs.length > 0) {
    console.log(`    Skipped ${skippedObs.length} invalid observations`);
    // Group by reason for summary
    const reasonCounts = new Map<string, number>();
    for (const { reason } of skippedObs) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    for (const [reason, count] of reasonCounts) {
      console.log(`      - ${reason}: ${count}`);
    }
  }

  // Determine unit based on frequency and category
  const unit = frequency === "Monthly" ? "Monthly" : frequency;

  // Prepare all releases data from validated observations
  const releasesData = validObservations.map((obs) => ({
    indicator_id: indicatorId,
    release_at: new Date(obs.date).toISOString(),
    period: obs.period as string,
    actual: obs.value,
    unit: unit,
    notes: `Imported from BLS`,
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
 * Import a single BLS series.
 */
async function importSeries(
  blsClient: BLSClient,
  supabase: SupabaseClient,
  seriesId: BLSSeriesId,
  startYear: string,
  endYear: string,
  validationOptions: ValidationOptions = {}
): Promise<SeriesImportResult> {
  const config = BLS_SERIES_CONFIG[seriesId];
  
  // Handle case where series is not in config
  if (!config) {
    console.error(`  Unknown series: ${seriesId}`);
    return {
      seriesId,
      indicatorName: seriesId, // Use seriesId as fallback name
      observationsCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      error: `Unknown series: ${seriesId} is not in BLS_SERIES_CONFIG`,
    };
  }

  try {
    // Get series metadata
    const seriesInfo = await blsClient.getSeriesInfo(seriesId);
    console.log(`  Fetching ${seriesId}: ${seriesInfo.title} (${config.frequency})`);

    // Get or create indicator
    const indicatorId = await getOrCreateIndicator(
      supabase,
      seriesId,
      seriesInfo.title
    );

    // Fetch observations
    const observations = await blsClient.getSingleSeriesObservations(
      seriesId,
      startYear,
      endYear
    );
    console.log(`  Found ${observations.length} observations`);

    // Import observations with validation (T401.6)
    const { inserted, updated, skipped } = await importSeriesObservations(
      supabase,
      indicatorId,
      observations,
      config.frequency,
      validationOptions
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
export async function importBLSHistoricalData(
  options: {
    startYear?: string;
    endYear?: string;
    seriesIds?: BLSSeriesId[];
    apiKey?: string;
    /** Validation options for imported data (T401.6) */
    validation?: ValidationOptions;
  } = {}
): Promise<ImportResult> {
  const startYear = options.startYear ?? DEFAULT_START_YEAR;
  const endYear = options.endYear ?? new Date().getFullYear().toString();
  const seriesIds =
    options.seriesIds ?? (Object.keys(BLS_SERIES_CONFIG) as BLSSeriesId[]);
  // Default validation: reject missing values
  const validationOptions: ValidationOptions = options.validation ?? {};

  console.log("=".repeat(60));
  console.log("BLS Historical Data Import");
  console.log("=".repeat(60));
  console.log(`Year range: ${startYear} - ${endYear}`);
  console.log(`Series to import: ${seriesIds.length}`);
  console.log(`API key: ${options.apiKey ? "provided" : "from environment or none"}`);
  console.log(`Validation: ${Object.keys(validationOptions).length > 0 ? JSON.stringify(validationOptions) : "default"}`);
  console.log("");

  const blsClient = new BLSClient(options.apiKey);
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
      blsClient,
      supabase,
      seriesId,
      startYear,
      endYear,
      validationOptions
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
  const startYear = process.env.BLS_IMPORT_START_YEAR ?? DEFAULT_START_YEAR;
  const endYear = process.env.BLS_IMPORT_END_YEAR ?? new Date().getFullYear().toString();
  const seriesEnv = process.env.BLS_IMPORT_SERIES;
  const seriesIds = seriesEnv
    ? (seriesEnv.split(",").map((s) => s.trim()) as BLSSeriesId[])
    : undefined;

  importBLSHistoricalData({ startYear, endYear, seriesIds })
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
