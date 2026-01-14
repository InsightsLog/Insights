import { describe, it, expect } from "vitest";
import {
  escapeICalText,
  formatICalDateTime,
  formatICalDate,
  generateUID,
  foldLine,
  generateVEvent,
  generateICalendar,
  generateGoogleCalendarUrl,
  releaseToCalendarEvent,
  type CalendarEventData,
  type ReleaseWithIndicator,
} from "./ical";

describe("escapeICalText", () => {
  it("escapes backslashes", () => {
    expect(escapeICalText("test\\value")).toBe("test\\\\value");
  });

  it("escapes semicolons", () => {
    expect(escapeICalText("test;value")).toBe("test\\;value");
  });

  it("escapes commas", () => {
    expect(escapeICalText("test,value")).toBe("test\\,value");
  });

  it("escapes newlines", () => {
    expect(escapeICalText("line1\nline2")).toBe("line1\\nline2");
    expect(escapeICalText("line1\r\nline2")).toBe("line1\\nline2");
  });

  it("escapes multiple special characters", () => {
    expect(escapeICalText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });

  it("returns empty string for empty input", () => {
    expect(escapeICalText("")).toBe("");
  });
});

describe("formatICalDateTime", () => {
  it("formats UTC date correctly", () => {
    const date = new Date(Date.UTC(2026, 0, 14, 10, 30, 0));
    expect(formatICalDateTime(date)).toBe("20260114T103000Z");
  });

  it("pads single-digit months and days", () => {
    const date = new Date(Date.UTC(2026, 0, 5, 9, 5, 5));
    expect(formatICalDateTime(date)).toBe("20260105T090505Z");
  });

  it("handles midnight", () => {
    const date = new Date(Date.UTC(2026, 11, 31, 0, 0, 0));
    expect(formatICalDateTime(date)).toBe("20261231T000000Z");
  });
});

describe("formatICalDate", () => {
  it("formats date correctly", () => {
    const date = new Date(Date.UTC(2026, 0, 14));
    expect(formatICalDate(date)).toBe("20260114");
  });

  it("pads single-digit months and days", () => {
    const date = new Date(Date.UTC(2026, 0, 5));
    expect(formatICalDate(date)).toBe("20260105");
  });
});

describe("generateUID", () => {
  it("generates UID with macro-calendar domain", () => {
    expect(generateUID("abc123")).toBe("abc123@macro-calendar");
  });

  it("handles UUID format", () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(generateUID(uuid)).toBe(`${uuid}@macro-calendar`);
  });
});

describe("foldLine", () => {
  it("returns short lines unchanged", () => {
    const line = "SHORT LINE";
    expect(foldLine(line)).toBe(line);
  });

  it("folds lines at 75 characters", () => {
    const line = "A".repeat(100);
    const folded = foldLine(line);
    const lines = folded.split("\r\n");

    expect(lines[0].length).toBe(75);
    expect(lines[1]).toMatch(/^ /); // Continuation starts with space
  });

  it("folds very long lines into multiple parts", () => {
    const line = "X".repeat(200);
    const folded = foldLine(line);
    const lines = folded.split("\r\n");

    expect(lines.length).toBeGreaterThan(2);
    // All continuation lines start with space
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]).toMatch(/^ /);
    }
  });
});

describe("generateVEvent", () => {
  const baseEvent: CalendarEventData = {
    id: "test-123",
    title: "US CPI Release",
    startTime: new Date(Date.UTC(2026, 0, 14, 13, 30, 0)),
  };

  it("generates valid VEVENT block", () => {
    const vevent = generateVEvent(baseEvent);

    expect(vevent).toContain("BEGIN:VEVENT");
    expect(vevent).toContain("END:VEVENT");
    expect(vevent).toContain("UID:test-123@macro-calendar");
    expect(vevent).toContain("SUMMARY:US CPI Release");
    expect(vevent).toContain("DTSTART:20260114T133000Z");
  });

  it("includes description when provided", () => {
    const event = { ...baseEvent, description: "Important release" };
    const vevent = generateVEvent(event);

    expect(vevent).toContain("DESCRIPTION:Important release");
  });

  it("includes location when provided", () => {
    const event = { ...baseEvent, location: "US" };
    const vevent = generateVEvent(event);

    expect(vevent).toContain("LOCATION:US");
  });

  it("includes URL when provided", () => {
    const event = { ...baseEvent, url: "https://example.com/release/123" };
    const vevent = generateVEvent(event);

    expect(vevent).toContain("URL:https://example.com/release/123");
  });

  it("escapes special characters in title", () => {
    const event = { ...baseEvent, title: "CPI, Core (YoY); Q4" };
    const vevent = generateVEvent(event);

    expect(vevent).toContain("SUMMARY:CPI\\, Core (YoY)\\; Q4");
  });

  it("defaults end time to 1 hour after start", () => {
    const vevent = generateVEvent(baseEvent);

    expect(vevent).toContain("DTEND:20260114T143000Z");
  });

  it("uses provided end time", () => {
    const event = {
      ...baseEvent,
      endTime: new Date(Date.UTC(2026, 0, 14, 14, 0, 0)),
    };
    const vevent = generateVEvent(event);

    expect(vevent).toContain("DTEND:20260114T140000Z");
  });
});

describe("generateICalendar", () => {
  const events: CalendarEventData[] = [
    {
      id: "event-1",
      title: "US CPI",
      startTime: new Date(Date.UTC(2026, 0, 14, 13, 30, 0)),
    },
    {
      id: "event-2",
      title: "EU GDP",
      startTime: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
    },
  ];

  it("generates valid iCalendar file", () => {
    const ical = generateICalendar(events);

    expect(ical).toContain("BEGIN:VCALENDAR");
    expect(ical).toContain("END:VCALENDAR");
    expect(ical).toContain("VERSION:2.0");
    expect(ical).toContain("PRODID:-//Macro Calendar//EN");
  });

  it("includes all events", () => {
    const ical = generateICalendar(events);

    expect(ical).toContain("SUMMARY:US CPI");
    expect(ical).toContain("SUMMARY:EU GDP");
    expect((ical.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
  });

  it("uses custom product ID when provided", () => {
    const ical = generateICalendar(events, { productId: "-//Custom//EN" });

    expect(ical).toContain("PRODID:-//Custom//EN");
  });

  it("includes calendar name when provided", () => {
    const ical = generateICalendar(events, { calendarName: "My Watchlist" });

    expect(ical).toContain("X-WR-CALNAME:My Watchlist");
  });

  it("uses CRLF line endings", () => {
    const ical = generateICalendar(events);

    expect(ical).toContain("\r\n");
    expect(ical).not.toMatch(/[^\r]\n/); // No bare LF without CR
  });

  it("handles empty events array", () => {
    const ical = generateICalendar([]);

    expect(ical).toContain("BEGIN:VCALENDAR");
    expect(ical).toContain("END:VCALENDAR");
    expect(ical).not.toContain("BEGIN:VEVENT");
  });
});

describe("generateGoogleCalendarUrl", () => {
  const baseEvent: CalendarEventData = {
    id: "test-123",
    title: "US CPI Release",
    startTime: new Date(Date.UTC(2026, 0, 14, 13, 30, 0)),
  };

  it("generates valid Google Calendar URL", () => {
    const url = generateGoogleCalendarUrl(baseEvent);

    expect(url).toContain("https://calendar.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("text=US+CPI+Release");
    expect(url).toContain("dates=20260114T133000Z");
  });

  it("includes date range with default 1 hour duration", () => {
    const url = generateGoogleCalendarUrl(baseEvent);

    expect(url).toContain("dates=20260114T133000Z%2F20260114T143000Z");
  });

  it("includes custom end time", () => {
    const event = {
      ...baseEvent,
      endTime: new Date(Date.UTC(2026, 0, 14, 14, 0, 0)),
    };
    const url = generateGoogleCalendarUrl(event);

    expect(url).toContain("dates=20260114T133000Z%2F20260114T140000Z");
  });

  it("includes description when provided", () => {
    const event = { ...baseEvent, description: "Important release" };
    const url = generateGoogleCalendarUrl(event);

    expect(url).toContain("details=Important+release");
  });

  it("includes location when provided", () => {
    const event = { ...baseEvent, location: "United States" };
    const url = generateGoogleCalendarUrl(event);

    expect(url).toContain("location=United+States");
  });

  it("encodes special characters in title", () => {
    const event = { ...baseEvent, title: "CPI (YoY) & Core" };
    const url = generateGoogleCalendarUrl(event);

    // URL-encoded characters
    expect(url).toContain("text=CPI+%28YoY%29+%26+Core");
  });
});

describe("releaseToCalendarEvent", () => {
  const release: ReleaseWithIndicator = {
    id: "release-123",
    release_at: "2026-01-14T13:30:00Z",
    period: "December 2025",
    forecast: "2.9%",
    previous: "2.7%",
    indicator_name: "Consumer Price Index",
    country_code: "US",
    category: "Inflation",
  };

  it("converts release to calendar event", () => {
    const event = releaseToCalendarEvent(release);

    expect(event.id).toBe("release-123");
    expect(event.title).toBe("Consumer Price Index (US)");
    expect(event.startTime).toEqual(new Date("2026-01-14T13:30:00Z"));
  });

  it("sets 30 minute duration for economic releases", () => {
    const event = releaseToCalendarEvent(release);

    expect(event.endTime).toEqual(new Date("2026-01-14T14:00:00Z"));
  });

  it("includes period in description", () => {
    const event = releaseToCalendarEvent(release);

    expect(event.description).toContain("Period: December 2025");
  });

  it("includes country in description", () => {
    const event = releaseToCalendarEvent(release);

    expect(event.description).toContain("Country: US");
  });

  it("includes category in description", () => {
    const event = releaseToCalendarEvent(release);

    expect(event.description).toContain("Category: Inflation");
  });

  it("includes forecast when present", () => {
    const event = releaseToCalendarEvent(release);

    expect(event.description).toContain("Forecast: 2.9%");
  });

  it("includes previous when present", () => {
    const event = releaseToCalendarEvent(release);

    expect(event.description).toContain("Previous: 2.7%");
  });

  it("omits forecast when null", () => {
    const releaseNoForecast = { ...release, forecast: null };
    const event = releaseToCalendarEvent(releaseNoForecast);

    expect(event.description).not.toContain("Forecast:");
  });

  it("omits previous when null", () => {
    const releaseNoPrevious = { ...release, previous: null };
    const event = releaseToCalendarEvent(releaseNoPrevious);

    expect(event.description).not.toContain("Previous:");
  });

  it("sets country code as location", () => {
    const event = releaseToCalendarEvent(release);

    expect(event.location).toBe("US");
  });

  it("uses indicator_id for URL when provided", () => {
    const releaseWithIndicatorId = { ...release, indicator_id: "indicator-456" };
    const event = releaseToCalendarEvent(releaseWithIndicatorId, "https://example.com");

    expect(event.url).toBe("https://example.com/indicator/indicator-456");
  });

  it("falls back to release id for URL when indicator_id is not provided", () => {
    const event = releaseToCalendarEvent(release, "https://example.com");

    expect(event.url).toBe("https://example.com/indicator/release-123");
  });

  it("omits URL when baseUrl is not provided", () => {
    const event = releaseToCalendarEvent(release);

    expect(event.url).toBeUndefined();
  });
});
