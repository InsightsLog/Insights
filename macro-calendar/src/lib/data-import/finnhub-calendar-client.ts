/**
 * Finnhub Economic Calendar API Client
 *
 * Client for fetching upcoming economic events from the Finnhub API.
 * Finnhub provides global economic calendar data with free tier access.
 *
 * API Documentation: https://finnhub.io/docs/api/economic-calendar
 *
 * Free Tier Limits: 60 API calls per minute
 */

import { getFinnhubApiKey } from "@/lib/env";

const FINNHUB_API_BASE_URL = "https://finnhub.io/api/v1";

/**
 * Economic event from Finnhub calendar API.
 */
export interface FinnhubCalendarEvent {
  country: string; // Country name (e.g., "US", "United States")
  event: string; // Event name/description
  date: string; // Date in YYYY-MM-DD format
  time: string; // Time in HH:mm format
  actual: number | null; // Actual value
  previous: number | null; // Previous reading
  estimate: number | null; // Consensus forecast
  unit: string; // Unit of measurement (e.g., "%")
  impact: "low" | "medium" | "high"; // Market impact level
}

/**
 * Response from Finnhub economic calendar endpoint.
 */
interface FinnhubCalendarResponse {
  economicCalendar: FinnhubCalendarEvent[];
}

/**
 * Finnhub API error.
 */
export class FinnhubApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "FinnhubApiError";
  }
}

/**
 * Map Finnhub country names to ISO codes.
 * Finnhub uses full names or 2-letter codes inconsistently.
 */
export const FINNHUB_COUNTRY_MAP: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "GB",
  "European Union": "EU",
  "Euro Area": "EU",
  "Eurozone": "EU",
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
  Korea: "KR",
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
  // Direct codes
  US: "US",
  GB: "GB",
  EU: "EU",
  DE: "DE",
  FR: "FR",
  IT: "IT",
  ES: "ES",
  JP: "JP",
  CN: "CN",
  CA: "CA",
  AU: "AU",
  BR: "BR",
  IN: "IN",
  RU: "RU",
  KR: "KR",
  MX: "MX",
  ID: "ID",
  TR: "TR",
  SA: "SA",
  AR: "AR",
  ZA: "ZA",
  CH: "CH",
  NL: "NL",
  BE: "BE",
  AT: "AT",
  SE: "SE",
  NO: "NO",
  PL: "PL",
  SG: "SG",
  HK: "HK",
  NZ: "NZ",
};

/**
 * Normalize country to ISO code.
 */
export function normalizeCountryCode(country: string): string {
  return FINNHUB_COUNTRY_MAP[country] ?? country;
}

/**
 * Format date as YYYY-MM-DD for API requests.
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Normalize impact level to standard format.
 */
function normalizeImpact(impact: string): "Low" | "Medium" | "High" {
  const lower = impact.toLowerCase();
  if (lower === "high") return "High";
  if (lower === "medium") return "Medium";
  return "Low";
}

/**
 * Finnhub Calendar API Client class.
 */
export class FinnhubCalendarClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? getFinnhubApiKey();
    if (!key) {
      throw new FinnhubApiError(
        "FINNHUB_API_KEY is required. Get a free API key at https://finnhub.io/register"
      );
    }
    this.apiKey = key;
  }

  /**
   * Make a request to the Finnhub API.
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const url = new URL(`${FINNHUB_API_BASE_URL}/${endpoint}`);
    url.searchParams.set("token", this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const text = await response.text();
      throw new FinnhubApiError(
        `Finnhub API error: ${response.status} ${response.statusText} - ${text}`,
        response.status
      );
    }

    const data = await response.json();

    // Finnhub returns error messages in JSON format sometimes
    if (data && typeof data === "object" && "error" in data) {
      throw new FinnhubApiError(data.error as string);
    }

    return data as T;
  }

  /**
   * Get upcoming economic calendar events.
   *
   * @param fromDate - Start date (defaults to today)
   * @param toDate - End date (defaults to 30 days from now)
   */
  async getUpcomingEvents(
    fromDate?: Date,
    toDate?: Date
  ): Promise<FinnhubCalendarEvent[]> {
    const from = fromDate ?? new Date();
    const to = toDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const response = await this.request<FinnhubCalendarResponse>(
      "calendar/economic",
      {
        from: formatDate(from),
        to: formatDate(to),
      }
    );

    return response.economicCalendar ?? [];
  }

  /**
   * Get events normalized to common format for import.
   */
  async getNormalizedEvents(
    fromDate?: Date,
    toDate?: Date
  ): Promise<
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
      source: "finnhub";
    }>
  > {
    const events = await this.getUpcomingEvents(fromDate, toDate);

    return events.map((event) => ({
      country: normalizeCountryCode(event.country),
      event: event.event,
      date: event.date,
      time: event.time ?? "00:00",
      actual: event.actual,
      previous: event.previous,
      estimate: event.estimate,
      unit: event.unit ?? "",
      impact: normalizeImpact(event.impact ?? "low"),
      source: "finnhub" as const,
    }));
  }
}
