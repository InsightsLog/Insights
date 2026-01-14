/**
 * iCal/ICS file generation utilities for calendar integration.
 * Generates valid iCalendar format (RFC 5545) for economic calendar events.
 *
 * Task: T341 - Add calendar integrations
 */

/**
 * Release event data for iCal generation.
 */
export interface CalendarEventData {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  url?: string;
}

/**
 * iCal file metadata.
 */
export interface ICalMetadata {
  productId?: string;
  calendarName?: string;
}

/**
 * Escapes special characters in iCal text values.
 * Per RFC 5545, the following characters must be escaped:
 * - Backslash (\) -> \\
 * - Semicolon (;) -> \;
 * - Comma (,) -> \,
 * - Newline -> \n
 */
export function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Formats a Date object to iCal datetime format (UTC).
 * Format: YYYYMMDDTHHMMSSZ
 */
export function formatICalDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Formats a Date object to iCal date-only format.
 * Format: YYYYMMDD
 */
export function formatICalDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

/**
 * Generates a unique identifier for an iCal event.
 * Format: {id}@macro-calendar
 */
export function generateUID(id: string): string {
  return `${id}@macro-calendar`;
}

/**
 * Folds long lines according to RFC 5545 (max 75 octets per line).
 * Continuation lines start with a single space or tab.
 */
export function foldLine(line: string): string {
  const MAX_LINE_LENGTH = 75;
  if (line.length <= MAX_LINE_LENGTH) {
    return line;
  }

  const result: string[] = [];
  let remaining = line;

  // First line gets full 75 characters
  result.push(remaining.slice(0, MAX_LINE_LENGTH));
  remaining = remaining.slice(MAX_LINE_LENGTH);

  // Continuation lines start with space, so 74 characters of content
  while (remaining.length > 0) {
    result.push(" " + remaining.slice(0, MAX_LINE_LENGTH - 1));
    remaining = remaining.slice(MAX_LINE_LENGTH - 1);
  }

  return result.join("\r\n");
}

/**
 * Generates an iCal VEVENT component for a single event.
 */
export function generateVEvent(event: CalendarEventData): string {
  const lines: string[] = [];

  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${generateUID(event.id)}`);
  lines.push(`DTSTAMP:${formatICalDateTime(new Date())}`);
  lines.push(`DTSTART:${formatICalDateTime(event.startTime)}`);

  // End time defaults to 1 hour after start if not specified
  const endTime = event.endTime ?? new Date(event.startTime.getTime() + 60 * 60 * 1000);
  lines.push(`DTEND:${formatICalDateTime(endTime)}`);

  lines.push(`SUMMARY:${escapeICalText(event.title)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
  }

  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  lines.push("END:VEVENT");

  return lines.map(foldLine).join("\r\n");
}

/**
 * Generates a complete iCal/ICS file with multiple events.
 */
export function generateICalendar(
  events: CalendarEventData[],
  metadata?: ICalMetadata
): string {
  const lines: string[] = [];

  // Calendar header
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${metadata?.productId ?? "-//Macro Calendar//EN"}`);
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  if (metadata?.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeICalText(metadata.calendarName)}`);
  }

  // Add all events
  for (const event of events) {
    lines.push(generateVEvent(event));
  }

  // Calendar footer
  lines.push("END:VCALENDAR");

  // iCal files use CRLF line endings
  return lines.join("\r\n") + "\r\n";
}

/**
 * Generates a Google Calendar URL for adding a single event.
 * This creates a one-click link that opens Google Calendar with the event pre-filled.
 *
 * @param event - The event data to add to Google Calendar
 * @returns URL string for Google Calendar event creation
 */
export function generateGoogleCalendarUrl(event: CalendarEventData): string {
  const baseUrl = "https://calendar.google.com/calendar/render";

  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", event.title);

  // Google Calendar uses YYYYMMDDTHHMMSSZ format (same as iCal)
  const startDate = formatICalDateTime(event.startTime);
  const endTime = event.endTime ?? new Date(event.startTime.getTime() + 60 * 60 * 1000);
  const endDate = formatICalDateTime(endTime);
  params.set("dates", `${startDate}/${endDate}`);

  if (event.description) {
    params.set("details", event.description);
  }

  if (event.location) {
    params.set("location", event.location);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Converts a release with indicator data to a CalendarEventData object.
 */
export interface ReleaseWithIndicator {
  id: string;
  indicator_id?: string;
  release_at: string;
  period: string;
  forecast: string | null;
  previous: string | null;
  indicator_name: string;
  country_code: string;
  category: string;
}

/**
 * Converts release data to calendar event data.
 *
 * @param release - Release data with indicator information
 * @param baseUrl - Base URL for the indicator detail link (optional)
 * @returns CalendarEventData object for iCal/Google Calendar
 */
export function releaseToCalendarEvent(
  release: ReleaseWithIndicator,
  baseUrl?: string
): CalendarEventData {
  // Build description with release details
  const descriptionParts: string[] = [];
  descriptionParts.push(`Period: ${release.period}`);
  descriptionParts.push(`Country: ${release.country_code}`);
  descriptionParts.push(`Category: ${release.category}`);

  if (release.forecast) {
    descriptionParts.push(`Forecast: ${release.forecast}`);
  }
  if (release.previous) {
    descriptionParts.push(`Previous: ${release.previous}`);
  }

  // Use indicator_id for URL if available, otherwise fall back to release id
  const indicatorId = release.indicator_id ?? release.id;

  return {
    id: release.id,
    title: `${release.indicator_name} (${release.country_code})`,
    description: descriptionParts.join("\n"),
    startTime: new Date(release.release_at),
    // Economic releases are typically point-in-time, so 30 min duration
    endTime: new Date(new Date(release.release_at).getTime() + 30 * 60 * 1000),
    location: release.country_code,
    url: baseUrl ? `${baseUrl}/indicator/${indicatorId}` : undefined,
  };
}
