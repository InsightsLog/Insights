/**
 * ECB Historical Data Bulk Import Script
 *
 * This script imports historical economic data from ECB (European Central Bank)
 * Statistical Data Warehouse into the macro calendar database.
 *
 * Usage:
 *   npx tsx src/lib/data-import/ecb-import.ts
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for bypassing RLS)
 *
 * Optional environment variables:
 *   - ECB_IMPORT_START_PERIOD: Start period for import (default: 2014-01)
 *   - ECB_IMPORT_SERIES: Comma-separated list of series to import (default: all configured series)
 *
 * Features:
 *   - Imports historical data for all configured ECB series
 *   - Deduplicates data using (indicator_id, release_at, period) key
 *   - Handles rate limiting (500ms between requests for fair use)
 *   - Progress tracking and error handling
 *   - Creates indicators if they don't exist
 *   - No API key required (ECB SDW is free and open)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ECBClient, ECB_SERIES_CONFIG, ECBSeriesId, ECBObservation } from "./ecb-client";
import {
  filterValidObservations,
  ValidationOptions,
} from "./validation";

// Default start period: 10+ years of historical data
const DEFAULT_START_PERIOD = "2014-01";

// Source information
const ECB_SOURCE_NAME = "European Central Bank (ECB SDW)";
const ECB_SOURCE_URL = "https://sdw.ecb.europa.eu";

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
 * Get or create an indicator for an ECB series.
 */
async function getOrCreateIndicator(
  supabase: SupabaseClient,
  seriesId: ECBSeriesId
): Promise<string> {
  const config = ECB_SERIES_CONFIG[seriesId];
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
      source_name: ECB_SOURCE_NAME,
      source_url: `${ECB_SOURCE_URL}/browse.do?node=${config.dataflow}`,
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
  observations: ECBObservation[],
  frequency: string,
  validationOptions: ValidationOptions = {}
): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // Convert ECB observations to ObservationData format for validation
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

  // Determine unit based on frequency
  const unit = frequency;

  // Prepare all releases data from validated observations
  const releasesData = validObservations.map((obs) => ({
    indicator_id: indicatorId,
    release_at: new Date(obs.date).toISOString(),
    period: obs.period as string,
    actual: obs.value,
    unit,
    notes: `Imported from ECB SDW`,
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
 * Import a single ECB series.
 */
async function importSeries(
  ecbClient: ECBClient,
  supabase: SupabaseClient,
  seriesId: ECBSeriesId,
  startPeriod: string,
  validationOptions: ValidationOptions = {}
): Promise<SeriesImportResult> {
  const config = ECB_SERIES_CONFIG[seriesId];

  try {
    console.log(`  Fetching ${seriesId}: ${config.name} (${config.frequency})`);

    // Get or create indicator
    const indicatorId = await getOrCreateIndicator(supabase, seriesId);

    // Fetch observations from ECB
    const observations = await ecbClient.getSeriesObservations(
      config.dataflow,
      config.seriesKey,
      startPeriod
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
export async function importECBHistoricalData(
  options: {
    startPeriod?: string;
    seriesIds?: ECBSeriesId[];
    /** Validation options for imported data (T401.6) */
    validation?: ValidationOptions;
  } = {}
): Promise<ImportResult> {
  const startPeriod = options.startPeriod ?? DEFAULT_START_PERIOD;
  const seriesIds =
    options.seriesIds ?? (Object.keys(ECB_SERIES_CONFIG) as ECBSeriesId[]);
  // Default validation: reject missing values
  const validationOptions: ValidationOptions = options.validation ?? {};

  console.log("=".repeat(60));
  console.log("ECB Historical Data Import");
  console.log("=".repeat(60));
  console.log(`Start period: ${startPeriod}`);
  console.log(`Series to import: ${seriesIds.length}`);
  console.log(`Validation: ${Object.keys(validationOptions).length > 0 ? JSON.stringify(validationOptions) : "default"}`);
  console.log("");

  const ecbClient = new ECBClient();
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
      ecbClient,
      supabase,
      seriesId,
      startPeriod,
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
  const startPeriod = process.env.ECB_IMPORT_START_PERIOD ?? DEFAULT_START_PERIOD;
  const seriesEnv = process.env.ECB_IMPORT_SERIES;
  const seriesIds = seriesEnv
    ? (seriesEnv.split(",").map((s) => s.trim()) as ECBSeriesId[])
    : undefined;

  importECBHistoricalData({ startPeriod, seriesIds })
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
