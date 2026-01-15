/**
 * World Bank API Client
 *
 * Client for fetching historical economic data from the World Bank Indicators API v2.
 * The World Bank provides free access to development indicators for 217 countries.
 *
 * API Documentation: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
 *
 * Rate Limits: No stated limit, fair use policy applies.
 * Format: JSON (no API key required)
 */

const WORLD_BANK_API_BASE_URL = "https://api.worldbank.org/v2";

/**
 * World Bank observation data point normalized for our use.
 */
export interface WorldBankObservation {
  date: string; // YYYY-MM-DD format (always January 1st for annual data)
  value: string; // Numeric value as string
  period: string; // Human-readable period (e.g., "2024")
  countryCode: string; // ISO2 country code
  countryName: string; // Full country name
}

/**
 * World Bank indicator metadata.
 */
export interface WorldBankIndicatorInfo {
  id: string; // Indicator code (e.g., "NY.GDP.MKTP.CD")
  name: string; // Full indicator name
  sourceNote?: string; // Description of the indicator
  sourceOrganization?: string; // Data source organization
}

/**
 * Raw API response structure for pagination metadata.
 */
interface WorldBankPaginationMeta {
  page: number;
  pages: number;
  per_page: string;
  total: number;
  sourceid?: string;
  lastupdated?: string;
}

/**
 * Raw API response structure for indicator data.
 */
interface WorldBankDataPoint {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code?: string;
  date: string;
  value: number | null;
  unit?: string;
  obs_status?: string;
  decimal?: number;
}

/**
 * Raw API response structure for indicator metadata.
 */
interface WorldBankIndicatorMeta {
  id: string;
  name: string;
  unit?: string;
  source?: { id: string; value: string };
  sourceNote?: string;
  sourceOrganization?: string;
  topics?: Array<{ id: string; value: string }>;
}

/**
 * World Bank API error.
 */
export class WorldBankApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public indicatorId?: string
  ) {
    super(message);
    this.name = "WorldBankApiError";
  }
}

/**
 * Delay execution for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert World Bank year to date string.
 * World Bank uses annual data with year format (e.g., "2024").
 */
function yearToDate(year: string): string {
  // Annual data: use January 1st
  return `${year}-01-01`;
}

/**
 * World Bank API Client class.
 */
export class WorldBankClient {
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 500; // 500ms between requests for fair use

  constructor() {
    // World Bank API doesn't require an API key
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
   * Make a request to the World Bank API.
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    await this.throttle();

    const url = new URL(`${WORLD_BANK_API_BASE_URL}/${endpoint}`);
    url.searchParams.set("format", "json");
    url.searchParams.set("per_page", "1000"); // Max per page to reduce API calls

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new WorldBankApiError(
        `World Bank API error: ${response.status} ${response.statusText} - ${text}`,
        response.status
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get indicator metadata.
   */
  async getIndicatorInfo(indicatorId: string): Promise<WorldBankIndicatorInfo> {
    const response = await this.request<
      [WorldBankPaginationMeta, WorldBankIndicatorMeta[]] | { message: Array<{ id: string; value: string }> }
    >(`indicator/${indicatorId}`);

    // Check for error response
    if ("message" in response) {
      throw new WorldBankApiError(
        `Indicator not found: ${indicatorId}`,
        404,
        indicatorId
      );
    }

    const [, data] = response;
    if (!data || data.length === 0) {
      throw new WorldBankApiError(
        `No data found for indicator: ${indicatorId}`,
        404,
        indicatorId
      );
    }

    const indicator = data[0];
    return {
      id: indicator.id,
      name: indicator.name,
      sourceNote: indicator.sourceNote,
      sourceOrganization: indicator.sourceOrganization,
    };
  }

  /**
   * Get historical observations for an indicator across multiple countries.
   *
   * @param indicatorId - World Bank indicator code (e.g., "NY.GDP.MKTP.CD")
   * @param countryCodes - Array of ISO2 country codes (e.g., ["US", "GB", "JP"])
   * @param startYear - Start year (e.g., "2014")
   * @param endYear - End year (optional, defaults to current year)
   */
  async getIndicatorObservations(
    indicatorId: string,
    countryCodes: string[],
    startYear?: string,
    endYear?: string
  ): Promise<WorldBankObservation[]> {
    const end = endYear ?? new Date().getFullYear().toString();
    const start = startYear ?? "2014";

    // Join country codes with semicolons for the API
    const countriesParam = countryCodes.join(";");

    const observations: WorldBankObservation[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await this.request<
        [WorldBankPaginationMeta, WorldBankDataPoint[] | null] | { message: Array<{ id: string; value: string }> }
      >(`country/${countriesParam}/indicator/${indicatorId}`, {
        date: `${start}:${end}`,
        page: page.toString(),
      });

      // Check for error response
      if ("message" in response) {
        // Some error messages are expected (e.g., no data for country)
        break;
      }

      const [meta, data] = response;
      totalPages = meta.pages;

      if (!data || data.length === 0) {
        break;
      }

      for (const point of data) {
        // Skip null values
        if (point.value === null || point.value === undefined) {
          continue;
        }

        observations.push({
          date: yearToDate(point.date),
          value: point.value.toString(),
          period: point.date, // Just the year for annual data
          countryCode: point.country.id,
          countryName: point.country.value,
        });
      }

      page++;
    } while (page <= totalPages);

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
  ): Promise<WorldBankObservation[]> {
    return this.getIndicatorObservations(
      indicatorId,
      [countryCode],
      startYear,
      endYear
    );
  }
}

/**
 * World Bank indicator configuration.
 * Maps indicator codes to our internal naming and categorization.
 *
 * Key indicators from the World Bank API:
 * - Economic: GDP, GNI, inflation
 * - Trade: exports, imports, current account
 * - Labor: unemployment, labor force participation
 * - Finance: interest rates, FDI
 *
 * Note: World Bank data is primarily annual, with some indicators
 * having quarterly data for select countries.
 */
export const WORLD_BANK_INDICATOR_CONFIG = {
  // GDP and Growth
  "NY.GDP.MKTP.CD": {
    name: "GDP (Current USD)",
    category: "GDP",
    frequency: "Annual",
  },
  "NY.GDP.MKTP.KD.ZG": {
    name: "GDP Growth Rate (%)",
    category: "GDP",
    frequency: "Annual",
  },
  "NY.GDP.PCAP.CD": {
    name: "GDP Per Capita (Current USD)",
    category: "GDP",
    frequency: "Annual",
  },

  // Inflation
  "FP.CPI.TOTL.ZG": {
    name: "Inflation Rate (CPI, %)",
    category: "Inflation",
    frequency: "Annual",
  },
  "FP.CPI.TOTL": {
    name: "Consumer Price Index",
    category: "Inflation",
    frequency: "Annual",
  },

  // Employment
  "SL.UEM.TOTL.ZS": {
    name: "Unemployment Rate (%)",
    category: "Employment",
    frequency: "Annual",
  },
  "SL.TLF.CACT.ZS": {
    name: "Labor Force Participation Rate (%)",
    category: "Employment",
    frequency: "Annual",
  },

  // Trade
  "NE.EXP.GNFS.ZS": {
    name: "Exports of Goods and Services (% of GDP)",
    category: "Trade",
    frequency: "Annual",
  },
  "NE.IMP.GNFS.ZS": {
    name: "Imports of Goods and Services (% of GDP)",
    category: "Trade",
    frequency: "Annual",
  },
  "BN.CAB.XOKA.CD": {
    name: "Current Account Balance (Current USD)",
    category: "Trade",
    frequency: "Annual",
  },

  // Finance and Investment
  "BX.KLT.DINV.CD.WD": {
    name: "Foreign Direct Investment (Net Inflows, USD)",
    category: "Finance",
    frequency: "Annual",
  },
  "FR.INR.RINR": {
    name: "Real Interest Rate (%)",
    category: "Interest Rates",
    frequency: "Annual",
  },

  // Government
  "GC.DOD.TOTL.GD.ZS": {
    name: "Central Government Debt (% of GDP)",
    category: "Government",
    frequency: "Annual",
  },
  "GC.REV.XGRT.GD.ZS": {
    name: "Government Revenue (% of GDP)",
    category: "Government",
    frequency: "Annual",
  },

  // Population and Demographics
  "SP.POP.TOTL": {
    name: "Total Population",
    category: "Demographics",
    frequency: "Annual",
  },
  "SP.POP.GROW": {
    name: "Population Growth Rate (%)",
    category: "Demographics",
    frequency: "Annual",
  },
} as const;

export type WorldBankIndicatorId = keyof typeof WORLD_BANK_INDICATOR_CONFIG;

/**
 * Countries to fetch data for.
 * Using ISO2 country codes for major economies.
 *
 * Top 20 economies by GDP plus additional important markets.
 */
export const WORLD_BANK_COUNTRIES = {
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
  HK: "Hong Kong SAR, China",
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

export type WorldBankCountryCode = keyof typeof WORLD_BANK_COUNTRIES;
