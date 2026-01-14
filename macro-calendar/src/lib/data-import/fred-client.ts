/**
 * FRED API Client
 *
 * Client for fetching historical economic data from the Federal Reserve Economic Data (FRED) API.
 * FRED provides free access to over 800,000 time series of economic data.
 *
 * API Documentation: https://fred.stlouisfed.org/docs/api/fred/
 *
 * Rate Limits: 120 requests per minute (very generous)
 */

import { getFredApiKey } from "@/lib/env";

const FRED_API_BASE_URL = "https://api.stlouisfed.org/fred";

/**
 * FRED API observation data point.
 */
export interface FredObservation {
  date: string; // YYYY-MM-DD format
  value: string; // Numeric value as string, or "." for missing data
}

/**
 * FRED series metadata.
 */
export interface FredSeriesInfo {
  id: string;
  title: string;
  frequency: string; // e.g., "Monthly", "Quarterly", "Daily"
  units: string; // e.g., "Percent", "Billions of Dollars"
  notes?: string;
}

/**
 * Response from FRED series/observations endpoint.
 */
interface FredObservationsResponse {
  observations: Array<{
    date: string;
    value: string;
  }>;
}

/**
 * Response from FRED series endpoint.
 */
interface FredSeriesResponse {
  seriess: Array<{
    id: string;
    title: string;
    frequency: string;
    units: string;
    notes?: string;
  }>;
}

/**
 * FRED API error.
 */
export class FredApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public seriesId?: string
  ) {
    super(message);
    this.name = "FredApiError";
  }
}

/**
 * Delay execution for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * FRED API Client class.
 */
export class FredClient {
  private apiKey: string;
  private requestCount: number = 0;
  private windowStart: number = Date.now();
  private readonly maxRequestsPerMinute: number = 120;

  constructor(apiKey?: string) {
    const key = apiKey ?? getFredApiKey();
    if (!key) {
      throw new FredApiError(
        "FRED_API_KEY is required. Get a free API key at https://fred.stlouisfed.org/docs/api/api_key.html"
      );
    }
    this.apiKey = key;
  }

  /**
   * Rate limiting: wait if we've exceeded 120 requests per minute.
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    // Reset window after 60 seconds
    if (elapsed >= 60000) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // If at limit, wait for window to reset
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const waitTime = 60000 - elapsed + 100; // Add 100ms buffer
      await delay(waitTime);
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    this.requestCount++;
  }

  /**
   * Make a request to the FRED API.
   */
  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    await this.throttle();

    const url = new URL(`${FRED_API_BASE_URL}/${endpoint}`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("file_type", "json");

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const text = await response.text();
      throw new FredApiError(
        `FRED API error: ${response.status} ${response.statusText} - ${text}`,
        response.status
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get series metadata.
   */
  async getSeriesInfo(seriesId: string): Promise<FredSeriesInfo> {
    const response = await this.request<FredSeriesResponse>("series", {
      series_id: seriesId,
    });

    if (!response.seriess || response.seriess.length === 0) {
      throw new FredApiError(`Series not found: ${seriesId}`, 404, seriesId);
    }

    const series = response.seriess[0];
    return {
      id: series.id,
      title: series.title,
      frequency: series.frequency,
      units: series.units,
      notes: series.notes,
    };
  }

  /**
   * Get historical observations for a series.
   *
   * @param seriesId - FRED series ID (e.g., "GDP", "UNRATE")
   * @param startDate - Start date in YYYY-MM-DD format (optional, defaults to series start)
   * @param endDate - End date in YYYY-MM-DD format (optional, defaults to today)
   */
  async getSeriesObservations(
    seriesId: string,
    startDate?: string,
    endDate?: string
  ): Promise<FredObservation[]> {
    const params: Record<string, string> = {
      series_id: seriesId,
    };

    if (startDate) {
      params.observation_start = startDate;
    }
    if (endDate) {
      params.observation_end = endDate;
    }

    const response = await this.request<FredObservationsResponse>(
      "series/observations",
      params
    );

    // Filter out missing values (indicated by ".")
    return response.observations
      .filter((obs) => obs.value !== ".")
      .map((obs) => ({
        date: obs.date,
        value: obs.value,
      }));
  }
}

/**
 * Key FRED series for initial import.
 * Maps FRED series ID to display name and metadata.
 */
export const FRED_SERIES_CONFIG = {
  // GDP and Growth
  GDPC1: {
    name: "Real GDP",
    category: "GDP",
    countryCode: "US",
  },
  A191RL1Q225SBEA: {
    name: "Real GDP Growth Rate",
    category: "GDP",
    countryCode: "US",
  },

  // Inflation and Prices
  CPIAUCSL: {
    name: "Consumer Price Index (CPI)",
    category: "Inflation",
    countryCode: "US",
  },
  PPIACO: {
    name: "Producer Price Index (PPI)",
    category: "Inflation",
    countryCode: "US",
  },
  CPILFESL: {
    name: "Core CPI (Less Food and Energy)",
    category: "Inflation",
    countryCode: "US",
  },

  // Employment
  UNRATE: {
    name: "Unemployment Rate",
    category: "Employment",
    countryCode: "US",
  },
  PAYEMS: {
    name: "Non-Farm Payrolls",
    category: "Employment",
    countryCode: "US",
  },
  ICSA: {
    name: "Initial Jobless Claims",
    category: "Employment",
    countryCode: "US",
  },

  // Interest Rates
  FEDFUNDS: {
    name: "Federal Funds Rate",
    category: "Interest Rates",
    countryCode: "US",
  },
  DGS10: {
    name: "10-Year Treasury Rate",
    category: "Interest Rates",
    countryCode: "US",
  },
  DGS2: {
    name: "2-Year Treasury Rate",
    category: "Interest Rates",
    countryCode: "US",
  },

  // Consumer
  UMCSENT: {
    name: "Consumer Sentiment Index",
    category: "Consumer",
    countryCode: "US",
  },
  RSXFS: {
    name: "Retail Sales",
    category: "Consumer",
    countryCode: "US",
  },

  // Housing
  HOUST: {
    name: "Housing Starts",
    category: "Housing",
    countryCode: "US",
  },
  PERMIT: {
    name: "Building Permits",
    category: "Housing",
    countryCode: "US",
  },

  // Manufacturing and Production
  INDPRO: {
    name: "Industrial Production Index",
    category: "Manufacturing",
    countryCode: "US",
  },
} as const;

export type FredSeriesId = keyof typeof FRED_SERIES_CONFIG;
