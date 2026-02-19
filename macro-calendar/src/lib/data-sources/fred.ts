import { z } from "zod";
import { getFredEnv } from "@/lib/env";

/**
 * FRED API base URL for series observations.
 */
const FRED_API_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";

/**
 * Map of FRED series IDs to internal indicator names.
 * This allows us to map FRED data to our internal indicators.
 */
export const FRED_SERIES_MAP: Record<string, string> = {
  CPIAUCSL: "CPI",
  CPILFESL: "Core CPI",
  UNRATE: "Unemployment Rate",
  PAYEMS: "Nonfarm Payrolls",
  GDP: "GDP",
  PCEPILFE: "Core PCE",
  FEDFUNDS: "Federal Funds Rate",
  DGS10: "10-Year Treasury Yield",
  DGS2: "2-Year Treasury Yield",
  DEXUSEU: "USD/EUR Exchange Rate",
};

/**
 * Schema for a single observation from the FRED API.
 */
const fredObservationSchema = z.object({
  realtime_start: z.string(),
  realtime_end: z.string(),
  date: z.string(),
  value: z.string(),
});

/**
 * Schema for the FRED API response.
 */
const fredResponseSchema = z.object({
  realtime_start: z.string(),
  realtime_end: z.string(),
  observation_start: z.string(),
  observation_end: z.string(),
  units: z.string(),
  output_type: z.number(),
  file_type: z.string(),
  order_by: z.string(),
  sort_order: z.string(),
  count: z.number(),
  offset: z.number(),
  limit: z.number(),
  observations: z.array(fredObservationSchema),
});

/**
 * Type for a FRED observation.
 */
export type FredObservation = z.infer<typeof fredObservationSchema>;

/**
 * Type for the FRED API response.
 */
export type FredResponse = z.infer<typeof fredResponseSchema>;

/**
 * Optional parameters for FRED API requests.
 */
export interface FredParams {
  /**
   * File type for the response (default: "json").
   */
  file_type?: "json" | "xml";
  /**
   * Sort order for observations (default: "desc").
   */
  sort_order?: "asc" | "desc";
  /**
   * Maximum number of observations to return (default: 1).
   */
  limit?: number;
  /**
   * Start date for observations (YYYY-MM-DD format).
   */
  observation_start?: string;
  /**
   * End date for observations (YYYY-MM-DD format).
   */
  observation_end?: string;
}

/**
 * Error class for FRED API errors.
 */
export class FredApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly seriesId?: string
  ) {
    super(message);
    this.name = "FredApiError";
  }
}

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a series from the FRED API with exponential backoff for rate limiting.
 *
 * @param seriesId - FRED series ID (e.g., "CPIAUCSL" for CPI)
 * @param params - Optional parameters for the API request
 * @returns Promise resolving to the validated FRED API response
 * @throws {FredApiError} If the API key is not configured, the request fails, or validation fails
 *
 * @example
 * ```typescript
 * const cpiData = await fetchFredSeries("CPIAUCSL", {
 *   limit: 1,
 *   sort_order: "desc"
 * });
 * console.log(cpiData.observations[0].value);
 * ```
 */
export async function fetchFredSeries(
  seriesId: string,
  params?: FredParams
): Promise<FredResponse> {
  // Get FRED API key from environment
  const fredEnv = getFredEnv();
  if (!fredEnv) {
    throw new FredApiError(
      "FRED_API_KEY is not configured in environment variables"
    );
  }

  // Build query parameters
  const queryParams = new URLSearchParams({
    series_id: seriesId,
    api_key: fredEnv.apiKey,
    file_type: params?.file_type ?? "json",
    sort_order: params?.sort_order ?? "desc",
    limit: String(params?.limit ?? 1),
  });

  // Add optional date parameters
  if (params?.observation_start) {
    queryParams.set("observation_start", params.observation_start);
  }
  if (params?.observation_end) {
    queryParams.set("observation_end", params.observation_end);
  }

  const url = `${FRED_API_BASE_URL}?${queryParams.toString()}`;

  // Retry with exponential backoff (max 3 retries)
  let attempt = 0;
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  while (attempt < maxRetries) {
    try {
      const response = await fetch(url);

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        attempt++;
        if (attempt >= maxRetries) {
          throw new FredApiError(
            `FRED API rate limit exceeded after ${maxRetries} retries`,
            429,
            seriesId
          );
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
        continue;
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new FredApiError(
          `FRED API request failed: ${response.statusText}. ${errorText}`,
          response.status,
          seriesId
        );
      }

      // Parse and validate response
      const data = await response.json();
      const validated = fredResponseSchema.parse(data);
      return validated;
    } catch (error) {
      // Re-throw FredApiError and validation errors
      if (error instanceof FredApiError || error instanceof z.ZodError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof Error) {
        throw new FredApiError(
          `Failed to fetch FRED series ${seriesId}: ${error.message}`,
          undefined,
          seriesId
        );
      }

      throw error;
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new FredApiError(
    `Unexpected error fetching FRED series ${seriesId}`,
    undefined,
    seriesId
  );
}
