import { z } from "zod";
import { getDataSourceEnv } from "@/lib/env";

/**
 * BLS API V2 endpoint for time series data.
 * Documentation: https://www.bls.gov/developers/api_signature_v2.htm
 */
const BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

/**
 * Maximum number of series IDs per request (BLS limit).
 */
const MAX_SERIES_PER_REQUEST = 50;

/**
 * Maximum number of retries for failed requests (exponential backoff).
 */
const MAX_RETRIES = 3;

/**
 * Initial backoff delay in milliseconds.
 */
const INITIAL_BACKOFF_MS = 1000;

/**
 * BLS series ID to internal indicator name mapping.
 * Maps commonly used BLS series to their indicator names.
 */
export const BLS_SERIES_MAP: Record<string, string> = {
  CES0000000001: "Non-Farm Payrolls",
  LNS14000000: "Unemployment Rate",
  CUUR0000SA0: "Consumer Price Index",
  CUSR0000SA0: "CPI - All Items",
  CUUR0000SA0L1E: "CPI - All Items Less Food and Energy",
  PRS85006092: "Nonfarm Business Sector Labor Productivity",
  CES0500000003: "Average Hourly Earnings",
  LNS11300000: "Labor Force Participation Rate",
  JTS000000000000000JOL: "Job Openings",
};

/**
 * Zod schema for BLS API request parameters.
 */
export const blsParamsSchema = z.object({
  startyear: z.string().optional(),
  endyear: z.string().optional(),
  catalog: z.boolean().optional(),
  calculations: z.boolean().optional(),
  annualaverage: z.boolean().optional(),
  aspects: z.boolean().optional(),
  registrationkey: z.string().optional(),
});

export type BlsParams = z.infer<typeof blsParamsSchema>;

/**
 * Zod schema for a single BLS data point.
 */
const blsDataPointSchema = z.object({
  year: z.string(),
  period: z.string(),
  periodName: z.string(),
  value: z.string(),
  footnotes: z.array(z.object({
    code: z.string().optional(),
    text: z.string().optional(),
  })).optional(),
});

export type BlsDataPoint = z.infer<typeof blsDataPointSchema>;

/**
 * Zod schema for a single BLS series response.
 */
const blsSeriesSchema = z.object({
  seriesID: z.string(),
  data: z.array(blsDataPointSchema),
  catalog: z.object({
    series_title: z.string().optional(),
    series_id: z.string().optional(),
  }).optional(),
});

export type BlsSeries = z.infer<typeof blsSeriesSchema>;

/**
 * Zod schema for the BLS API response.
 */
const blsResponseSchema = z.object({
  status: z.string(),
  responseTime: z.number(),
  message: z.array(z.string()).optional(),
  Results: z.object({
    series: z.array(blsSeriesSchema),
  }).optional(),
});

export type BlsResponse = z.infer<typeof blsResponseSchema>;

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch time series data from the BLS API with exponential backoff retry logic.
 * 
 * @param seriesIds - Array of BLS series IDs (max 50 per request)
 * @param params - Optional query parameters (startyear, endyear, etc.)
 * @returns Parsed and validated BLS response data
 * @throws Error if request fails after max retries or validation fails
 * 
 * @example
 * ```ts
 * const data = await fetchBlsSeries(
 *   ['CES0000000001', 'LNS14000000'],
 *   { startyear: '2023', endyear: '2024' }
 * );
 * ```
 */
export async function fetchBlsSeries(
  seriesIds: string[],
  params?: BlsParams
): Promise<BlsResponse> {
  // Validate series count
  if (seriesIds.length === 0) {
    throw new Error("At least one series ID is required");
  }
  if (seriesIds.length > MAX_SERIES_PER_REQUEST) {
    throw new Error(`Maximum ${MAX_SERIES_PER_REQUEST} series IDs allowed per request`);
  }

  // Get API key from environment
  const env = getDataSourceEnv();
  const apiKey = env?.blsApiKey;

  // Build request body
  const requestBody: Record<string, unknown> = {
    seriesid: seriesIds,
    ...params,
  };

  // Add API key if available
  if (apiKey) {
    requestBody.registrationkey = apiKey;
  }

  // Retry with exponential backoff
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(BLS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`BLS API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate response with Zod
      const validated = blsResponseSchema.parse(data);

      // Check if BLS API returned an error status
      if (validated.status !== "REQUEST_SUCCEEDED") {
        const errorMessage = validated.message?.join(", ") || "Unknown error";
        throw new Error(`BLS API error: ${errorMessage}`);
      }

      return validated;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors
      if (error instanceof z.ZodError) {
        throw new Error(`BLS API response validation failed: ${error.message}`);
      }

      // Don't retry if we've exhausted attempts
      if (attempt === MAX_RETRIES) {
        break;
      }

      // Calculate exponential backoff delay
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoffMs);
    }
  }

  throw new Error(`BLS API request failed after ${MAX_RETRIES} retries: ${lastError?.message}`);
}
