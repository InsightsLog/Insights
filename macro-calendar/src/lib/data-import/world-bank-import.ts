/**
 * World Bank Historical Data Bulk Import Script
 *
 * This script imports historical economic data from the World Bank Indicators API
 * into the macro calendar database.
 *
 * Usage:
 *   npx tsx src/lib/data-import/world-bank-import.ts
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for bypassing RLS)
 *
 * Optional environment variables:
 *   - WORLD_BANK_IMPORT_START_YEAR: Start year for import (default: 2014, 10+ years)
 *   - WORLD_BANK_IMPORT_INDICATORS: Comma-separated list of indicator IDs to import
 *   - WORLD_BANK_IMPORT_COUNTRIES: Comma-separated list of country codes to import
 *
 * Features:
 *   - Imports historical data for all configured World Bank indicators
 *   - Deduplicates data using (indicator_id, release_at, period) key
 *   - Handles rate limiting (500ms between requests for fair use)
 *   - Progress tracking and error handling
 *   - Creates indicators if they don't exist
 *   - No API key required (World Bank API is free and open)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  WorldBankClient,
  WORLD_BANK_INDICATOR_CONFIG,
  WORLD_BANK_COUNTRIES,
  WorldBankIndicatorId,
  WorldBankCountryCode,
  WorldBankObservation,
} from "./world-bank-client";
import { filterValidObservations, ValidationOptions } from "./validation";

// Default start year: 10+ years of historical data
const DEFAULT_START_YEAR = "2014";

// Source information
const WORLD_BANK_SOURCE_NAME = "World Bank Open Data";
const WORLD_BANK_SOURCE_URL = "https://data.worldbank.org";

/**
 * Import result for a single indicator-country combination.
 */
interface IndicatorCountryImportResult {
  indicatorId: string;
  countryCode: string;
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
  totalIndicators: number;
  totalCountries: number;
  successfulImports: number;
  failedImports: number;
  totalObservations: number;
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
  importResults: IndicatorCountryImportResult[];
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
 * Get or create an indicator for a World Bank indicator + country combination.
 */
async function getOrCreateIndicator(
  supabase: SupabaseClient,
  wbIndicatorId: WorldBankIndicatorId,
  countryCode: WorldBankCountryCode
): Promise<string> {
  const config = WORLD_BANK_INDICATOR_CONFIG[wbIndicatorId];
  const countryName = WORLD_BANK_COUNTRIES[countryCode];
  // Create a unique indicator name that includes the country
  const indicatorName = `${config.name} (${countryName})`;

  // Try to find existing indicator
  const { data: existing, error: fetchError } = await supabase
    .from("indicators")
    .select("id")
    .eq("name", indicatorName)
    .eq("country_code", countryCode)
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
      country_code: countryCode,
      category: config.category,
      source_name: WORLD_BANK_SOURCE_NAME,
      source_url: `${WORLD_BANK_SOURCE_URL}/indicator/${wbIndicatorId}?locations=${countryCode}`,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to create indicator: ${insertError.message}`);
  }

  return inserted.id;
}

/**
 * Import observations for a single indicator-country combination.
 */
async function importIndicatorObservations(
  supabase: SupabaseClient,
  dbIndicatorId: string,
  observations: WorldBankObservation[],
  frequency: string,
  validationOptions: ValidationOptions = {}
): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // Convert World Bank observations to ObservationData format for validation
  const observationData = observations.map((obs) => ({
    date: obs.date,
    value: obs.value,
    indicatorId: dbIndicatorId,
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
  const unit = frequency === "Annual" ? "Annual" : frequency;

  // Prepare all releases data from validated observations
  const releasesData = validObservations.map((obs) => ({
    indicator_id: dbIndicatorId,
    release_at: new Date(obs.date).toISOString(),
    period: obs.period as string,
    actual: obs.value,
    unit,
    notes: `Imported from World Bank`,
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
 * Import data for a single World Bank indicator across all countries.
 */
async function importIndicator(
  worldBankClient: WorldBankClient,
  supabase: SupabaseClient,
  indicatorId: WorldBankIndicatorId,
  countryCodes: WorldBankCountryCode[],
  startYear: string,
  endYear: string,
  validationOptions: ValidationOptions = {}
): Promise<IndicatorCountryImportResult[]> {
  const config = WORLD_BANK_INDICATOR_CONFIG[indicatorId];
  const results: IndicatorCountryImportResult[] = [];

  try {
    console.log(`  Fetching ${indicatorId}: ${config.name} for ${countryCodes.length} countries`);

    // Fetch all observations for all countries at once
    const observations = await worldBankClient.getIndicatorObservations(
      indicatorId,
      countryCodes,
      startYear,
      endYear
    );

    console.log(`  Found ${observations.length} total observations`);

    // Group observations by country
    const observationsByCountry = new Map<string, WorldBankObservation[]>();
    for (const obs of observations) {
      const countryObs = observationsByCountry.get(obs.countryCode) ?? [];
      countryObs.push(obs);
      observationsByCountry.set(obs.countryCode, countryObs);
    }

    // Process each country
    for (const countryCode of countryCodes) {
      const countryObs = observationsByCountry.get(countryCode) ?? [];

      if (countryObs.length === 0) {
        // No data for this country - not an error, just skip
        results.push({
          indicatorId,
          countryCode,
          indicatorName: config.name,
          observationsCount: 0,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
        });
        continue;
      }

      try {
        // Get or create database indicator for this country
        const dbIndicatorId = await getOrCreateIndicator(
          supabase,
          indicatorId,
          countryCode as WorldBankCountryCode
        );

        // Import observations
        const { inserted, updated, skipped } = await importIndicatorObservations(
          supabase,
          dbIndicatorId,
          countryObs,
          config.frequency,
          validationOptions
        );

        results.push({
          indicatorId,
          countryCode,
          indicatorName: config.name,
          observationsCount: countryObs.length,
          insertedCount: inserted,
          updatedCount: updated,
          skippedCount: skipped,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`    Error importing ${indicatorId} for ${countryCode}: ${errorMessage}`);

        results.push({
          indicatorId,
          countryCode,
          indicatorName: config.name,
          observationsCount: countryObs.length,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          error: errorMessage,
        });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`  Error fetching ${indicatorId}: ${errorMessage}`);

    // Mark all countries as failed
    for (const countryCode of countryCodes) {
      results.push({
        indicatorId,
        countryCode,
        indicatorName: config.name,
        observationsCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        error: errorMessage,
      });
    }
  }

  return results;
}

/**
 * Main import function.
 */
export async function importWorldBankHistoricalData(
  options: {
    startYear?: string;
    endYear?: string;
    indicatorIds?: WorldBankIndicatorId[];
    countryCodes?: WorldBankCountryCode[];
    /** Validation options for imported data (T401.6) */
    validation?: ValidationOptions;
  } = {}
): Promise<ImportResult> {
  const startYear = options.startYear ?? DEFAULT_START_YEAR;
  const endYear = options.endYear ?? new Date().getFullYear().toString();
  const indicatorIds =
    options.indicatorIds ?? (Object.keys(WORLD_BANK_INDICATOR_CONFIG) as WorldBankIndicatorId[]);
  const countryCodes =
    options.countryCodes ?? (Object.keys(WORLD_BANK_COUNTRIES) as WorldBankCountryCode[]);
  const validationOptions: ValidationOptions = options.validation ?? {};

  console.log("=".repeat(60));
  console.log("World Bank Historical Data Import");
  console.log("=".repeat(60));
  console.log(`Year range: ${startYear} - ${endYear}`);
  console.log(`Indicators to import: ${indicatorIds.length}`);
  console.log(`Countries to import: ${countryCodes.length}`);
  console.log(`Validation: ${Object.keys(validationOptions).length > 0 ? JSON.stringify(validationOptions) : "default"}`);
  console.log("");

  const worldBankClient = new WorldBankClient();
  const supabase = createSupabaseClient();

  const result: ImportResult = {
    totalIndicators: indicatorIds.length,
    totalCountries: countryCodes.length,
    successfulImports: 0,
    failedImports: 0,
    totalObservations: 0,
    totalInserted: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    importResults: [],
    errors: [],
  };

  for (let i = 0; i < indicatorIds.length; i++) {
    const indicatorId = indicatorIds[i];
    console.log(`[${i + 1}/${indicatorIds.length}] Processing ${indicatorId}...`);

    const indicatorResults = await importIndicator(
      worldBankClient,
      supabase,
      indicatorId,
      countryCodes,
      startYear,
      endYear,
      validationOptions
    );

    for (const ir of indicatorResults) {
      result.importResults.push(ir);

      if (ir.error) {
        result.failedImports++;
        result.errors.push(`${ir.indicatorId} (${ir.countryCode}): ${ir.error}`);
      } else if (ir.observationsCount > 0) {
        result.successfulImports++;
      }

      result.totalObservations += ir.observationsCount;
      result.totalInserted += ir.insertedCount;
      result.totalUpdated += ir.updatedCount;
      result.totalSkipped += ir.skippedCount;
    }

    // Log progress for this indicator
    const indicatorInserted = indicatorResults.reduce((sum, r) => sum + r.insertedCount, 0);
    const indicatorUpdated = indicatorResults.reduce((sum, r) => sum + r.updatedCount, 0);
    const indicatorSkipped = indicatorResults.reduce((sum, r) => sum + r.skippedCount, 0);
    console.log(`  Summary: ${indicatorInserted} new, ${indicatorUpdated} updated, ${indicatorSkipped} skipped`);
    console.log("");
  }

  // Print summary
  console.log("=".repeat(60));
  console.log("Import Summary");
  console.log("=".repeat(60));
  console.log(`Total indicators: ${result.totalIndicators}`);
  console.log(`Total countries: ${result.totalCountries}`);
  console.log(`Successful imports: ${result.successfulImports}`);
  console.log(`Failed imports: ${result.failedImports}`);
  console.log(`Total observations: ${result.totalObservations}`);
  console.log(`Inserted: ${result.totalInserted}`);
  console.log(`Updated: ${result.totalUpdated}`);
  console.log(`Skipped: ${result.totalSkipped}`);

  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    // Limit error output to first 20 to avoid overwhelming console
    const errorsToShow = result.errors.slice(0, 20);
    for (const error of errorsToShow) {
      console.log(`  - ${error}`);
    }
    if (result.errors.length > 20) {
      console.log(`  ... and ${result.errors.length - 20} more errors`);
    }
  }

  return result;
}

// CLI entry point
if (require.main === module) {
  const startYear = process.env.WORLD_BANK_IMPORT_START_YEAR ?? DEFAULT_START_YEAR;
  const endYear = process.env.WORLD_BANK_IMPORT_END_YEAR ?? new Date().getFullYear().toString();
  
  const indicatorsEnv = process.env.WORLD_BANK_IMPORT_INDICATORS;
  const indicatorIds = indicatorsEnv
    ? (indicatorsEnv.split(",").map((s) => s.trim()) as WorldBankIndicatorId[])
    : undefined;

  const countriesEnv = process.env.WORLD_BANK_IMPORT_COUNTRIES;
  const countryCodes = countriesEnv
    ? (countriesEnv.split(",").map((s) => s.trim()) as WorldBankCountryCode[])
    : undefined;

  importWorldBankHistoricalData({ startYear, endYear, indicatorIds, countryCodes })
    .then((result) => {
      if (result.failedImports > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error("Import failed:", error);
      process.exit(1);
    });
}
