/**
 * ECB (European Central Bank) Statistical Data Warehouse API Client
 *
 * Fetches European economic data from the ECB SDMX RESTful API.
 * Returns data in JSON format from the ECB data portal.
 *
 * API documentation: https://data.ecb.europa.eu/help/api/overview
 *
 * Task: T406 - Add ECB API integration
 */

import { z } from "zod";

/**
 * ECB SDMX API base URL.
 */
const ECB_API_BASE = "https://data-api.ecb.europa.eu/service/data";

/**
 * Default number of retries on transient failures.
 */
const MAX_RETRIES = 3;

/**
 * Delay between retries in milliseconds.
 */
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Mapping of ECB data flow/series keys to indicator names.
 * Format: "dataflow/series_key"
 */
export const ECB_SERIES_MAP: Record<string, string> = {
  // Key Interest Rates
  "FM/B.U2.EUR.4F.KR.MRR.LEV": "ECB Main Refinancing Rate",
  "FM/B.U2.EUR.4F.KR.DFR.LEV": "ECB Deposit Facility Rate",
  "FM/B.U2.EUR.4F.KR.MLFR.LEV": "ECB Marginal Lending Rate",

  // HICP (Harmonised Index of Consumer Prices)
  "ICP/M.U2.N.000000.4.ANR": "Euro Area HICP (YoY)",
  "ICP/M.U2.N.XEF000.4.ANR": "Euro Area Core HICP (YoY)",

  // GDP
  "MNA/Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY": "Euro Area GDP (QoQ)",

  // Unemployment
  "STS/M.I9.S.UNEH.RTT000.4.000": "Euro Area Unemployment Rate",

  // Money Supply
  "BSI/M.U2.Y.V.M30.X.1.U2.2300.Z01.E": "Euro Area M3 Money Supply",

  // Industrial Production
  "STS/M.I9.Y.PROD.NS0020.4.000": "Euro Area Industrial Production",

  // Trade Balance
  "BP6/M.N.I9.W1.S1.S1.T.B.CA._Z._Z._Z.EUR._T._X.N":
    "Euro Area Current Account",

  // Consumer Confidence
  "RTD/M.S0.N.FAC1.CCI0.CON_SUR.IDX": "Euro Area Consumer Confidence",

  // PMI proxies (ECB publishes their own surveys)
  "RTD/M.S0.N.FAC1.PMI_MF.BUS_SUR.IDX": "Euro Area Manufacturing PMI",
};

// --- Zod schemas for ECB SDMX JSON response ---

const ecbObservationSchema = z.record(z.string(), z.array(z.unknown()));

const ecbSeriesSchema = z.object({
  attributes: z.array(z.unknown()).optional(),
  observations: ecbObservationSchema,
});

const ecbDataSetSchema = z.object({
  series: z.record(z.string(), ecbSeriesSchema),
});

const ecbDimensionValueSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const ecbDimensionSchema = z.object({
  id: z.string(),
  name: z.string(),
  values: z.array(ecbDimensionValueSchema),
});

const ecbStructureSchema = z.object({
  dimensions: z.object({
    observation: z.array(ecbDimensionSchema),
  }),
});

const ecbResponseSchema = z.object({
  dataSets: z.array(ecbDataSetSchema),
  structure: ecbStructureSchema,
});

// --- Public types ---

/**
 * Parsed ECB data point ready for database insertion.
 */
export interface EcbDataPoint {
  seriesKey: string;
  indicatorName: string;
  date: string;
  value: string | null;
  period: string;
}

/**
 * Result of an ECB data fetch operation.
 */
export interface EcbFetchResult {
  seriesKey: string;
  dataPoints: EcbDataPoint[];
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
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.sdmx.data+json;version=1.0.0-wd",
        },
      });

      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      if (response.status >= 500) {
        lastError = new Error(`ECB API returned ${response.status}`);
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

  throw lastError ?? new Error("ECB API fetch failed after retries");
}

/**
 * Convert a time period from ECB format to ISO date and human-readable period.
 * ECB uses formats like: 2024-01 (monthly), 2024-Q1 (quarterly), 2024 (annual)
 */
function parseTimePeriod(period: string): { date: string; label: string } {
  // Quarterly: 2024-Q1
  const quarterMatch = period.match(/^(\d{4})-Q(\d)$/);
  if (quarterMatch) {
    const year = quarterMatch[1];
    const quarter = parseInt(quarterMatch[2], 10);
    const month = (quarter - 1) * 3 + 1;
    return {
      date: `${year}-${String(month).padStart(2, "0")}-01`,
      label: `Q${quarter} ${year}`,
    };
  }

  // Monthly: 2024-01
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = monthMatch[1];
    const monthNum = parseInt(monthMatch[2], 10);
    const d = new Date(Date.UTC(parseInt(year, 10), monthNum - 1, 1));
    return {
      date: `${year}-${monthMatch[2]}-01`,
      label: `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${year}`,
    };
  }

  // Annual: 2024
  const yearMatch = period.match(/^(\d{4})$/);
  if (yearMatch) {
    return {
      date: `${yearMatch[1]}-01-01`,
      label: yearMatch[1],
    };
  }

  // Daily or unknown: return as-is
  return { date: period, label: period };
}

// --- Public API ---

/**
 * Fetch data for an ECB series using the SDMX API.
 *
 * @param dataflow - ECB dataflow ID (e.g., "ICP")
 * @param seriesKey - Series key within the dataflow (e.g., "M.U2.N.000000.4.ANR")
 * @param options - Optional date range filters
 * @returns Array of ECB data points
 */
export async function fetchEcbSeries(
  dataflow: string,
  seriesKey: string,
  options?: {
    startPeriod?: string;
    endPeriod?: string;
    lastNObservations?: number;
  }
): Promise<EcbDataPoint[]> {
  const fullKey = `${dataflow}/${seriesKey}`;
  const indicatorName = ECB_SERIES_MAP[fullKey] ?? fullKey;

  const params = new URLSearchParams();
  if (options?.startPeriod) {
    params.set("startPeriod", options.startPeriod);
  }
  if (options?.endPeriod) {
    params.set("endPeriod", options.endPeriod);
  }
  if (options?.lastNObservations) {
    params.set("lastNObservations", String(options.lastNObservations));
  }

  const queryString = params.toString();
  const url = `${ECB_API_BASE}/${dataflow}/${seriesKey}${queryString ? `?${queryString}` : ""}`;

  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(
      `ECB API error for ${fullKey}: ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();
  const parsed = ecbResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(`Invalid ECB response for ${fullKey}: ${parsed.error.message}`);
  }

  // Extract time dimension values
  const timeDim = parsed.data.structure.dimensions.observation.find(
    (d) => d.id === "TIME_PERIOD"
  );

  if (!timeDim) {
    throw new Error(`No TIME_PERIOD dimension in ECB response for ${fullKey}`);
  }

  // Extract observations from the first dataset and first series
  const dataSet = parsed.data.dataSets[0];
  if (!dataSet) return [];

  const seriesEntries = Object.entries(dataSet.series);
  if (seriesEntries.length === 0) return [];

  const dataPoints: EcbDataPoint[] = [];

  for (const [, series] of seriesEntries) {
    for (const [obsIndex, obsValues] of Object.entries(series.observations)) {
      const timeIdx = parseInt(obsIndex, 10);
      const timePeriodValue = timeDim.values[timeIdx];

      if (!timePeriodValue) continue;

      const value = obsValues[0];
      const { date, label } = parseTimePeriod(timePeriodValue.id);

      dataPoints.push({
        seriesKey: fullKey,
        indicatorName,
        date,
        value: value !== null && value !== undefined ? String(value) : null,
        period: label,
      });
    }
  }

  // Sort by date ascending
  dataPoints.sort((a, b) => a.date.localeCompare(b.date));

  return dataPoints;
}

/**
 * Fetch data for a series using the combined "dataflow/seriesKey" format.
 *
 * @param fullSeriesKey - Combined key like "ICP/M.U2.N.000000.4.ANR"
 * @param options - Optional date range filters
 * @returns EcbFetchResult with data points
 */
export async function fetchSeriesData(
  fullSeriesKey: string,
  options?: {
    startPeriod?: string;
    endPeriod?: string;
    lastNObservations?: number;
  }
): Promise<EcbFetchResult> {
  const slashIndex = fullSeriesKey.indexOf("/");
  if (slashIndex === -1) {
    return {
      seriesKey: fullSeriesKey,
      dataPoints: [],
      error: "Invalid series key format - expected 'dataflow/seriesKey'",
    };
  }

  const dataflow = fullSeriesKey.substring(0, slashIndex);
  const seriesKey = fullSeriesKey.substring(slashIndex + 1);

  try {
    const dataPoints = await fetchEcbSeries(dataflow, seriesKey, options);
    return { seriesKey: fullSeriesKey, dataPoints };
  } catch (error) {
    return {
      seriesKey: fullSeriesKey,
      dataPoints: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch data for multiple ECB series.
 *
 * @param seriesKeys - Array of combined "dataflow/seriesKey" strings
 * @param options - Optional date range filters
 * @returns Array of EcbFetchResult, one per series
 */
export async function fetchMultipleSeries(
  seriesKeys: string[],
  options?: {
    startPeriod?: string;
    endPeriod?: string;
    lastNObservations?: number;
  }
): Promise<EcbFetchResult[]> {
  // Process sequentially to avoid overwhelming the ECB API
  const results: EcbFetchResult[] = [];

  for (const key of seriesKeys) {
    const result = await fetchSeriesData(key, options);
    results.push(result);

    // Brief delay between requests
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return results;
}
