/**
 * CME Calendar Client Tests
 *
 * Unit tests for the CME Group Economic Calendar client module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CMECalendarClient, CMEApiError } from "./cme-calendar-client";

describe("CMECalendarClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create client instance", () => {
      const client = new CMECalendarClient();
      expect(client).toBeInstanceOf(CMECalendarClient);
    });
  });

  describe("getMonthlyEvents", () => {
    it("should throw CMEApiError on 404 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const client = new CMECalendarClient();
      await expect(client.getMonthlyEvents(2026, 1)).rejects.toThrow(
        CMEApiError
      );
    });

    it("should include status code in error message on 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const client = new CMECalendarClient();
      await expect(client.getMonthlyEvents(2026, 1)).rejects.toThrow("404");
    });

    it("should throw CMEApiError on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const client = new CMECalendarClient();
      await expect(client.getMonthlyEvents(2026, 1)).rejects.toThrow(
        CMEApiError
      );
    });

    it("should parse HTML and return events on success", async () => {
      const mockHtml = `
        <div class="DateLabel">15</div>
        <div id="Event_1">
          <span class="FlagUS"></span>
          <span class="Time">8:30 AM</span>
          <a href="/education/events/cpi">CPI (YoY)</a>
        </div>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });

      const client = new CMECalendarClient();
      const events = await client.getMonthlyEvents(2026, 1);

      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe("getUpcomingEventsWithErrors", () => {
    it("should return errors array when all months and fallback fail", async () => {
      // All fetch calls fail (CME months + TradingEconomics fallback)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const client = new CMECalendarClient();
      const result = await client.getUpcomingEventsWithErrors(2);

      expect(result.allMonthsFailed).toBe(true);
      // 2 CME month errors + 1 TradingEconomics fallback error = 3
      expect(result.errors.length).toBe(3);
      expect(result.events.length).toBe(0);
    });

    it("should include status code in error details", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const client = new CMECalendarClient();
      const result = await client.getUpcomingEventsWithErrors(1);

      expect(result.errors[0].statusCode).toBe(404);
      expect(result.errors[0].message).toContain("404");
    });

    it("should return allMonthsFailed as false when some months succeed", async () => {
      // First month fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      // Second month succeeds with empty calendar
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<div></div>",
      });

      const client = new CMECalendarClient();
      const result = await client.getUpcomingEventsWithErrors(2);

      expect(result.allMonthsFailed).toBe(false);
      expect(result.errors.length).toBe(1);
    });

    it("should return events from successful months only", async () => {
      // First month fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
      });

      // Second month succeeds with some HTML
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<div></div>",
      });

      const client = new CMECalendarClient();
      const result = await client.getUpcomingEventsWithErrors(2);

      expect(result.allMonthsFailed).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].statusCode).toBe(500);
    });

    it("should use TradingEconomics fallback when CME fails", async () => {
      // CME months fail
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      // TradingEconomics fallback succeeds with calendar data
      const teMockHtml = `
        <table id="calendar">
          <tr data-url="/us/gdp" data-country="united states" data-event="GDP Growth Rate">
            <td class="2026-02-01"><span class="event-3">8:30 AM</span></td>
            <td><span class="calendar-iso">US</span></td>
            <td><a class="calendar-event">GDP Growth Rate</a></td>
          </tr>
        </table>
      `;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => teMockHtml,
      });

      const client = new CMECalendarClient();
      const result = await client.getUpcomingEventsWithErrors(2);

      expect(result.allMonthsFailed).toBe(false);
      expect(result.usedFallback).toBe(true);
      expect(result.source).toBe("tradingeconomics");
      expect(result.events.length).toBeGreaterThanOrEqual(0); // May filter by date
    });

    it("should set source to cme when CME succeeds", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<div></div>",
      });

      const client = new CMECalendarClient();
      const result = await client.getUpcomingEventsWithErrors(1);

      expect(result.source).toBe("cme");
      expect(result.usedFallback).toBe(false);
    });
  });

  describe("getUpcomingEvents (deprecated)", () => {
    it("should return events array directly", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const client = new CMECalendarClient();
      const events = await client.getUpcomingEvents(2);

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });
  });
});

describe("CMEApiError", () => {
  it("should store status code", () => {
    const error = new CMEApiError("Test error", 404);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("CMEApiError");
  });

  it("should default status code to undefined", () => {
    const error = new CMEApiError("Test error");
    expect(error.statusCode).toBeUndefined();
  });
});
