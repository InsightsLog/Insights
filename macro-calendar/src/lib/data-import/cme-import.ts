/**
 * CME Economic Calendar Import Script
 *
 * This script imports upcoming economic events from CME Group's
 * Economic Releases Calendar. No API keys required - uses web scraping.
 *
 * This replaces the paid FMP, Finnhub, and Trading Economics APIs.
 *
 * Features:
 * - Scrapes CME Group's public economic calendar
 * - Tracks event schedule changes for alerts
 * - No API key or subscription required
 * - Deduplicates with existing database releases
 *
 * Usage:
 *   npx tsx src/lib/data-import/cme-import.ts
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { CMECalendarClient, CMECalendarEvent, CMEMonthFetchError } from "./cme-calendar-client";

// Default: import 2 months of upcoming events
const DEFAULT_MONTHS = 2;

/**
 * Normalized event structure for import.
 */
interface NormalizedEvent {
  country: string;
  event: string;
  date: string;
  time: string;
  impact: "Low" | "Medium" | "High";
  source: "cme";
  category: string;
  link: string;
}

/**
 * Import result for tracking.
 */
export interface CMEImportResult {
  source: {
    name: "CME Group";
    events: number;
    errors: string[];
  };
  totalEvents: number;
  indicatorsCreated: number;
  releasesCreated: number;
  releasesSkipped: number;
  releasesUpdated: number;
  schedulesChanged: ScheduleChange[];
  countriesCovered: string[];
  errors: string[];
  /** True if all month fetches failed (data source unavailable) */
  dataSourceUnavailable: boolean;
  /** Detailed fetch errors for each failed month */
  fetchErrors: CMEMonthFetchError[];
}

/**
 * Schedule change detection for alerts.
 */
export interface ScheduleChange {
  indicatorId: string;
  indicatorName: string;
  country: string;
  changeType: "time_changed" | "date_changed" | "cancelled" | "new";
  oldValue?: string;
  newValue?: string;
  releaseId?: string;
}

/**
 * Format a fetch error for display.
 */
function formatFetchError(error: CMEMonthFetchError): string {
  const monthStr = `${error.year}-${String(error.month).padStart(2, "0")}`;
  const statusStr = error.statusCode ? ` (HTTP ${error.statusCode})` : "";
  return `${monthStr}: ${error.message}${statusStr}`;
}

/**
 * Format year-month for display (YYYY-MM format).
 */
export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Create a deduplication key from an event.
 */
function createDedupeKey(country: string, eventName: string, date: string): string {
  const normalizedEvent = eventName
    .toLowerCase()
    .replace(/\s*(yoy|mom|qoq|sa|nsa|final|preliminary|flash|revised)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${country.toUpperCase()}:${normalizedEvent}:${date}`;
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
 * Get or create an indicator for an event.
 * Returns the indicator ID and whether it was newly created.
 */
async function getOrCreateIndicator(
  supabase: SupabaseClient,
  event: NormalizedEvent,
  indicatorCache: Map<string, string>
): Promise<{ id: string; created: boolean }> {
  const cacheKey = `${event.country}:${event.event}`;

  if (indicatorCache.has(cacheKey)) {
    return { id: indicatorCache.get(cacheKey)!, created: false };
  }

  // Try to find existing indicator
  const { data: existing, error: fetchError } = await supabase
    .from("indicators")
    .select("id")
    .eq("name", event.event)
    .eq("country_code", event.country)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw new Error(`Failed to fetch indicator: ${fetchError.message}`);
  }

  if (existing) {
    indicatorCache.set(cacheKey, existing.id);
    return { id: existing.id, created: false };
  }

  // Create new indicator
  const { data: inserted, error: insertError } = await supabase
    .from("indicators")
    .insert({
      name: event.event,
      country_code: event.country,
      category: event.category,
      source_name: "CME Group",
      source_url: event.link,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to create indicator: ${insertError.message}`);
  }

  indicatorCache.set(cacheKey, inserted.id);
  return { id: inserted.id, created: true };
}

/**
 * Format the period string from a date.
 */
function formatPeriod(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

/**
 * Normalize CME events to standard format.
 */
function normalizeEvents(events: CMECalendarEvent[]): NormalizedEvent[] {
  return events.map((event) => ({
    country: event.country,
    event: event.event,
    date: event.date,
    time: event.time,
    impact: event.impact,
    source: "cme" as const,
    category: event.category,
    link: event.link,
  }));
}

/**
 * Deduplicate events.
 */
function deduplicateEvents(allEvents: NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Map<string, NormalizedEvent>();

  for (const event of allEvents) {
    const key = createDedupeKey(event.country, event.event, event.date);
    if (!seen.has(key)) {
      seen.set(key, event);
    }
  }

  return Array.from(seen.values());
}

/**
 * Import upcoming economic events from CME Group.
 */
export async function importCMEEvents(
  options: {
    months?: number;
  } = {}
): Promise<CMEImportResult> {
  const months = options.months ?? DEFAULT_MONTHS;

  console.log("=".repeat(60));
  console.log("CME Group Economic Events Import");
  console.log("=".repeat(60));
  console.log(`Fetching ${months} months of upcoming events...`);
  console.log("");

  const result: CMEImportResult = {
    source: {
      name: "CME Group",
      events: 0,
      errors: [],
    },
    totalEvents: 0,
    indicatorsCreated: 0,
    releasesCreated: 0,
    releasesSkipped: 0,
    releasesUpdated: 0,
    schedulesChanged: [],
    countriesCovered: [],
    errors: [],
    dataSourceUnavailable: false,
    fetchErrors: [],
  };

  try {
    // Fetch events from CME
    console.log("Fetching from CME Group Economic Calendar...");
    const client = new CMECalendarClient();
    const fetchResult = await client.getUpcomingEventsWithErrors(months);
    const cmeEvents = fetchResult.events;
    
    // Track fetch errors
    result.fetchErrors = fetchResult.errors;
    for (const fetchError of fetchResult.errors) {
      result.source.errors.push(`Fetch failed for ${formatFetchError(fetchError)}`);
    }
    
    // Check if all months failed (data source unavailable)
    if (fetchResult.allMonthsFailed) {
      result.dataSourceUnavailable = true;
      const errorMsg = "CME Group calendar data source is unavailable. All fetch attempts failed.";
      result.errors.push(errorMsg);
      console.error("ERROR: " + errorMsg);
      console.error("Fetch errors:");
      for (const fetchError of fetchResult.errors) {
        console.error(`  - ${formatFetchError(fetchError)}`);
      }
      return result;
    }

    console.log(`  Found ${cmeEvents.length} events`);
    if (fetchResult.errors.length > 0) {
      console.warn(`  (${fetchResult.errors.length} month(s) failed to fetch)`);
    }
    result.source.events = cmeEvents.length;

    if (cmeEvents.length === 0) {
      console.log("No events found from CME.");
      return result;
    }

    // Normalize and deduplicate
    const normalizedEvents = normalizeEvents(cmeEvents);
    const uniqueEvents = deduplicateEvents(normalizedEvents);
    result.totalEvents = uniqueEvents.length;

    console.log(`Unique events after dedup: ${uniqueEvents.length}`);

    // Track countries
    const countriesSet = new Set<string>();
    uniqueEvents.forEach((e) => countriesSet.add(e.country));
    result.countriesCovered = Array.from(countriesSet).sort();
    console.log(`Countries covered: ${result.countriesCovered.length}`);
    console.log("");

    // Import to database
    console.log("Importing to database...");
    const supabase = createSupabaseClient();
    const indicatorCache = new Map<string, string>();
    let indicatorsCreatedCount = 0;

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

    for (let i = 0; i < uniqueEvents.length; i++) {
      const event = uniqueEvents[i];

      try {
        const { id: indicatorId, created } = await getOrCreateIndicator(supabase, event, indicatorCache);
        if (created) {
          indicatorsCreatedCount++;
        }

        // Construct release datetime (CME times are in ET)
        const releaseAt = new Date(`${event.date}T${event.time}:00-05:00`).toISOString();
        const period = formatPeriod(event.date);

        // Check if release already exists
        const { data: existing } = await supabase
          .from("releases")
          .select("id, release_at")
          .eq("indicator_id", indicatorId)
          .gte("release_at", `${event.date}T00:00:00Z`)
          .lte("release_at", `${event.date}T23:59:59Z`)
          .single();

        if (existing) {
          // Check for schedule changes
          if (existing.release_at !== releaseAt) {
            result.schedulesChanged.push({
              indicatorId,
              indicatorName: event.event,
              country: event.country,
              changeType: "time_changed",
              oldValue: existing.release_at,
              newValue: releaseAt,
              releaseId: existing.id,
            });

            // Update the release time
            const { error: updateError } = await supabase
              .from("releases")
              .update({ release_at: releaseAt })
              .eq("id", existing.id);

            if (!updateError) {
              result.releasesUpdated++;
            }
          } else {
            result.releasesSkipped++;
          }
          continue;
        }

        releasesToInsert.push({
          indicator_id: indicatorId,
          release_at: releaseAt,
          period,
          forecast: null,
          previous: null,
          actual: null,
          notes: `Impact: ${event.impact}. Source: CME Group.`,
        });

        if ((i + 1) % 100 === 0) {
          console.log(`  Processed ${i + 1}/${uniqueEvents.length} events...`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Event "${event.event}" (${event.country}): ${msg}`);
      }
    }

    // Batch insert releases
    if (releasesToInsert.length > 0) {
      console.log(`Inserting ${releasesToInsert.length} releases...`);

      for (let i = 0; i < releasesToInsert.length; i += BATCH_SIZE) {
        const batch = releasesToInsert.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from("releases").insert(batch);

        if (insertError) {
          result.errors.push(`Batch insert error: ${insertError.message}`);
        } else {
          result.releasesCreated += batch.length;
        }
      }
    }

    result.indicatorsCreated = indicatorsCreatedCount;

    // Log schedule changes
    if (result.schedulesChanged.length > 0) {
      console.log("");
      console.log(`⚠️ Schedule changes detected: ${result.schedulesChanged.length}`);
      for (const change of result.schedulesChanged.slice(0, 5)) {
        console.log(`  - ${change.indicatorName} (${change.country}): ${change.changeType}`);
        if (change.oldValue && change.newValue) {
          console.log(`    Old: ${change.oldValue}`);
          console.log(`    New: ${change.newValue}`);
        }
      }
      if (result.schedulesChanged.length > 5) {
        console.log(`  ... and ${result.schedulesChanged.length - 5} more`);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Fatal error: ${msg}`);
    result.source.errors.push(msg);
    console.error("Import error:", error);
  }

  // Print summary
  console.log("");
  console.log("=".repeat(60));
  console.log("Import Summary");
  console.log("=".repeat(60));
  console.log(`Source: CME Group`);
  console.log(`Total events: ${result.totalEvents}`);
  console.log(`Countries covered: ${result.countriesCovered.length}`);
  console.log(`Indicators created: ${result.indicatorsCreated}`);
  console.log(`Releases created: ${result.releasesCreated}`);
  console.log(`Releases updated: ${result.releasesUpdated}`);
  console.log(`Releases skipped (already in DB): ${result.releasesSkipped}`);
  console.log(`Schedule changes detected: ${result.schedulesChanged.length}`);

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
  const months = parseInt(process.env.CME_IMPORT_MONTHS ?? String(DEFAULT_MONTHS), 10);

  importCMEEvents({ months })
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
