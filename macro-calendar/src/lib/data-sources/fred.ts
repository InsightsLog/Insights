/**
 * FRED (Federal Reserve Economic Data) API Client
 *
 * Fetches economic data from the St. Louis Fed's FRED API.
 * Handles series observations, metadata, and release schedules.
 *
 * API documentation: https://fred.stlouisfed.org/docs/api/fred/
 *
 * Task: T404 - Add FRED API integration
 */

import { z } from "zod";

/**
 * FRED API base URL.
 */
const FRED_API_BASE = "https://api.stlouisfed.org/fred";

/**
 * Default number of retries on transient failures.
 */
const MAX_RETRIES = 3;

/**
 * Delay between retries in milliseconds (doubles each attempt).
 */
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Mapping of common FRED series IDs to indicator names.
 * Used to match FRED data to existing indicators in the database.
 */
export const FRED_SERIES_MAP: Record<string, string> = {
  // US Inflation
  CPIAUCSL: "CPI (Consumer Price Index)",
  CPILFESL: "Core CPI (ex Food & Energy)",
  PCEPI: "PCE Price Index",
  PCEPILFE: "Core PCE Price Index",

  // US Employment
  PAYEMS: "Nonfarm Payrolls",
  UNRATE: "Unemployment Rate",
  ICSA: "Initial Jobless Claims",
  CCSA: "Continuing Jobless Claims",
  CES0500000003: "Average Hourly Earnings",

  // US GDP & Output
  GDP: "Gross Domestic Product",
  GDPC1: "Real GDP",
  INDPRO: "Industrial Production",
  RSAFS: "Retail Sales",

  // US Housing
  HOUST: "Housing Starts",
  PERMIT: "Building Permits",
  EXHOSLUSM495S: "Existing Home Sales",
  HSN1F: "New Home Sales",

  // US Trade & International
  BOPGSTB: "Trade Balance",
  DTWEXBGS: "Trade Weighted US Dollar Index",

  // US Interest Rates
  FEDFUNDS: "Federal Funds Rate",
  DGS10: "10-Year Treasury Yield",
  DGS2: "2-Year Treasury Yield",
  T10Y2Y: "10Y-2Y Treasury Spread",

  // US Consumer
  UMCSENT: "Consumer Sentiment (Michigan)",
  CSCICP03USM665S: "Consumer Confidence",

  // US Manufacturing
  MANEMP: "Manufacturing Employment",
  NAPM: "ISM Manufacturing PMI",
};

// --- Zod schemas for FRED API responses ---

const fredObservationSchema = z.object({
  date: z.string(),
  value: z.string(),
});

const fredObservationsResponseSchema = z.object({
  realtime_start: z.string(),
  realtime_end: z.string(),
  observation_start: z.string(),
  observation_end: z.string(),
  count: z.number(),
  offset: z.number(),
  limit: z.number(),
  observations: z.array(fredObservationSchema),
});

const fredSeriesInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  frequency: z.string(),
  frequency_short: z.string(),
  units: z.string(),
  units_short: z.string(),
  seasonal_adjustment: z.string(),
  seasonal_adjustment_short: z.string(),
  last_updated: z.string(),
  observation_start: z.string(),
  observation_end: z.string(),
});

const fredSeriesResponseSchema = z.object({
  seriess: z.array(fredSeriesInfoSchema),
});

// --- Public types ---

export type FredObservation = z.infer<typeof fredObservationSchema>;
export type FredSeriesInfo = z.infer<typeof fredSeriesInfoSchema>;

/**
 * Parsed FRED data point ready for database insertion.
 */
export interface FredDataPoint {
  seriesId: string;
  indicatorName: string;
  date: string;
  value: string | null;
  period: string;
  unit: string;
}

/**
 * Result of a FRED data fetch operation.
 */
export interface FredFetchResult {
  seriesId: string;
  seriesInfo: FredSeriesInfo | null;
  dataPoints: FredDataPoint[];
  error?: string;
}

// --- Internal helpers ---

/**
 * Fetch with retry logic for transient network failures.
 */
async function fetchWithRetry(
  url: string,
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry on server errors (5xx)
      if (response.status >= 500) {
        lastError = new Error(`FRED API returned ${response.status}`);
        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_BASE_DELAY_MS * Math.pow(2, attempt))
          );
          continue;
        }
        return response;
      }

      return response;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_BASE_DELAY_MS * Math.pow(2, attempt))
        );
      }
    }
  }

  throw lastError ?? new Error("FRED API fetch failed after retries");
}

/**
 * Convert FRED frequency to a human-readable period string.
 * Maps the observation date + frequency to a period like "Q1 2024" or "Jan 2024".
 */
function dateToPeriod(date: string, frequency: string): string {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-indexed

  switch (frequency) {
    case "Annual":
    case "A":
      return `${year}`;
    case "Quarterly":
    case "Q":
      return `Q${Math.floor(month / 3) + 1} ${year}`;
    case "Monthly":
    case "M":
      return `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${year}`;
    case "Weekly":
    case "W":
      return `Week of ${date}`;
    case "Daily":
    case "D":
      return date;
    default:
      return `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${year}`;
  }
}

// --- Public API ---

/**
 * Fetch series metadata from FRED.
 *
 * @param seriesId - FRED series ID (e.g., "CPIAUCSL")
 * @param apiKey - FRED API key
 * @returns Series metadata or null if not found
 */
export async function fetchSeriesInfo(
  seriesId: string,
  apiKey: string
): Promise<FredSeriesInfo | null> {
  const url = `${FRED_API_BASE}/series?series_id=${encodeURIComponent(seriesId)}&api_key=${encodeURIComponent(apiKey)}&file_type=json`;

  const response = await fetchWithRetry(url);
  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  const parsed = fredSeriesResponseSchema.safeParse(json);

  if (!parsed.success || parsed.data.seriess.length === 0) {
    return null;
  }

  return parsed.data.seriess[0];
}

/**
 * Fetch historical observations for a FRED series.
 *
 * @param seriesId - FRED series ID (e.g., "CPIAUCSL")
 * @param apiKey - FRED API key
 * @param options - Optional date range filters
 * @returns Array of observations
 */
export async function fetchObservations(
  seriesId: string,
  apiKey: string,
  options?: {
    observationStart?: string;
    observationEnd?: string;
    limit?: number;
    offset?: number;
  }
): Promise<FredObservation[]> {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
    sort_order: "desc",
  });

  if (options?.observationStart) {
    params.set("observation_start", options.observationStart);
  }
  if (options?.observationEnd) {
    params.set("observation_end", options.observationEnd);
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }
  if (options?.offset) {
    params.set("offset", String(options.offset));
  }

  const url = `${FRED_API_BASE}/series/observations?${params.toString()}`;
  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(
      `FRED API error for ${seriesId}: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();
  const parsed = fredObservationsResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      `Invalid FRED response for ${seriesId}: ${parsed.error.message}`
    );
  }

  return parsed.data.observations;
}

/**
 * Fetch and transform FRED data for a series, ready for database import.
 * Fetches both metadata and observations, transforms into FredDataPoints.
 *
 * @param seriesId - FRED series ID (e.g., "CPIAUCSL")
 * @param apiKey - FRED API key
 * @param options - Optional date range and limit
 * @returns FredFetchResult with data points ready for DB insert
 */
export async function fetchSeriesData(
  seriesId: string,
  apiKey: string,
  options?: {
    observationStart?: string;
    observationEnd?: string;
    limit?: number;
  }
): Promise<FredFetchResult> {
  try {
    // Fetch metadata and observations in parallel
    const [seriesInfo, observations] = await Promise.all([
      fetchSeriesInfo(seriesId, apiKey),
      fetchObservations(seriesId, apiKey, options),
    ]);

    const indicatorName =
      FRED_SERIES_MAP[seriesId] ?? seriesInfo?.title ?? seriesId;
    const frequency = seriesInfo?.frequency ?? "Monthly";
    const unit = seriesInfo?.units_short ?? "";

    const dataPoints: FredDataPoint[] = observations
      .filter((obs) => obs.value !== ".")
      .map((obs) => ({
        seriesId,
        indicatorName,
        date: obs.date,
        value: obs.value === "." ? null : obs.value,
        period: dateToPeriod(obs.date, frequency),
        unit,
      }));

    return {
      seriesId,
      seriesInfo,
      dataPoints,
    };
  } catch (error) {
    return {
      seriesId,
      seriesInfo: null,
      dataPoints: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch data for multiple FRED series in parallel.
 * Handles failures per-series so one bad series doesn't block others.
 *
 * @param seriesIds - Array of FRED series IDs
 * @param apiKey - FRED API key
 * @param options - Optional date range and limit (applied to all series)
 * @returns Array of FredFetchResult, one per series
 */
export async function fetchMultipleSeries(
  seriesIds: string[],
  apiKey: string,
  options?: {
    observationStart?: string;
    observationEnd?: string;
    limit?: number;
  }
): Promise<FredFetchResult[]> {
  // Process in batches of 5 to respect rate limits
  const batchSize = 5;
  const results: FredFetchResult[] = [];

  for (let i = 0; i < seriesIds.length; i += batchSize) {
    const batch = seriesIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((id) => fetchSeriesData(id, apiKey, options))
    );
    results.push(...batchResults);

    // Brief delay between batches to avoid rate limiting
    if (i + batchSize < seriesIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
