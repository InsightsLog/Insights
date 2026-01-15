/**
 * IMF API Client
 *
 * Client for fetching historical economic data from the International Monetary Fund (IMF)
 * Data API using the SDMX-JSON REST interface.
 *
 * API Documentation: https://datahelp.imf.org/knowledgebase/articles/667681
 *
 * Rate Limits: No stated limit, fair use policy applies.
 * Format: SDMX-JSON (no API key required)
 */

const IMF_API_BASE_URL = "https://dataservices.imf.org/REST/SDMX_JSON.svc";

/**
 * IMF observation data point normalized for our use.
 */
export interface IMFObservation {
  date: string; // YYYY-MM-DD format (always January 1st for annual data)
  value: string; // Numeric value as string
  period: string; // Human-readable period (e.g., "2024")
  countryCode: string; // ISO2 country code
  countryName: string; // Full country name
}

/**
 * IMF indicator metadata.
 */
export interface IMFIndicatorInfo {
  id: string; // Indicator code (e.g., "NGDP_RPCH")
  name: string; // Full indicator name
  description?: string; // Description of the indicator
}

/**
 * Raw API response structure for CompactData.
 */
interface IMFCompactDataResponse {
  CompactData?: {
    "@xmlns"?: string;
    "@xmlns:xsi"?: string;
    DataSet?: {
      "@xmlns"?: string;
      Series?:
        | IMFSeriesData
        | IMFSeriesData[];
    };
  };
}

interface IMFSeriesData {
  "@FREQ"?: string;
  "@INDICATOR"?: string;
  "@REF_AREA"?: string;
  "@UNIT"?: string;
  "@SCALE"?: string;
  Obs?: IMFObservationData | IMFObservationData[];
}

interface IMFObservationData {
  "@TIME_PERIOD": string;
  "@OBS_VALUE": string;
}

/**
 * IMF API error.
 */
export class IMFApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public indicatorId?: string
  ) {
    super(message);
    this.name = "IMFApiError";
  }
}

/**
 * Delay execution for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert IMF year to date string.
 * IMF WEO uses annual data with year format (e.g., "2024").
 */
function yearToDate(year: string): string {
  // Annual data: use January 1st
  return `${year}-01-01`;
}

/**
 * IMF API Client class.
 */
export class IMFClient {
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 1000; // 1 second between requests for fair use

  constructor() {
    // IMF API doesn't require an API key
  }

  /**
   * Rate limiting: ensure minimum interval between requests.
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval && this.requestCount > 0) {
      await delay(this.minRequestInterval - timeSinceLastRequest);
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Make a request to the IMF API.
   */
  private async request<T>(endpoint: string): Promise<T> {
    await this.throttle();

    const url = `${IMF_API_BASE_URL}/${endpoint}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new IMFApiError(
        `IMF API error: ${response.status} ${response.statusText} - ${text}`,
        response.status
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get historical observations for an indicator across multiple countries.
   *
   * @param indicatorId - IMF indicator code (e.g., "NGDP_RPCH")
   * @param countryCodes - Array of ISO2 country codes (e.g., ["US", "GB", "JP"])
   * @param startYear - Start year (e.g., "2014")
   * @param endYear - End year (optional, defaults to current year)
   */
  async getIndicatorObservations(
    indicatorId: string,
    countryCodes: string[],
    startYear?: string,
    endYear?: string
  ): Promise<IMFObservation[]> {
    const end = endYear ?? new Date().getFullYear().toString();
    const start = startYear ?? "2014";

    const observations: IMFObservation[] = [];

    // IMF API supports multiple countries in a single request using "+"
    // Format: CompactData/WEO/A.{countries}.{indicator}
    // But it's safer to request one at a time for rate limiting and error handling
    for (const countryCode of countryCodes) {
      try {
        // IMF uses different country codes - we map ISO2 to IMF codes
        const imfCountryCode = countryCode;

        // Build the endpoint: CompactData/WEO/A.{country}.{indicator}
        // A = Annual frequency
        const endpoint = `CompactData/WEO/A.${imfCountryCode}.${indicatorId}?startPeriod=${start}&endPeriod=${end}`;

        const response = await this.request<IMFCompactDataResponse>(endpoint);

        // Check if we have data
        if (!response.CompactData?.DataSet?.Series) {
          continue;
        }

        // Series can be a single object or an array
        const seriesData = response.CompactData.DataSet.Series;
        const seriesArray = Array.isArray(seriesData) ? seriesData : [seriesData];

        for (const series of seriesArray) {
          if (!series.Obs) continue;

          // Obs can be a single object or an array
          const obsArray = Array.isArray(series.Obs) ? series.Obs : [series.Obs];

          for (const obs of obsArray) {
            // Skip null/missing values
            if (!obs["@OBS_VALUE"] || obs["@OBS_VALUE"].trim() === "") {
              continue;
            }

            const year = obs["@TIME_PERIOD"];

            observations.push({
              date: yearToDate(year),
              value: obs["@OBS_VALUE"],
              period: year, // Just the year for annual data
              countryCode: countryCode,
              countryName: IMF_COUNTRIES[countryCode as IMFCountryCode] ?? countryCode,
            });
          }
        }
      } catch (error) {
        // Log error but continue with other countries
        console.error(`Error fetching IMF data for ${countryCode}/${indicatorId}:`, error);
      }
    }

    // Sort by date and country for consistent ordering
    observations.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.countryCode.localeCompare(b.countryCode);
    });

    return observations;
  }

  /**
   * Get observations for a single country (convenience method).
   */
  async getSingleCountryObservations(
    indicatorId: string,
    countryCode: string,
    startYear?: string,
    endYear?: string
  ): Promise<IMFObservation[]> {
    return this.getIndicatorObservations(
      indicatorId,
      [countryCode],
      startYear,
      endYear
    );
  }
}

/**
 * IMF indicator configuration.
 * Maps indicator codes to our internal naming and categorization.
 *
 * Key indicators from the IMF World Economic Outlook (WEO):
 * - Economic: GDP, growth rates
 * - Prices: Inflation, CPI
 * - Trade: Current account, trade balance
 * - Government: Debt, deficit
 * - Employment: Unemployment
 *
 * Note: IMF WEO data is primarily annual.
 * Documentation: https://datahelp.imf.org/knowledgebase/articles/667681
 */
export const IMF_INDICATOR_CONFIG = {
  // GDP and Growth
  NGDP_RPCH: {
    name: "Real GDP Growth Rate (%)",
    category: "GDP",
    frequency: "Annual",
  },
  NGDPD: {
    name: "GDP (Current Prices, USD Billions)",
    category: "GDP",
    frequency: "Annual",
  },
  NGDPDPC: {
    name: "GDP Per Capita (Current Prices, USD)",
    category: "GDP",
    frequency: "Annual",
  },
  PPPGDP: {
    name: "GDP (PPP, International Dollars Billions)",
    category: "GDP",
    frequency: "Annual",
  },

  // Inflation
  PCPIPCH: {
    name: "Inflation Rate (CPI, % Change)",
    category: "Inflation",
    frequency: "Annual",
  },
  PCPIEPCH: {
    name: "Inflation Rate (End of Period, %)",
    category: "Inflation",
    frequency: "Annual",
  },

  // Employment
  LUR: {
    name: "Unemployment Rate (%)",
    category: "Employment",
    frequency: "Annual",
  },
  LE: {
    name: "Employment (Millions)",
    category: "Employment",
    frequency: "Annual",
  },

  // Trade and Current Account
  BCA_NGDPD: {
    name: "Current Account Balance (% of GDP)",
    category: "Trade",
    frequency: "Annual",
  },
  BCA: {
    name: "Current Account Balance (USD Billions)",
    category: "Trade",
    frequency: "Annual",
  },

  // Government Finance
  GGXWDG_NGDP: {
    name: "Government Gross Debt (% of GDP)",
    category: "Government",
    frequency: "Annual",
  },
  GGXCNL_NGDP: {
    name: "Government Net Lending/Borrowing (% of GDP)",
    category: "Government",
    frequency: "Annual",
  },

  // Investment
  NID_NGDP: {
    name: "Total Investment (% of GDP)",
    category: "Investment",
    frequency: "Annual",
  },
  NGSD_NGDP: {
    name: "Gross National Savings (% of GDP)",
    category: "Investment",
    frequency: "Annual",
  },

  // Population
  LP: {
    name: "Population (Millions)",
    category: "Demographics",
    frequency: "Annual",
  },
} as const;

export type IMFIndicatorId = keyof typeof IMF_INDICATOR_CONFIG;

/**
 * Countries to fetch data for.
 * Using ISO2 country codes for major economies.
 *
 * Note: IMF uses specific country codes which may differ slightly.
 * These are the standard ISO2 codes that map to IMF codes.
 */
export const IMF_COUNTRIES = {
  // G7 Countries
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  JP: "Japan",
  FR: "France",
  IT: "Italy",
  CA: "Canada",

  // Other Major Economies
  CN: "China",
  IN: "India",
  BR: "Brazil",
  RU: "Russian Federation",
  AU: "Australia",
  KR: "Korea, Rep.",
  MX: "Mexico",
  ID: "Indonesia",
  NL: "Netherlands",
  SA: "Saudi Arabia",
  CH: "Switzerland",
  ES: "Spain",
  TR: "Turkey",

  // Eurozone (additional)
  AT: "Austria",
  BE: "Belgium",
  IE: "Ireland",
  PT: "Portugal",
  GR: "Greece",

  // Asia-Pacific (additional)
  SG: "Singapore",
  HK: "Hong Kong SAR",
  NZ: "New Zealand",
  TH: "Thailand",
  MY: "Malaysia",

  // Latin America (additional)
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",

  // Others
  ZA: "South Africa",
  AE: "United Arab Emirates",
  IL: "Israel",
  PL: "Poland",
  SE: "Sweden",
  NO: "Norway",
} as const;

export type IMFCountryCode = keyof typeof IMF_COUNTRIES;
