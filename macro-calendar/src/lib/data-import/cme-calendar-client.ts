/**
 * CME Group Economic Releases Calendar Client
 *
 * Scrapes economic event data from CME Group's Economic Releases Calendar.
 * No API key required - this is a free, in-house solution.
 *
 * Source: https://www.cmegroup.com/education/events/economic-releases-calendar.html
 * 
 * The calendar is loaded via AJAX from:
 * https://www.cmegroup.com/content/cmegroup/en/education/events/economic-releases-calendar/jcr:content/full-par/cmelayoutfull/full-par/cmeeconomycalendar.ajax.{month-1}.{year}.html
 *
 * This replaces the paid FMP, Finnhub, and Trading Economics APIs.
 */

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

const CME_BASE_URL = "https://www.cmegroup.com";

/**
 * CME Calendar event structure.
 */
export interface CMECalendarEvent {
  country: string; // ISO country code
  event: string; // Event name
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (ET timezone)
  link: string; // Link to event details on CME
  hasReport: boolean; // Whether CME has a detailed report for this event
  impact: "Low" | "Medium" | "High"; // Estimated impact level
  category: string; // Event category
}

/**
 * Map CME country codes to ISO codes.
 * CME uses 2-letter codes that mostly match ISO but some need mapping.
 */
const CME_COUNTRY_TO_ISO: Record<string, string> = {
  US: "US",
  JP: "JP",
  DE: "DE",
  GB: "GB",
  UK: "GB",
  EU: "EU",
  FR: "FR",
  IT: "IT",
  ES: "ES",
  CA: "CA",
  AU: "AU",
  NZ: "NZ",
  CH: "CH",
  CN: "CN",
  IN: "IN",
  BR: "BR",
  MX: "MX",
  KR: "KR",
  RU: "RU",
  ZA: "ZA",
  AR: "AR",
  ID: "ID",
  SA: "SA",
  TR: "TR",
  SE: "SE",
  NO: "NO",
  PL: "PL",
  NL: "NL",
  BE: "BE",
  AT: "AT",
  SG: "SG",
  HK: "HK",
  TW: "TW",
};

/**
 * Categorize an event based on its name.
 */
function categorizeEvent(eventName: string): string {
  const lower = eventName.toLowerCase();

  if (lower.includes("gdp") || lower.includes("gross domestic")) return "GDP";
  if (
    lower.includes("cpi") ||
    lower.includes("inflation") ||
    lower.includes("consumer price") ||
    lower.includes("ppi") ||
    lower.includes("producer price")
  )
    return "Inflation";
  if (
    lower.includes("employment") ||
    lower.includes("unemployment") ||
    lower.includes("payroll") ||
    lower.includes("jobless") ||
    lower.includes("jobs") ||
    lower.includes("labor") ||
    lower.includes("nonfarm")
  )
    return "Employment";
  if (
    lower.includes("interest rate") ||
    lower.includes("rate decision") ||
    lower.includes("monetary") ||
    lower.includes("central bank") ||
    lower.includes("fed ") ||
    lower.includes("fomc") ||
    lower.includes("ecb ") ||
    lower.includes("boj ") ||
    lower.includes("boe ")
  )
    return "Interest Rates";
  if (
    lower.includes("retail") ||
    lower.includes("consumer") ||
    lower.includes("sentiment") ||
    lower.includes("confidence")
  )
    return "Consumer";
  if (
    lower.includes("housing") ||
    lower.includes("building") ||
    lower.includes("home") ||
    lower.includes("construction")
  )
    return "Housing";
  if (
    lower.includes("manufacturing") ||
    lower.includes("industrial") ||
    lower.includes("pmi") ||
    lower.includes("factory") ||
    lower.includes("ism")
  )
    return "Manufacturing";
  if (
    lower.includes("trade") ||
    lower.includes("export") ||
    lower.includes("import") ||
    lower.includes("balance")
  )
    return "Trade";
  if (
    lower.includes("bond") ||
    lower.includes("auction") ||
    lower.includes("treasury") ||
    lower.includes("bill")
  )
    return "Bonds";

  return "Other";
}

/**
 * Estimate impact level based on event name.
 * High-impact events are market-moving.
 */
function estimateImpact(eventName: string, hasReport: boolean): "Low" | "Medium" | "High" {
  const lower = eventName.toLowerCase();

  // High impact events
  const highImpact = [
    "nonfarm payroll",
    "non-farm payroll",
    "employment situation",
    "cpi",
    "consumer price",
    "gdp",
    "fomc",
    "federal reserve",
    "interest rate",
    "rate decision",
    "retail sales",
    "ism manufacturing",
    "ism services",
  ];

  for (const term of highImpact) {
    if (lower.includes(term)) return "High";
  }

  // Medium impact events
  const mediumImpact = [
    "ppi",
    "producer price",
    "industrial production",
    "housing starts",
    "building permits",
    "durable goods",
    "trade balance",
    "jobless claims",
    "pmi",
    "consumer confidence",
    "michigan sentiment",
  ];

  for (const term of mediumImpact) {
    if (lower.includes(term)) return "Medium";
  }

  // If event has a detailed report, it's likely more important
  if (hasReport) return "Medium";

  return "Low";
}

/**
 * Parse time string from CME format (e.g., "8:30 AM ET") to HH:mm.
 */
function parseTime(timeStr: string): string {
  if (!timeStr) return "00:00";

  // Clean the string
  const cleaned = timeStr.trim().toUpperCase();

  // Match pattern like "8:30 AM" or "10:00 PM"
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return "00:00";

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3];

  // Convert to 24-hour format
  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

/**
 * CME Group Economic Calendar Client class.
 * No API key required - uses web scraping.
 */
export class CMECalendarClient {
  private userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  /**
   * Fetch economic events for a specific month.
   * @param year - The year (e.g., 2024)
   * @param month - The month (1-12, not 0-11)
   */
  async getMonthlyEvents(year: number, month: number): Promise<CMECalendarEvent[]> {
    // CME uses 0-indexed months
    const cmeMonth = month - 1;

    const url = `${CME_BASE_URL}/content/cmegroup/en/education/events/economic-releases-calendar/jcr:content/full-par/cmelayoutfull/full-par/cmeeconomycalendar.ajax.${cmeMonth}.${year}.html`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });

      if (!response.ok) {
        throw new CMEApiError(
          `Failed to fetch CME calendar: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const html = await response.text();
      return this.parseCalendarHtml(html, year, month);
    } catch (error) {
      if (error instanceof CMEApiError) throw error;
      throw new CMEApiError(
        error instanceof Error ? error.message : "Failed to fetch CME calendar"
      );
    }
  }

  /**
   * Fetch events for the current month.
   */
  async getCurrentMonthEvents(): Promise<CMECalendarEvent[]> {
    const now = new Date();
    return this.getMonthlyEvents(now.getFullYear(), now.getMonth() + 1);
  }

  /**
   * Fetch events for the next N months (including current).
   */
  async getUpcomingEvents(months: number = 2): Promise<CMECalendarEvent[]> {
    const allEvents: CMECalendarEvent[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      try {
        const events = await this.getMonthlyEvents(
          targetDate.getFullYear(),
          targetDate.getMonth() + 1
        );
        allEvents.push(...events);

        // Small delay between requests to be respectful
        if (i < months - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.warn(
          `Failed to fetch events for ${targetDate.getFullYear()}-${targetDate.getMonth() + 1}:`,
          error
        );
      }
    }

    // Filter to only future events
    const today = new Date().toISOString().split("T")[0];
    return allEvents.filter((event) => event.date >= today);
  }

  /**
   * Parse the CME calendar HTML response.
   */
  private parseCalendarHtml(html: string, year: number, month: number): CMECalendarEvent[] {
    const events: CMECalendarEvent[] = [];
    const $ = cheerio.load(html);

    let currentDay = "01";

    // Find all div elements
    $("div").each((_, element) => {
      const $el = $(element);
      const classes = $el.attr("class") || "";
      const id = $el.attr("id") || "";

      // Date label - update current day
      if (classes.includes("DateLabel")) {
        const dayText = $el.text().trim();
        if (dayText) {
          currentDay = dayText.padStart(2, "0");
        }
      }

      // Event div
      if (id.includes("Event_")) {
        const event = this.parseEventDiv($, $el, year, month, currentDay);
        if (event) {
          events.push(event);
        }
      }
    });

    return events;
  }

  /**
   * Parse a single event div element.
   */
  private parseEventDiv(
    $: cheerio.CheerioAPI,
    $el: cheerio.Cheerio<AnyNode>,
    year: number,
    month: number,
    day: string
  ): CMECalendarEvent | null {
    try {
      // Get the event link
      const $link = $el.find("a[href]").first();
      if (!$link.length) return null;

      const href = $link.attr("href") || "";
      const linkText = $link.text().trim();

      // Parse country and event name from link text (format: "US: Event Name")
      const [countryPart, ...eventParts] = linkText.split(":");
      const countryCode = countryPart?.trim() || "US";
      const eventName = eventParts.join(":").trim() || linkText;

      // Get time
      const $time = $el.find(".Time, span.Time").first();
      const timeText = $time.text().trim();
      const time = parseTime(timeText);

      // Check for report
      const hasReport = $el.find("img").length > 0;

      // Build date string
      const dateStr = `${year}-${month.toString().padStart(2, "0")}-${day}`;

      // Map country code
      const isoCountry = CME_COUNTRY_TO_ISO[countryCode.toUpperCase()] || countryCode;

      return {
        country: isoCountry,
        event: eventName,
        date: dateStr,
        time,
        link: href.startsWith("http") ? href : `${CME_BASE_URL}${href}`,
        hasReport,
        impact: estimateImpact(eventName, hasReport),
        category: categorizeEvent(eventName),
      };
    } catch (error) {
      console.warn("Failed to parse event div:", error);
      return null;
    }
  }
}

/**
 * CME API error class.
 */
export class CMEApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "CMEApiError";
  }
}
