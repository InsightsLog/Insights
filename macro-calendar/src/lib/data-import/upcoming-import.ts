/**
 * Unified Upcoming Economic Calendar Import Script
 *
 * This script imports upcoming economic events from multiple sources
 * with built-in deduplication to avoid duplicate releases in the database.
 *
 * Sources (in priority order):
 * 1. Financial Modeling Prep (FMP) - Primary source
 * 2. Finnhub - Secondary source for additional coverage
 * 3. Trading Economics - Tertiary source for comprehensive G20+ data
 *
 * Deduplication Strategy:
 * - Events are deduplicated based on: country + event name (normalized) + date
 * - If the same event exists in multiple sources, the first source takes priority
 * - Existing database releases are checked to avoid duplicates
 *
 * Usage:
 *   npx tsx src/lib/data-import/upcoming-import.ts
 *
 * Environment variables (at least one required):
 *   - FMP_API_KEY: Financial Modeling Prep API key
 *   - FINNHUB_API_KEY: Finnhub API key  
 *   - TRADING_ECONOMICS_API_KEY: Trading Economics API key
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { FMPCalendarClient, categorizeEvent as categorizeFMPEvent } from "./fmp-calendar-client";
import { FinnhubCalendarClient } from "./finnhub-calendar-client";
import { TECalendarClient } from "./trading-economics-client";
import { getFMPApiKey, getFinnhubApiKey, getTradingEconomicsApiKey } from "@/lib/env";

// Default: import 30 days of upcoming events
const DEFAULT_DAYS = 30;

/**
 * Normalized event structure for deduplication and import.
 */
interface NormalizedEvent {
  country: string; // ISO country code
  event: string; // Event name
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  actual: number | null;
  previous: number | null;
  estimate: number | null;
  unit: string;
  impact: "Low" | "Medium" | "High";
  source: "fmp" | "finnhub" | "trading_economics";
  category: string;
}

/**
 * Import result for tracking.
 */
export interface UpcomingImportResult {
  sources: {
    fmp: { available: boolean; events: number; errors: string[] };
    finnhub: { available: boolean; events: number; errors: string[] };
    tradingEconomics: { available: boolean; events: number; errors: string[] };
  };
  totalEventsFromSources: number;
  uniqueEventsAfterDedup: number;
  indicatorsCreated: number;
  releasesCreated: number;
  releasesSkipped: number; // Duplicates with DB
  countriesCovered: string[];
  errors: string[];
}

/**
 * Create a deduplication key from an event.
 * Uses lowercase normalized event name + country + date.
 */
function createDedupeKey(country: string, eventName: string, date: string): string {
  // Normalize event name: lowercase, remove extra spaces, common variations
  const normalizedEvent = eventName
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    // Remove common suffixes/prefixes that vary between sources
    .replace(/\s*(yoy|mom|qoq|sa|nsa|final|preliminary|flash|revised)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  return `${country.toUpperCase()}:${normalizedEvent}:${date}`;
}

/**
 * Categorize an event based on its name.
 */
function categorizeEvent(eventName: string): string {
  const lower = eventName.toLowerCase();
  
  if (lower.includes("gdp") || lower.includes("gross domestic")) return "GDP";
  if (lower.includes("cpi") || lower.includes("inflation") || lower.includes("consumer price") || 
      lower.includes("ppi") || lower.includes("producer price")) return "Inflation";
  if (lower.includes("employment") || lower.includes("unemployment") || lower.includes("payroll") ||
      lower.includes("jobless") || lower.includes("jobs") || lower.includes("labor")) return "Employment";
  if (lower.includes("interest rate") || lower.includes("rate decision") || lower.includes("monetary") ||
      lower.includes("central bank") || lower.includes("fed ") || lower.includes("ecb ") ||
      lower.includes("boj ") || lower.includes("boe ")) return "Interest Rates";
  if (lower.includes("retail") || lower.includes("consumer") || lower.includes("sentiment") ||
      lower.includes("confidence")) return "Consumer";
  if (lower.includes("housing") || lower.includes("building") || lower.includes("home") ||
      lower.includes("construction")) return "Housing";
  if (lower.includes("manufacturing") || lower.includes("industrial") || lower.includes("pmi") ||
      lower.includes("factory")) return "Manufacturing";
  if (lower.includes("trade") || lower.includes("export") || lower.includes("import") ||
      lower.includes("balance")) return "Trade";
  if (lower.includes("bond") || lower.includes("auction") || lower.includes("treasury") ||
      lower.includes("bill")) return "Bonds";
  
  return "Other";
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
 * Fetch events from FMP.
 */
async function fetchFMPEvents(
  fromDate: Date,
  toDate: Date
): Promise<{ events: NormalizedEvent[]; errors: string[] }> {
  const errors: string[] = [];
  const events: NormalizedEvent[] = [];

  try {
    const client = new FMPCalendarClient();
    const fmpEvents = await client.getUpcomingEvents(fromDate, toDate);
    
    for (const event of fmpEvents) {
      const dateStr = event.date.split(" ")[0];
      const timeStr = event.date.split(" ")[1]?.substring(0, 5) ?? "00:00";
      
      events.push({
        country: event.country,
        event: event.event,
        date: dateStr,
        time: timeStr,
        actual: event.actual,
        previous: event.previous,
        estimate: event.estimate,
        unit: event.currency ?? "",
        impact: event.impact,
        source: "fmp",
        category: categorizeFMPEvent(event.event),
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    errors.push(`FMP: ${msg}`);
  }

  return { events, errors };
}

/**
 * Fetch events from Finnhub.
 */
async function fetchFinnhubEvents(
  fromDate: Date,
  toDate: Date
): Promise<{ events: NormalizedEvent[]; errors: string[] }> {
  const errors: string[] = [];
  const events: NormalizedEvent[] = [];

  try {
    const client = new FinnhubCalendarClient();
    const finnhubEvents = await client.getNormalizedEvents(fromDate, toDate);
    
    for (const event of finnhubEvents) {
      events.push({
        country: event.country,
        event: event.event,
        date: event.date,
        time: event.time,
        actual: event.actual,
        previous: event.previous,
        estimate: event.estimate,
        unit: event.unit,
        impact: event.impact,
        source: "finnhub",
        category: categorizeEvent(event.event),
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    errors.push(`Finnhub: ${msg}`);
  }

  return { events, errors };
}

/**
 * Fetch events from Trading Economics.
 */
async function fetchTEEvents(): Promise<{ events: NormalizedEvent[]; errors: string[] }> {
  const errors: string[] = [];
  const events: NormalizedEvent[] = [];

  try {
    const client = new TECalendarClient();
    const teEvents = await client.getNormalizedEvents();
    
    for (const event of teEvents) {
      events.push({
        country: event.country,
        event: event.event,
        date: event.date,
        time: event.time,
        actual: event.actual,
        previous: event.previous,
        estimate: event.estimate,
        unit: event.unit,
        impact: event.impact,
        source: "trading_economics",
        category: categorizeEvent(event.event),
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    errors.push(`Trading Economics: ${msg}`);
  }

  return { events, errors };
}

/**
 * Deduplicate events across sources.
 * Priority: FMP > Finnhub > Trading Economics
 */
function deduplicateEvents(allEvents: NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Map<string, NormalizedEvent>();
  
  // Sort by source priority (fmp first, then finnhub, then trading_economics)
  const priorityOrder = { fmp: 0, finnhub: 1, trading_economics: 2 };
  const sorted = [...allEvents].sort(
    (a, b) => priorityOrder[a.source] - priorityOrder[b.source]
  );

  for (const event of sorted) {
    const key = createDedupeKey(event.country, event.event, event.date);
    if (!seen.has(key)) {
      seen.set(key, event);
    }
  }

  return Array.from(seen.values());
}

/**
 * Get or create an indicator for an event.
 */
async function getOrCreateIndicator(
  supabase: SupabaseClient,
  event: NormalizedEvent,
  indicatorCache: Map<string, string>
): Promise<string> {
  const cacheKey = `${event.country}:${event.event}`;

  if (indicatorCache.has(cacheKey)) {
    return indicatorCache.get(cacheKey)!;
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
    return existing.id;
  }

  // Create new indicator
  const sourceName = {
    fmp: "Financial Modeling Prep",
    finnhub: "Finnhub",
    trading_economics: "Trading Economics",
  }[event.source];

  const { data: inserted, error: insertError } = await supabase
    .from("indicators")
    .insert({
      name: event.event,
      country_code: event.country,
      category: event.category,
      source_name: sourceName,
      source_url: getSourceUrl(event.source),
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
 * Get source URL for an event.
 */
function getSourceUrl(source: "fmp" | "finnhub" | "trading_economics"): string {
  switch (source) {
    case "fmp":
      return "https://financialmodelingprep.com";
    case "finnhub":
      return "https://finnhub.io";
    case "trading_economics":
      return "https://tradingeconomics.com";
  }
}

/**
 * Format value as string for display.
 */
function formatValue(value: number | null): string | null {
  if (value === null) return null;
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (Math.abs(value) >= 1) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/**
 * Format the period string from a date.
 */
function formatPeriod(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

/**
 * Import upcoming economic events from all available sources.
 */
export async function importUpcomingEvents(
  options: {
    days?: number;
    fmpApiKey?: string;
    finnhubApiKey?: string;
    teApiKey?: string;
  } = {}
): Promise<UpcomingImportResult> {
  const days = options.days ?? DEFAULT_DAYS;
  const fromDate = new Date();
  const toDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  console.log("=".repeat(60));
  console.log("Unified Upcoming Economic Events Import");
  console.log("=".repeat(60));
  console.log(`Date range: ${fromDate.toISOString().split("T")[0]} to ${toDate.toISOString().split("T")[0]}`);
  console.log(`Days: ${days}`);
  console.log("");

  // Check which sources are available
  const fmpAvailable = !!(options.fmpApiKey ?? getFMPApiKey());
  const finnhubAvailable = !!(options.finnhubApiKey ?? getFinnhubApiKey());
  const teAvailable = !!(options.teApiKey ?? getTradingEconomicsApiKey());

  console.log("Available sources:");
  console.log(`  FMP: ${fmpAvailable ? "✓" : "✗"}`);
  console.log(`  Finnhub: ${finnhubAvailable ? "✓" : "✗"}`);
  console.log(`  Trading Economics: ${teAvailable ? "✓" : "✗"}`);
  console.log("");

  if (!fmpAvailable && !finnhubAvailable && !teAvailable) {
    throw new Error(
      "No API keys configured. Set at least one of: FMP_API_KEY, FINNHUB_API_KEY, TRADING_ECONOMICS_API_KEY"
    );
  }

  const result: UpcomingImportResult = {
    sources: {
      fmp: { available: fmpAvailable, events: 0, errors: [] },
      finnhub: { available: finnhubAvailable, events: 0, errors: [] },
      tradingEconomics: { available: teAvailable, events: 0, errors: [] },
    },
    totalEventsFromSources: 0,
    uniqueEventsAfterDedup: 0,
    indicatorsCreated: 0,
    releasesCreated: 0,
    releasesSkipped: 0,
    countriesCovered: [],
    errors: [],
  };

  // Fetch events from all available sources
  const allEvents: NormalizedEvent[] = [];

  if (fmpAvailable) {
    console.log("Fetching from FMP...");
    const fmpResult = await fetchFMPEvents(fromDate, toDate);
    allEvents.push(...fmpResult.events);
    result.sources.fmp.events = fmpResult.events.length;
    result.sources.fmp.errors = fmpResult.errors;
    console.log(`  Found ${fmpResult.events.length} events`);
    if (fmpResult.errors.length > 0) {
      console.log(`  Errors: ${fmpResult.errors.join(", ")}`);
    }
  }

  if (finnhubAvailable) {
    console.log("Fetching from Finnhub...");
    const finnhubResult = await fetchFinnhubEvents(fromDate, toDate);
    allEvents.push(...finnhubResult.events);
    result.sources.finnhub.events = finnhubResult.events.length;
    result.sources.finnhub.errors = finnhubResult.errors;
    console.log(`  Found ${finnhubResult.events.length} events`);
    if (finnhubResult.errors.length > 0) {
      console.log(`  Errors: ${finnhubResult.errors.join(", ")}`);
    }
  }

  if (teAvailable) {
    console.log("Fetching from Trading Economics...");
    const teResult = await fetchTEEvents();
    allEvents.push(...teResult.events);
    result.sources.tradingEconomics.events = teResult.events.length;
    result.sources.tradingEconomics.errors = teResult.errors;
    console.log(`  Found ${teResult.events.length} events`);
    if (teResult.errors.length > 0) {
      console.log(`  Errors: ${teResult.errors.join(", ")}`);
    }
  }

  result.totalEventsFromSources = allEvents.length;
  console.log("");
  console.log(`Total events from all sources: ${allEvents.length}`);

  // Deduplicate events
  console.log("Deduplicating events...");
  const uniqueEvents = deduplicateEvents(allEvents);
  result.uniqueEventsAfterDedup = uniqueEvents.length;
  console.log(`Unique events after dedup: ${uniqueEvents.length}`);
  console.log(`Duplicates removed: ${allEvents.length - uniqueEvents.length}`);

  if (uniqueEvents.length === 0) {
    console.log("No events to import.");
    return result;
  }

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
  const initialCacheSize = indicatorCache.size;

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
      const indicatorId = await getOrCreateIndicator(supabase, event, indicatorCache);
      
      // Construct release datetime
      const releaseAt = new Date(`${event.date}T${event.time}:00Z`).toISOString();
      const period = formatPeriod(event.date);

      // Check if release already exists in DB
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

      releasesToInsert.push({
        indicator_id: indicatorId,
        release_at: releaseAt,
        period,
        forecast: formatValue(event.estimate),
        previous: formatValue(event.previous),
        actual: formatValue(event.actual),
        notes: `Impact: ${event.impact}. Source: ${event.source}.`,
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

  result.indicatorsCreated = indicatorCache.size - initialCacheSize;

  // Print summary
  console.log("");
  console.log("=".repeat(60));
  console.log("Import Summary");
  console.log("=".repeat(60));
  console.log(`Sources used: ${[fmpAvailable && "FMP", finnhubAvailable && "Finnhub", teAvailable && "TE"].filter(Boolean).join(", ")}`);
  console.log(`Total events from sources: ${result.totalEventsFromSources}`);
  console.log(`Unique events after dedup: ${result.uniqueEventsAfterDedup}`);
  console.log(`Countries covered: ${result.countriesCovered.length}`);
  console.log(`Indicators created: ${result.indicatorsCreated}`);
  console.log(`Releases created: ${result.releasesCreated}`);
  console.log(`Releases skipped (already in DB): ${result.releasesSkipped}`);

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
  const days = parseInt(process.env.UPCOMING_IMPORT_DAYS ?? String(DEFAULT_DAYS), 10);

  importUpcomingEvents({ days })
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
