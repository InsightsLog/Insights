/**
 * BLS API Client
 *
 * Client for fetching historical economic data from the Bureau of Labor Statistics (BLS) API v2.
 * BLS provides free access to employment, prices, and other economic data.
 *
 * API Documentation: https://www.bls.gov/developers/api_signature_v2.htm
 *
 * Rate Limits:
 * - Without registration key: 25 queries/day, 10 years of data, up to 25 series per query
 * - With registration key: 500 queries/day, 20 years of data, up to 50 series per query
 */

import { getBLSApiKey } from "@/lib/env";

const BLS_API_BASE_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

/**
 * BLS API observation data point.
 * BLS uses year/period format (e.g., 2024/M01 for January 2024).
 */
export interface BLSObservation {
  year: string;
  period: string; // e.g., "M01" for January, "Q01" for Q1
  periodName: string; // e.g., "January", "1st Quarter"
  value: string; // Numeric value as string
  footnotes?: Array<{ code: string; text: string }>;
}

/**
 * Normalized observation with date field for easier processing.
 */
export interface NormalizedBLSObservation {
  date: string; // YYYY-MM-DD format
  value: string;
  period: string; // Human-readable period (e.g., "Jan 2024")
}

/**
 * BLS series metadata from catalog.
 */
export interface BLSSeriesInfo {
  seriesId: string;
  title: string;
  surveyName?: string;
  seasonalAdjustment?: string;
  periodicity?: string;
}

/**
 * Response from BLS API.
 */
interface BLSApiResponse {
  status: string;
  responseTime: number;
  message: string[];
  Results?: {
    series: Array<{
      seriesID: string;
      catalog?: {
        series_title?: string;
        survey_name?: string;
        seasonality?: string;
        periodicity_code?: string;
      };
      data: Array<{
        year: string;
        period: string;
        periodName: string;
        value: string;
        footnotes?: Array<{ code: string; text: string }>;
      }>;
    }>;
  };
}

/**
 * BLS API error.
 */
export class BLSApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public seriesId?: string
  ) {
    super(message);
    this.name = "BLSApiError";
  }
}

/**
 * Delay execution for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert BLS period to date string.
 * BLS uses period codes like M01-M12 for months, Q01-Q04 for quarters, A01 for annual.
 */
function periodToDate(year: string, period: string): string {
  // Monthly data: M01 = January, M02 = February, etc.
  if (period.startsWith("M")) {
    const month = period.slice(1).padStart(2, "0");
    return `${year}-${month}-01`;
  }

  // Quarterly data: Q01 = Q1, Q02 = Q2, etc.
  if (period.startsWith("Q")) {
    const quarter = parseInt(period.slice(1), 10);
    const month = ((quarter - 1) * 3 + 1).toString().padStart(2, "0");
    return `${year}-${month}-01`;
  }

  // Semi-annual: S01 = first half, S02 = second half
  if (period.startsWith("S")) {
    const half = parseInt(period.slice(1), 10);
    const month = half === 1 ? "01" : "07";
    return `${year}-${month}-01`;
  }

  // Annual: A01
  if (period.startsWith("A")) {
    return `${year}-01-01`;
  }

  // Default: treat as monthly or return year start
  return `${year}-01-01`;
}

/**
 * Format period for display.
 * Converts BLS period codes to human-readable format.
 */
function formatPeriodDisplay(year: string, period: string, periodName: string): string {
  // Use the periodName provided by BLS if available
  if (periodName && periodName !== "") {
    // Monthly data
    if (period.startsWith("M")) {
      // Abbreviate month name
      const shortMonth = periodName.slice(0, 3);
      return `${shortMonth} ${year}`;
    }
    // Quarterly data
    if (period.startsWith("Q")) {
      const quarterNum = parseInt(period.slice(1), 10);
      return `Q${quarterNum} ${year}`;
    }
    // Semi-annual
    if (period.startsWith("S")) {
      return `${periodName} ${year}`;
    }
    // Annual
    if (period.startsWith("A")) {
      return year;
    }
    return `${periodName} ${year}`;
  }

  // Fallback: construct from period code
  if (period.startsWith("M")) {
    const monthNum = parseInt(period.slice(1), 10);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[monthNum - 1]} ${year}`;
  }
  if (period.startsWith("Q")) {
    const quarterNum = parseInt(period.slice(1), 10);
    return `Q${quarterNum} ${year}`;
  }
  return year;
}

/**
 * BLS API Client class.
 */
export class BLSClient {
  private apiKey: string | null;
  private requestCount: number = 0;
  private windowStart: number = Date.now();
  private readonly maxRequestsPerDay: number; // 25 without key, 500 with key
  private readonly maxYearsPerRequest: number; // 10 without key, 20 with key
  private readonly maxSeriesPerRequest: number; // 25 without key, 50 with key

  constructor(apiKey?: string) {
    // Use provided key, environment key, or null (unauthenticated)
    this.apiKey = apiKey ?? getBLSApiKey();

    // Set limits based on whether we have an API key
    if (this.apiKey) {
      this.maxRequestsPerDay = 500;
      this.maxYearsPerRequest = 20;
      this.maxSeriesPerRequest = 50;
    } else {
      this.maxRequestsPerDay = 25;
      this.maxYearsPerRequest = 10;
      this.maxSeriesPerRequest = 25;
    }
  }

  /**
   * Rate limiting: wait between requests to avoid hitting daily limits.
   * BLS has generous limits but we add a small delay for safety.
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    // Reset window after 24 hours
    if (elapsed >= 86400000) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // If at limit, throw error (can't wait 24 hours)
    if (this.requestCount >= this.maxRequestsPerDay) {
      throw new BLSApiError(
        `Daily request limit reached (${this.maxRequestsPerDay}). Try again tomorrow or register for an API key.`
      );
    }

    // Add a small delay between requests (500ms)
    if (this.requestCount > 0) {
      await delay(500);
    }

    this.requestCount++;
  }

  /**
   * Make a POST request to the BLS API.
   * BLS API v2 uses POST for all data requests.
   */
  private async request(
    seriesIds: string[],
    startYear: string,
    endYear: string,
    includeCatalog: boolean = true
  ): Promise<BLSApiResponse> {
    await this.throttle();

    // Validate series count
    if (seriesIds.length > this.maxSeriesPerRequest) {
      throw new BLSApiError(
        `Too many series requested (${seriesIds.length}). Maximum is ${this.maxSeriesPerRequest} per request.`
      );
    }

    // Validate year range
    const yearSpan = parseInt(endYear, 10) - parseInt(startYear, 10) + 1;
    if (yearSpan > this.maxYearsPerRequest) {
      throw new BLSApiError(
        `Year range too large (${yearSpan} years). Maximum is ${this.maxYearsPerRequest} years per request.`
      );
    }

    // Build request payload
    const payload: Record<string, unknown> = {
      seriesid: seriesIds,
      startyear: startYear,
      endyear: endYear,
      catalog: includeCatalog,
      calculations: false,
      annualaverage: false,
    };

    // Add registration key if available
    if (this.apiKey) {
      payload.registrationkey = this.apiKey;
    }

    const response = await fetch(BLS_API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new BLSApiError(
        `BLS API error: ${response.status} ${response.statusText} - ${text}`,
        response.status
      );
    }

    const data = (await response.json()) as BLSApiResponse;

    // Check for API-level errors
    if (data.status === "REQUEST_FAILED") {
      throw new BLSApiError(`BLS API request failed: ${data.message.join("; ")}`);
    }

    return data;
  }

  /**
   * Get series metadata (catalog info).
   */
  async getSeriesInfo(seriesId: string): Promise<BLSSeriesInfo> {
    // Request a single year just to get catalog info
    const currentYear = new Date().getFullYear().toString();
    const response = await this.request([seriesId], currentYear, currentYear, true);

    if (!response.Results?.series || response.Results.series.length === 0) {
      throw new BLSApiError(`Series not found: ${seriesId}`, 404, seriesId);
    }

    const series = response.Results.series[0];
    return {
      seriesId: series.seriesID,
      title: series.catalog?.series_title ?? seriesId,
      surveyName: series.catalog?.survey_name,
      seasonalAdjustment: series.catalog?.seasonality,
      periodicity: series.catalog?.periodicity_code,
    };
  }

  /**
   * Get historical observations for one or more series.
   *
   * @param seriesIds - One or more BLS series IDs
   * @param startYear - Start year (YYYY format)
   * @param endYear - End year (YYYY format, defaults to current year)
   * @returns Map of series ID to normalized observations
   */
  async getSeriesObservations(
    seriesIds: string[],
    startYear: string,
    endYear?: string
  ): Promise<Map<string, NormalizedBLSObservation[]>> {
    const end = endYear ?? new Date().getFullYear().toString();
    const results = new Map<string, NormalizedBLSObservation[]>();

    // Initialize empty arrays for each series
    for (const id of seriesIds) {
      results.set(id, []);
    }

    // Calculate year chunks based on max years per request
    const startYearNum = parseInt(startYear, 10);
    const endYearNum = parseInt(end, 10);

    // Process in chunks of maxYearsPerRequest years
    for (let chunkStart = startYearNum; chunkStart <= endYearNum; chunkStart += this.maxYearsPerRequest) {
      const chunkEnd = Math.min(chunkStart + this.maxYearsPerRequest - 1, endYearNum);

      const response = await this.request(
        seriesIds,
        chunkStart.toString(),
        chunkEnd.toString(),
        false // Don't need catalog for observations
      );

      if (!response.Results?.series) {
        continue;
      }

      // Process each series in the response
      for (const series of response.Results.series) {
        const existingObs = results.get(series.seriesID) ?? [];
        const newObs: NormalizedBLSObservation[] = [];

        for (const obs of series.data) {
          // Skip missing values (usually empty string or "-")
          if (!obs.value || obs.value === "-" || obs.value.trim() === "") {
            continue;
          }

          newObs.push({
            date: periodToDate(obs.year, obs.period),
            value: obs.value,
            period: formatPeriodDisplay(obs.year, obs.period, obs.periodName),
          });
        }

        // BLS returns data in reverse chronological order, so we reverse to chronological
        newObs.reverse();
        results.set(series.seriesID, [...existingObs, ...newObs]);
      }
    }

    return results;
  }

  /**
   * Get observations for a single series (convenience method).
   */
  async getSingleSeriesObservations(
    seriesId: string,
    startYear: string,
    endYear?: string
  ): Promise<NormalizedBLSObservation[]> {
    const results = await this.getSeriesObservations([seriesId], startYear, endYear);
    return results.get(seriesId) ?? [];
  }
}

/**
 * Key BLS series for initial import.
 * Maps BLS series ID to display name and metadata.
 *
 * Series ID format varies by survey. Common prefixes:
 * - LN: Labor Force Statistics (unemployment, participation)
 * - CU: Consumer Price Index (CPI)
 * - WP: Producer Price Index (PPI)
 * - CE: Employment, Hours, and Earnings
 */
export const BLS_SERIES_CONFIG = {
  // Unemployment and Labor Force
  LNS14000000: {
    name: "Unemployment Rate",
    category: "Employment",
    countryCode: "US",
    frequency: "Monthly",
  },
  LNS11000000: {
    name: "Labor Force Participation Rate",
    category: "Employment",
    countryCode: "US",
    frequency: "Monthly",
  },
  LNS13000000: {
    name: "Employment Level",
    category: "Employment",
    countryCode: "US",
    frequency: "Monthly",
  },
  LNS14000006: {
    name: "Unemployment Rate - Black or African American",
    category: "Employment",
    countryCode: "US",
    frequency: "Monthly",
  },
  LNS14000009: {
    name: "Unemployment Rate - Hispanic or Latino",
    category: "Employment",
    countryCode: "US",
    frequency: "Monthly",
  },

  // Consumer Price Index (CPI)
  CUUR0000SA0: {
    name: "CPI All Items",
    category: "Inflation",
    countryCode: "US",
    frequency: "Monthly",
  },
  CUUR0000SA0L1E: {
    name: "CPI Core (Less Food and Energy)",
    category: "Inflation",
    countryCode: "US",
    frequency: "Monthly",
  },
  CUUR0000SAF1: {
    name: "CPI Food",
    category: "Inflation",
    countryCode: "US",
    frequency: "Monthly",
  },
  CUUR0000SETA01: {
    name: "CPI New Vehicles",
    category: "Inflation",
    countryCode: "US",
    frequency: "Monthly",
  },
  CUUR0000SAH1: {
    name: "CPI Shelter",
    category: "Inflation",
    countryCode: "US",
    frequency: "Monthly",
  },
  CUUR0000SETB01: {
    name: "CPI Gasoline",
    category: "Inflation",
    countryCode: "US",
    frequency: "Monthly",
  },

  // Producer Price Index (PPI)
  WPUFD4: {
    name: "PPI Final Demand",
    category: "Inflation",
    countryCode: "US",
    frequency: "Monthly",
  },
  WPSFD4131: {
    name: "PPI Final Demand Less Foods and Energy",
    category: "Inflation",
    countryCode: "US",
    frequency: "Monthly",
  },

  // Employment and Earnings
  CES0000000001: {
    name: "Total Nonfarm Employment",
    category: "Employment",
    countryCode: "US",
    frequency: "Monthly",
  },
  CES0500000003: {
    name: "Average Hourly Earnings (Private)",
    category: "Employment",
    countryCode: "US",
    frequency: "Monthly",
  },
  CES0500000002: {
    name: "Average Weekly Hours (Private)",
    category: "Employment",
    countryCode: "US",
    frequency: "Monthly",
  },
} as const;

export type BLSSeriesId = keyof typeof BLS_SERIES_CONFIG;
