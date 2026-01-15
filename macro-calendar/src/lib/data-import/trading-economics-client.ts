/**
 * Trading Economics Calendar API Client
 *
 * Client for fetching upcoming economic events from the Trading Economics API.
 * Trading Economics provides comprehensive global economic calendar data.
 *
 * API Documentation: https://docs.tradingeconomics.com/economic_calendar/
 *
 * Free Tier: Registration required, limited daily calls
 */

import { getTradingEconomicsApiKey } from "@/lib/env";

const TE_API_BASE_URL = "https://api.tradingeconomics.com";

/**
 * Economic event from Trading Economics calendar API.
 */
export interface TECalendarEvent {
  CalendarId: number;
  Date: string; // ISO datetime format
  Country: string; // Full country name
  Category: string; // Event category
  Event: string; // Event name
  Reference: string; // Reference period (e.g., "Dec", "Q4")
  ReferenceDate: string | null;
  Source: string;
  SourceURL: string;
  Actual: string | null; // Actual value as string
  Previous: string | null; // Previous value as string
  Forecast: string | null; // Forecast value as string
  TEForecast: string | null; // Trading Economics forecast
  URL: string;
  DateSpan: number;
  Importance: number; // 1 (low) to 3 (high)
  LastUpdate: string;
  Revised: string | null;
  Currency: string;
  Unit: string;
  Ticker: string;
  Symbol: string;
}

/**
 * Trading Economics API error.
 */
export class TEApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "TEApiError";
  }
}

/**
 * Map Trading Economics country names to ISO codes.
 */
export const TE_COUNTRY_MAP: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "GB",
  "European Union": "EU",
  "Euro Area": "EU",
  Germany: "DE",
  France: "FR",
  Italy: "IT",
  Spain: "ES",
  Japan: "JP",
  China: "CN",
  Canada: "CA",
  Australia: "AU",
  Brazil: "BR",
  India: "IN",
  Russia: "RU",
  "South Korea": "KR",
  Mexico: "MX",
  Indonesia: "ID",
  Turkey: "TR",
  "Saudi Arabia": "SA",
  Argentina: "AR",
  "South Africa": "ZA",
  Switzerland: "CH",
  Netherlands: "NL",
  Belgium: "BE",
  Austria: "AT",
  Sweden: "SE",
  Norway: "NO",
  Poland: "PL",
  Singapore: "SG",
  "Hong Kong": "HK",
  "New Zealand": "NZ",
  Portugal: "PT",
  Greece: "GR",
  Ireland: "IE",
  Denmark: "DK",
  Finland: "FI",
  Israel: "IL",
  Thailand: "TH",
  Malaysia: "MY",
  Philippines: "PH",
  Vietnam: "VN",
  Colombia: "CO",
  Chile: "CL",
  Peru: "PE",
  Egypt: "EG",
  Nigeria: "NG",
  Kenya: "KE",
  Pakistan: "PK",
  Bangladesh: "BD",
  Taiwan: "TW",
  UAE: "AE",
  "United Arab Emirates": "AE",
  Qatar: "QA",
  Kuwait: "KW",
};

/**
 * G20+ countries for Trading Economics API queries.
 * Using URL-encoded country names.
 */
export const TE_G20_COUNTRIES = [
  "united%20states",
  "united%20kingdom",
  "germany",
  "france",
  "italy",
  "japan",
  "china",
  "canada",
  "australia",
  "brazil",
  "india",
  "russia",
  "south%20korea",
  "mexico",
  "indonesia",
  "turkey",
  "saudi%20arabia",
  "argentina",
  "south%20africa",
  "euro%20area",
  "spain",
  "netherlands",
  "switzerland",
  "sweden",
];

/**
 * Normalize country name to ISO code.
 */
export function normalizeCountryCode(country: string): string {
  return TE_COUNTRY_MAP[country] ?? country.substring(0, 2).toUpperCase();
}

/**
 * Convert importance (1-3) to impact level.
 */
function importanceToImpact(importance: number): "Low" | "Medium" | "High" {
  if (importance >= 3) return "High";
  if (importance >= 2) return "Medium";
  return "Low";
}

/**
 * Parse a value string to number or null.
 */
function parseValue(value: string | null): number | null {
  if (!value || value === "" || value === "-") return null;
  // Remove common suffixes and parse
  const cleaned = value.replace(/[KMB%]/gi, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Trading Economics Calendar API Client class.
 */
export class TECalendarClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? getTradingEconomicsApiKey();
    if (!key) {
      throw new TEApiError(
        "TRADING_ECONOMICS_API_KEY is required. Register at https://tradingeconomics.com/api"
      );
    }
    this.apiKey = key;
  }

  /**
   * Make a request to the Trading Economics API.
   */
  private async request<T>(endpoint: string): Promise<T> {
    const url = `${TE_API_BASE_URL}${endpoint}`;
    const separator = endpoint.includes("?") ? "&" : "?";
    const fullUrl = `${url}${separator}c=${this.apiKey}`;

    const response = await fetch(fullUrl);

    if (!response.ok) {
      const text = await response.text();
      throw new TEApiError(
        `Trading Economics API error: ${response.status} ${response.statusText} - ${text}`,
        response.status
      );
    }

    const data = await response.json();

    // Check for error response
    if (data && typeof data === "object" && "message" in data) {
      throw new TEApiError(data.message as string);
    }

    return data as T;
  }

  /**
   * Get upcoming economic calendar events for G20+ countries.
   *
   * @param countries - Array of country names (URL-encoded). Defaults to G20+.
   */
  async getUpcomingEvents(
    countries?: string[]
  ): Promise<TECalendarEvent[]> {
    const countryList = countries ?? TE_G20_COUNTRIES;
    
    // Trading Economics limits countries per request, so we batch
    const BATCH_SIZE = 5;
    const allEvents: TECalendarEvent[] = [];

    for (let i = 0; i < countryList.length; i += BATCH_SIZE) {
      const batch = countryList.slice(i, i + BATCH_SIZE);
      const countriesParam = batch.join(",");
      
      try {
        const events = await this.request<TECalendarEvent[]>(
          `/calendar/country/${countriesParam}`
        );
        if (Array.isArray(events)) {
          allEvents.push(...events);
        }
      } catch (error) {
        // Log but continue with other batches
        console.warn(`Failed to fetch events for ${countriesParam}:`, error);
      }

      // Small delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return allEvents;
  }

  /**
   * Get events normalized to common format for import.
   */
  async getNormalizedEvents(): Promise<
    Array<{
      country: string;
      event: string;
      date: string;
      time: string;
      actual: number | null;
      previous: number | null;
      estimate: number | null;
      unit: string;
      impact: "Low" | "Medium" | "High";
      source: "trading_economics";
    }>
  > {
    const events = await this.getUpcomingEvents();

    return events
      .filter((event) => {
        // Only include future events
        const eventDate = new Date(event.Date);
        return eventDate > new Date();
      })
      .map((event) => {
        const dateObj = new Date(event.Date);
        return {
          country: normalizeCountryCode(event.Country),
          event: event.Event,
          date: dateObj.toISOString().split("T")[0],
          time: dateObj.toTimeString().substring(0, 5),
          actual: parseValue(event.Actual),
          previous: parseValue(event.Previous),
          estimate: parseValue(event.Forecast),
          unit: event.Currency || "",
          impact: importanceToImpact(event.Importance),
          source: "trading_economics" as const,
        };
      });
  }
}
