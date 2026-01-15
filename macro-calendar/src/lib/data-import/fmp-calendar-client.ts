/**
 * Financial Modeling Prep (FMP) Economic Calendar API Client
 *
 * Client for fetching upcoming economic events from the FMP API.
 * FMP provides global economic calendar data covering G20+ countries.
 *
 * API Documentation: https://site.financialmodelingprep.com/developer/docs/stable/economics-calendar
 *
 * Free Tier Limits: 250 API calls per day
 */

import { getFMPApiKey } from "@/lib/env";

const FMP_API_BASE_URL = "https://financialmodelingprep.com/stable";

/**
 * Economic event from FMP calendar API.
 */
export interface FMPCalendarEvent {
  date: string; // ISO datetime format "YYYY-MM-DD HH:mm:ss"
  country: string; // ISO country code (e.g., "US", "JP", "DE")
  event: string; // Event name/description
  currency: string; // Related currency (e.g., "USD", "EUR")
  previous: number | null; // Previous reading
  estimate: number | null; // Consensus forecast
  actual: number | null; // Latest announced value (null if not released)
  change: number | null; // Difference from previous
  impact: "Low" | "Medium" | "High"; // Market impact level
  changePercentage: number | null; // Percentage change
}

/**
 * FMP API error.
 */
export class FMPApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "FMPApiError";
  }
}

/**
 * G20 countries plus additional major economies.
 * ISO 2-letter country codes.
 */
export const G20_PLUS_COUNTRIES = [
  // G20 Members
  "AR", // Argentina
  "AU", // Australia
  "BR", // Brazil
  "CA", // Canada
  "CN", // China
  "FR", // France
  "DE", // Germany
  "IN", // India
  "ID", // Indonesia
  "IT", // Italy
  "JP", // Japan
  "MX", // Mexico
  "RU", // Russia
  "SA", // Saudi Arabia
  "ZA", // South Africa
  "KR", // South Korea
  "TR", // Turkey
  "GB", // United Kingdom
  "US", // United States
  "EU", // European Union (special case)
  // Additional major economies
  "ES", // Spain
  "NL", // Netherlands
  "CH", // Switzerland
  "SE", // Sweden
  "NO", // Norway
  "PL", // Poland
  "BE", // Belgium
  "AT", // Austria
  "SG", // Singapore
  "HK", // Hong Kong
  "NZ", // New Zealand
] as const;

export type G20PlusCountry = (typeof G20_PLUS_COUNTRIES)[number];

/**
 * Map country codes to display names.
 */
export const COUNTRY_NAMES: Record<G20PlusCountry, string> = {
  AR: "Argentina",
  AU: "Australia",
  BR: "Brazil",
  CA: "Canada",
  CN: "China",
  FR: "France",
  DE: "Germany",
  IN: "India",
  ID: "Indonesia",
  IT: "Italy",
  JP: "Japan",
  MX: "Mexico",
  RU: "Russia",
  SA: "Saudi Arabia",
  ZA: "South Africa",
  KR: "South Korea",
  TR: "Turkey",
  GB: "United Kingdom",
  US: "United States",
  EU: "European Union",
  ES: "Spain",
  NL: "Netherlands",
  CH: "Switzerland",
  SE: "Sweden",
  NO: "Norway",
  PL: "Poland",
  BE: "Belgium",
  AT: "Austria",
  SG: "Singapore",
  HK: "Hong Kong",
  NZ: "New Zealand",
};

/**
 * Map event names to categories for better organization.
 */
export function categorizeEvent(eventName: string): string {
  const lowerEvent = eventName.toLowerCase();

  if (
    lowerEvent.includes("gdp") ||
    lowerEvent.includes("gross domestic")
  ) {
    return "GDP";
  }
  if (
    lowerEvent.includes("cpi") ||
    lowerEvent.includes("inflation") ||
    lowerEvent.includes("consumer price") ||
    lowerEvent.includes("ppi") ||
    lowerEvent.includes("producer price")
  ) {
    return "Inflation";
  }
  if (
    lowerEvent.includes("employment") ||
    lowerEvent.includes("unemployment") ||
    lowerEvent.includes("payroll") ||
    lowerEvent.includes("jobless") ||
    lowerEvent.includes("jobs")
  ) {
    return "Employment";
  }
  if (
    lowerEvent.includes("interest rate") ||
    lowerEvent.includes("rate decision") ||
    lowerEvent.includes("monetary policy") ||
    lowerEvent.includes("central bank") ||
    lowerEvent.includes("fed ") ||
    lowerEvent.includes("ecb ") ||
    lowerEvent.includes("boj ") ||
    lowerEvent.includes("boe ")
  ) {
    return "Interest Rates";
  }
  if (
    lowerEvent.includes("retail") ||
    lowerEvent.includes("consumer") ||
    lowerEvent.includes("sentiment") ||
    lowerEvent.includes("confidence")
  ) {
    return "Consumer";
  }
  if (
    lowerEvent.includes("housing") ||
    lowerEvent.includes("building") ||
    lowerEvent.includes("home") ||
    lowerEvent.includes("construction")
  ) {
    return "Housing";
  }
  if (
    lowerEvent.includes("manufacturing") ||
    lowerEvent.includes("industrial") ||
    lowerEvent.includes("pmi") ||
    lowerEvent.includes("factory")
  ) {
    return "Manufacturing";
  }
  if (
    lowerEvent.includes("trade") ||
    lowerEvent.includes("export") ||
    lowerEvent.includes("import") ||
    lowerEvent.includes("balance")
  ) {
    return "Trade";
  }
  if (
    lowerEvent.includes("bond") ||
    lowerEvent.includes("auction") ||
    lowerEvent.includes("treasury") ||
    lowerEvent.includes("bill")
  ) {
    return "Bonds";
  }

  return "Other";
}

/**
 * Format date as YYYY-MM-DD for API requests.
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * FMP Calendar API Client class.
 */
export class FMPCalendarClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? getFMPApiKey();
    if (!key) {
      throw new FMPApiError(
        "FMP_API_KEY is required. Get a free API key at https://financialmodelingprep.com/register"
      );
    }
    this.apiKey = key;
  }

  /**
   * Make a request to the FMP API.
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const url = new URL(`${FMP_API_BASE_URL}/${endpoint}`);
    url.searchParams.set("apikey", this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const text = await response.text();
      throw new FMPApiError(
        `FMP API error: ${response.status} ${response.statusText} - ${text}`,
        response.status
      );
    }

    const data = await response.json();
    
    // FMP returns error messages in JSON format sometimes
    if (data && typeof data === "object" && "Error Message" in data) {
      throw new FMPApiError(data["Error Message"] as string);
    }

    return data as T;
  }

  /**
   * Get upcoming economic calendar events.
   *
   * @param fromDate - Start date (defaults to today)
   * @param toDate - End date (defaults to 30 days from now)
   * @param countries - Optional array of country codes to filter (defaults to G20+)
   */
  async getUpcomingEvents(
    fromDate?: Date,
    toDate?: Date,
    countries?: string[]
  ): Promise<FMPCalendarEvent[]> {
    const from = fromDate ?? new Date();
    const to = toDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const events = await this.request<FMPCalendarEvent[]>("economic-calendar", {
      from: formatDate(from),
      to: formatDate(to),
    });

    // Filter by countries if specified
    const targetCountries = countries ?? (G20_PLUS_COUNTRIES as unknown as string[]);
    return events.filter((event) =>
      targetCountries.includes(event.country)
    );
  }

  /**
   * Get upcoming events filtered for specific impact levels.
   * Higher impact events are more market-moving.
   *
   * @param fromDate - Start date
   * @param toDate - End date
   * @param minImpact - Minimum impact level ("Low", "Medium", "High")
   */
  async getHighImpactEvents(
    fromDate?: Date,
    toDate?: Date,
    minImpact: "Low" | "Medium" | "High" = "Medium"
  ): Promise<FMPCalendarEvent[]> {
    const events = await this.getUpcomingEvents(fromDate, toDate);

    const impactOrder = { Low: 1, Medium: 2, High: 3 };
    const minLevel = impactOrder[minImpact];

    return events.filter((event) => impactOrder[event.impact] >= minLevel);
  }

  /**
   * Get events grouped by date for calendar display.
   */
  async getEventsGroupedByDate(
    fromDate?: Date,
    toDate?: Date
  ): Promise<Map<string, FMPCalendarEvent[]>> {
    const events = await this.getUpcomingEvents(fromDate, toDate);

    const grouped = new Map<string, FMPCalendarEvent[]>();
    for (const event of events) {
      const dateKey = event.date.split(" ")[0]; // Extract YYYY-MM-DD
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    }

    return grouped;
  }
}
