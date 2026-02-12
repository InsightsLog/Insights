/**
 * BLS (Bureau of Labor Statistics) API Client
 *
 * Fetches employment and price data from the BLS Public Data API.
 * Uses v2 API (requires registration key for higher rate limits).
 *
 * API documentation: https://www.bls.gov/developers/
 *
 * Task: T405 - Add BLS API integration
 */

import { z } from "zod";

/**
 * BLS API v2 base URL.
 */
const BLS_API_BASE = "https://api.bls.gov/publicAPI/v2";

/**
 * Maximum number of series per request (BLS v2 limit is 50).
 */
const MAX_SERIES_PER_REQUEST = 50;

/**
 * Default number of retries on transient failures.
 */
const MAX_RETRIES = 3;

/**
 * Delay between retries in milliseconds (doubles each attempt).
 */
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Mapping of common BLS series IDs to indicator names.
 */
export const BLS_SERIES_MAP: Record<string, string> = {
  // Employment Situation
  CES0000000001: "Nonfarm Payrolls",
  CES0500000003: "Average Hourly Earnings",
  LNS14000000: "Unemployment Rate",

  // Jobless Claims (from ETA, accessed via BLS)
  LNS13000000: "Unemployment Level",

  // CPI (Consumer Price Index)
  CUSR0000SA0: "CPI All Items",
  CUSR0000SA0L1E: "Core CPI (ex Food & Energy)",
  CUSR0000SAF1: "CPI Food",
  CUSR0000SETA01: "CPI New Vehicles",
  CUSR0000SEHA: "CPI Shelter",

  // PPI (Producer Price Index)
  WPUFD49104: "PPI Final Demand",
  WPUFD4131: "PPI Core (ex Food & Energy)",

  // Employment Cost Index
  CIU1010000000000A: "Employment Cost Index",

  // Productivity
  PRS85006092: "Nonfarm Productivity",
  PRS85006112: "Unit Labor Costs",

  // Import/Export Prices
  EIUIR: "Import Price Index",
  EIUIQ: "Export Price Index",
};

// --- Zod schemas for BLS API responses ---

const blsSeriesDataSchema = z.object({
  year: z.string(),
  period: z.string(),
  periodName: z.string(),
  value: z.string(),
  footnotes: z.array(z.object({ text: z.string().optional() })).optional(),
});

const blsSeriesSchema = z.object({
  seriesID: z.string(),
  data: z.array(blsSeriesDataSchema),
});

const blsResponseSchema = z.object({
  status: z.string(),
  responseTime: z.number().optional(),
  message: z.array(z.string()).optional(),
  Results: z
    .object({
      series: z.array(blsSeriesSchema),
    })
    .optional(),
});

// --- Public types ---

export type BlsSeriesData = z.infer<typeof blsSeriesDataSchema>;

/**
 * Parsed BLS data point ready for database insertion.
 */
export interface BlsDataPoint {
  seriesId: string;
  indicatorName: string;
  date: string;
  value: string;
  period: string;
  year: string;
}

/**
 * Result of a BLS data fetch operation.
 */
export interface BlsFetchResult {
  seriesId: string;
  dataPoints: BlsDataPoint[];
  error?: string;
}

// --- Internal helpers ---

/**
 * Fetch with retry logic for transient network failures.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      if (response.status >= 500) {
        lastError = new Error(`BLS API returned ${response.status}`);
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

  throw lastError ?? new Error("BLS API fetch failed after retries");
}

/**
 * Convert BLS period code to an ISO date string.
 * BLS periods are like M01 (January), M02 (February), etc.
 * Annual periods are M13 or A01.
 */
function blsPeriodToDate(year: string, period: string): string {
  if (period.startsWith("M") && period !== "M13") {
    const month = parseInt(period.substring(1), 10);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  if (period.startsWith("Q")) {
    const quarter = parseInt(period.substring(1), 10);
    const month = (quarter - 1) * 3 + 1;
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  if (period.startsWith("S")) {
    const semi = parseInt(period.substring(1), 10);
    const month = semi === 1 ? 1 : 7;
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  // Annual (M13 or A01)
  return `${year}-01-01`;
}

/**
 * Convert BLS period to a human-readable period string.
 */
function blsPeriodToLabel(
  year: string,
  period: string,
  periodName: string
): string {
  if (period.startsWith("Q")) {
    return `${period} ${year}`;
  }
  if (period === "M13" || period.startsWith("A")) {
    return year;
  }
  // Monthly: use periodName (e.g., "January")
  return `${periodName.substring(0, 3)} ${year}`;
}

// --- Public API ---

/**
 * Fetch data for one or more BLS series.
 * Uses the BLS v2 API (POST request with JSON body).
 *
 * @param seriesIds - Array of BLS series IDs (max 50)
 * @param apiKey - BLS API registration key
 * @param options - Optional year range
 * @returns Raw BLS API response parsed and validated
 */
export async function fetchBlsSeries(
  seriesIds: string[],
  apiKey: string,
  options?: {
    startYear?: number;
    endYear?: number;
  }
): Promise<z.infer<typeof blsResponseSchema>> {
  if (seriesIds.length > MAX_SERIES_PER_REQUEST) {
    throw new Error(
      `Maximum ${MAX_SERIES_PER_REQUEST} series per request (got ${seriesIds.length})`
    );
  }

  const body: Record<string, unknown> = {
    seriesid: seriesIds,
    registrationkey: apiKey,
  };

  if (options?.startYear) {
    body.startyear = String(options.startYear);
  }
  if (options?.endYear) {
    body.endyear = String(options.endYear);
  }

  const response = await fetchWithRetry(`${BLS_API_BASE}/timeseries/data/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `BLS API error: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();
  const parsed = blsResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(`Invalid BLS response: ${parsed.error.message}`);
  }

  if (parsed.data.status !== "REQUEST_SUCCEEDED") {
    throw new Error(
      `BLS request failed: ${parsed.data.message?.join(", ") ?? "Unknown error"}`
    );
  }

  return parsed.data;
}

/**
 * Fetch and transform BLS data for multiple series, ready for database import.
 *
 * @param seriesIds - Array of BLS series IDs
 * @param apiKey - BLS API registration key
 * @param options - Optional year range
 * @returns Array of BlsFetchResult, one per series
 */
export async function fetchSeriesData(
  seriesIds: string[],
  apiKey: string,
  options?: {
    startYear?: number;
    endYear?: number;
  }
): Promise<BlsFetchResult[]> {
  const results: BlsFetchResult[] = [];

  // Process in batches respecting BLS limits
  for (let i = 0; i < seriesIds.length; i += MAX_SERIES_PER_REQUEST) {
    const batch = seriesIds.slice(i, i + MAX_SERIES_PER_REQUEST);

    try {
      const response = await fetchBlsSeries(batch, apiKey, options);

      if (!response.Results?.series) {
        for (const id of batch) {
          results.push({ seriesId: id, dataPoints: [], error: "No results" });
        }
        continue;
      }

      for (const series of response.Results.series) {
        const indicatorName =
          BLS_SERIES_MAP[series.seriesID] ?? series.seriesID;

        const dataPoints: BlsDataPoint[] = series.data.map((d) => ({
          seriesId: series.seriesID,
          indicatorName,
          date: blsPeriodToDate(d.year, d.period),
          value: d.value,
          period: blsPeriodToLabel(d.year, d.period, d.periodName),
          year: d.year,
        }));

        results.push({ seriesId: series.seriesID, dataPoints });
      }

      // Check if any requested series were missing from results
      const returnedIds = new Set(
        response.Results.series.map((s) => s.seriesID)
      );
      for (const id of batch) {
        if (!returnedIds.has(id)) {
          results.push({
            seriesId: id,
            dataPoints: [],
            error: "Series not found in BLS response",
          });
        }
      }
    } catch (error) {
      for (const id of batch) {
        results.push({
          seriesId: id,
          dataPoints: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Brief delay between batches
    if (i + MAX_SERIES_PER_REQUEST < seriesIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
