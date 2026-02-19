import { z } from "zod";

/**
 * ECB Statistical Data Warehouse SDMX REST API integration
 * Docs: https://data.ecb.europa.eu/help/api/data
 * No authentication required
 */

// Zod schemas for ECB API response validation

const EcbObservationSchema = z.object({
  id: z.string().optional(),
  value: z.union([z.number(), z.string()]),
  dimensions: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

const EcbSeriesSchema = z.object({
  name: z.string().optional(),
  dimensions: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  observations: z.union([
    z.array(EcbObservationSchema),
    z.record(z.string(), z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))])),
  ]),
});

const EcbDataSetSchema = z.object({
  series: z.record(z.string(), EcbSeriesSchema).optional(),
  dataSets: z
    .array(
      z.object({
        series: z.record(z.string(), EcbSeriesSchema).optional(),
      })
    )
    .optional(),
});

const EcbResponseSchema = z.object({
  data: z
    .object({
      dataSets: z.array(EcbDataSetSchema).optional(),
    })
    .optional(),
  dataSets: z.array(EcbDataSetSchema).optional(),
}).refine(
  (data) => data.data !== undefined || data.dataSets !== undefined,
  {
    message: "Response must contain either 'data' or 'dataSets' field",
  }
);

export type EcbObservation = z.infer<typeof EcbObservationSchema>;
export type EcbSeries = z.infer<typeof EcbSeriesSchema>;
export type EcbResponse = z.infer<typeof EcbResponseSchema>;

export interface EcbParams {
  startPeriod?: string; // Format: YYYY-MM-DD or YYYY-MM
  endPeriod?: string;
  updatedAfter?: string;
  firstNObservations?: number;
  lastNObservations?: number;
  detail?: "full" | "dataonly" | "serieskeysonly" | "nodata";
}

export interface EcbFetchOptions {
  maxRetries?: number;
  initialDelayMs?: number;
}

/**
 * Mapping of ECB dataflow+key combinations to internal indicator names.
 * Format: "DATAFLOW:KEY" -> "Indicator Name"
 *
 * Examples:
 * - ECB/ICP/M.U2.N.000000.4.ANR -> HICP (Harmonized Index of Consumer Prices)
 * - ECB/FM/B.U2.EUR.4F.KR.MRR_FR.LEV -> ECB Main Refinancing Rate
 */
export const ECB_SERIES_MAP: Record<string, string> = {
  // HICP - Harmonized Index of Consumer Prices (Eurozone inflation)
  "ICP:M.U2.N.000000.4.ANR": "Eurozone HICP - All Items Annual Rate",
  // ECB Interest Rates
  "FM:B.U2.EUR.4F.KR.MRR_FR.LEV": "ECB Main Refinancing Rate",
  "FM:B.U2.EUR.4F.KR.DFR.LEV": "ECB Deposit Facility Rate",
  "FM:B.U2.EUR.4F.KR.MLFR.LEV": "ECB Marginal Lending Facility Rate",
  // GDP
  "MNA:Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.V.N": "Eurozone GDP",
  // Unemployment
  "LFSI:M.I8.S.UNEHRT.TOTAL0.15_74.T": "Eurozone Unemployment Rate",
};

/**
 * Fetches economic data from the ECB Statistical Data Warehouse SDMX REST API
 *
 * @param dataFlowRef - The dataflow identifier (e.g., "ICP", "FM", "MNA")
 * @param key - The series key (e.g., "M.U2.N.000000.4.ANR")
 * @param params - Optional query parameters
 * @param options - Fetch options including retry configuration
 * @returns Parsed and validated ECB response data
 *
 * @example
 * // Fetch HICP inflation data
 * const data = await fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR", {
 *   startPeriod: "2023-01",
 *   endPeriod: "2024-01"
 * });
 */
export async function fetchEcbSeries(
  dataFlowRef: string,
  key: string,
  params?: EcbParams,
  options?: EcbFetchOptions
): Promise<EcbResponse> {
  const maxRetries = options?.maxRetries ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 1000;

  const baseUrl = "https://data-api.ecb.europa.eu/service/data";
  const url = new URL(`${baseUrl}/${dataFlowRef}/${key}`);

  // Add query parameters
  url.searchParams.set("format", "jsondata");
  if (params?.startPeriod) url.searchParams.set("startPeriod", params.startPeriod);
  if (params?.endPeriod) url.searchParams.set("endPeriod", params.endPeriod);
  if (params?.updatedAfter) url.searchParams.set("updatedAfter", params.updatedAfter);
  if (params?.firstNObservations !== undefined)
    url.searchParams.set("firstNObservations", String(params.firstNObservations));
  if (params?.lastNObservations !== undefined)
    url.searchParams.set("lastNObservations", String(params.lastNObservations));
  if (params?.detail) url.searchParams.set("detail", params.detail);

  let lastError: Error | null = null;

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
      });

      // Handle rate limiting (429 status)
      if (response.status === 429) {
        if (attempt < maxRetries) {
          const delayMs = initialDelayMs * Math.pow(2, attempt);
          await sleep(delayMs);
          continue;
        }
        throw new Error(
          `ECB API rate limit exceeded after ${maxRetries} retries`
        );
      }

      // Handle other HTTP errors
      if (!response.ok) {
        throw new Error(
          `ECB API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // Validate response with Zod
      const validatedData = EcbResponseSchema.parse(data);

      return validatedData;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's a validation error or non-rate-limit HTTP error, don't retry
      if (
        error instanceof z.ZodError ||
        (error instanceof Error && error.message.includes("ECB API error"))
      ) {
        throw error;
      }

      // For network errors, retry with exponential backoff
      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        await sleep(delayMs);
        continue;
      }
    }
  }

  // If we exhausted all retries, throw the last error
  throw lastError ?? new Error("Failed to fetch ECB data");
}

/**
 * Helper function to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
