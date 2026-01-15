/**
 * FMP Upcoming Economic Calendar Import Script
 *
 * This script imports upcoming economic events from the Financial Modeling Prep (FMP) API
 * into the macro calendar database. It covers G20+ countries for global economic coverage.
 *
 * Usage:
 *   npx tsx src/lib/data-import/fmp-upcoming-import.ts
 *
 * Environment variables required:
 *   - FMP_API_KEY: Your FMP API key (get free at https://financialmodelingprep.com/register)
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for bypassing RLS)
 *
 * Optional environment variables:
 *   - FMP_IMPORT_DAYS: Number of days to import (default: 30)
 *
 * Features:
 *   - Imports upcoming economic events for G20+ countries
 *   - Creates indicators if they don't exist
 *   - Creates scheduled releases (future dates with actual=NULL)
 *   - Deduplicates based on (indicator_id, release_at, period)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  FMPCalendarClient,
  FMPCalendarEvent,
  COUNTRY_NAMES,
  G20PlusCountry,
  categorizeEvent,
} from "./fmp-calendar-client";

// Default: import 30 days of upcoming events
const DEFAULT_DAYS = 30;

// Source information
const FMP_SOURCE_NAME = "Financial Modeling Prep";
const FMP_SOURCE_URL = "https://financialmodelingprep.com";

/**
 * Import result for tracking.
 */
interface ImportResult {
  totalEvents: number;
  indicatorsCreated: number;
  releasesCreated: number;
  releasesUpdated: number;
  releasesSkipped: number;
  countriesCovered: string[];
  errors: string[];
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
 * Get or create an indicator for an FMP event.
 */
async function getOrCreateIndicator(
  supabase: SupabaseClient,
  event: FMPCalendarEvent,
  indicatorCache: Map<string, string>
): Promise<string> {
  // Create a unique key for this indicator
  const cacheKey = `${event.country}:${event.event}`;

  // Check cache first
  if (indicatorCache.has(cacheKey)) {
    return indicatorCache.get(cacheKey)!;
  }

  const countryCode = event.country;
  const indicatorName = event.event;
  const category = categorizeEvent(event.event);

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
    indicatorCache.set(cacheKey, existing.id);
    return existing.id;
  }

  // Create new indicator
  const { data: inserted, error: insertError } = await supabase
    .from("indicators")
    .insert({
      name: indicatorName,
      country_code: countryCode,
      category,
      source_name: FMP_SOURCE_NAME,
      source_url: FMP_SOURCE_URL,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to create indicator: ${insertError.message}`);
  }

  indicatorCache.set(cacheKey, inserted.id);
  return inserted.id;
}

/**
 * Format the period string from an FMP event date.
 * Extracts a human-readable period like "Jan 2026" from "2026-01-15 14:30:00"
 */
function formatPeriod(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

/**
 * Format previous/estimate values as strings for display.
 */
function formatValue(value: number | null): string | null {
  if (value === null) return null;
  // Format with appropriate precision
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (Math.abs(value) >= 1) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/**
 * Import upcoming economic events from FMP.
 */
export async function importFMPUpcomingEvents(
  options: {
    days?: number;
    apiKey?: string;
    countries?: string[];
    minImpact?: "Low" | "Medium" | "High";
  } = {}
): Promise<ImportResult> {
  const days = options.days ?? DEFAULT_DAYS;
  const fromDate = new Date();
  const toDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  console.log("=".repeat(60));
  console.log("FMP Upcoming Economic Events Import");
  console.log("=".repeat(60));
  console.log(`Date range: ${fromDate.toISOString().split("T")[0]} to ${toDate.toISOString().split("T")[0]}`);
  console.log(`Days: ${days}`);
  console.log(`Min impact: ${options.minImpact ?? "all"}`);
  console.log("");

  const client = new FMPCalendarClient(options.apiKey);
  const supabase = createSupabaseClient();

  const result: ImportResult = {
    totalEvents: 0,
    indicatorsCreated: 0,
    releasesCreated: 0,
    releasesUpdated: 0,
    releasesSkipped: 0,
    countriesCovered: [],
    errors: [],
  };

  try {
    // Fetch upcoming events
    console.log("Fetching upcoming events from FMP...");
    let events: FMPCalendarEvent[];

    if (options.minImpact) {
      events = await client.getHighImpactEvents(fromDate, toDate, options.minImpact);
    } else {
      events = await client.getUpcomingEvents(fromDate, toDate, options.countries);
    }

    result.totalEvents = events.length;
    console.log(`Found ${events.length} upcoming events`);

    if (events.length === 0) {
      console.log("No upcoming events found.");
      return result;
    }

    // Track countries covered
    const countriesSet = new Set<string>();
    events.forEach((e) => countriesSet.add(e.country));
    result.countriesCovered = Array.from(countriesSet).sort();
    console.log(`Countries: ${result.countriesCovered.join(", ")}`);
    console.log("");

    // Cache for indicators to avoid repeated lookups
    const indicatorCache = new Map<string, string>();

    // Count new indicators before import
    const initialIndicatorCount = indicatorCache.size;

    // Process events in batches
    const BATCH_SIZE = 50;
    const releasesToInsert: Array<{
      indicator_id: string;
      release_at: string;
      period: string;
      forecast: string | null;
      previous: string | null;
      actual: string | null;
      notes: string;
    }> = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      try {
        // Get or create indicator
        const indicatorId = await getOrCreateIndicator(
          supabase,
          event,
          indicatorCache
        );

        // Parse the release date
        const releaseAt = new Date(event.date).toISOString();
        const period = formatPeriod(event.date);

        // Check if release already exists
        const { data: existing } = await supabase
          .from("releases")
          .select("id")
          .eq("indicator_id", indicatorId)
          .eq("release_at", releaseAt)
          .single();

        if (existing) {
          result.releasesSkipped++;
          continue;
        }

        // Prepare release data
        releasesToInsert.push({
          indicator_id: indicatorId,
          release_at: releaseAt,
          period,
          forecast: formatValue(event.estimate),
          previous: formatValue(event.previous),
          actual: formatValue(event.actual), // Usually null for upcoming events
          notes: `Impact: ${event.impact}. Imported from FMP.`,
        });

        // Log progress
        if ((i + 1) % 100 === 0) {
          console.log(`Processed ${i + 1}/${events.length} events...`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Event "${event.event}" (${event.country}): ${errorMsg}`);
      }
    }

    // Batch insert releases
    if (releasesToInsert.length > 0) {
      console.log(`\nInserting ${releasesToInsert.length} releases...`);

      for (let i = 0; i < releasesToInsert.length; i += BATCH_SIZE) {
        const batch = releasesToInsert.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
          .from("releases")
          .insert(batch);

        if (insertError) {
          result.errors.push(`Batch insert error: ${insertError.message}`);
        } else {
          result.releasesCreated += batch.length;
        }
      }
    }

    // Calculate new indicators created
    result.indicatorsCreated = indicatorCache.size - initialIndicatorCount;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Fatal error: ${errorMsg}`);
    console.error("Import error:", error);
  }

  // Print summary
  console.log("");
  console.log("=".repeat(60));
  console.log("Import Summary");
  console.log("=".repeat(60));
  console.log(`Total events: ${result.totalEvents}`);
  console.log(`Countries covered: ${result.countriesCovered.length}`);
  console.log(`Indicators created: ${result.indicatorsCreated}`);
  console.log(`Releases created: ${result.releasesCreated}`);
  console.log(`Releases skipped (duplicates): ${result.releasesSkipped}`);

  if (result.errors.length > 0) {
    console.log("");
    console.log(`Errors (${result.errors.length}):`);
    for (const error of result.errors.slice(0, 10)) {
      console.log(`  - ${error}`);
    }
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
  }

  return result;
}

// CLI entry point
if (require.main === module) {
  const days = parseInt(process.env.FMP_IMPORT_DAYS ?? String(DEFAULT_DAYS), 10);

  importFMPUpcomingEvents({ days })
    .then((result) => {
      if (result.errors.length > 0 && result.releasesCreated === 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error("Import failed:", error);
      process.exit(1);
    });
}
