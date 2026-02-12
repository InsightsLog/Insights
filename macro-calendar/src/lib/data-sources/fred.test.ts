/**
 * Tests for FRED API client.
 *
 * Task: T404
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FRED_SERIES_MAP,
  fetchSeriesData,
  fetchSeriesInfo,
  fetchObservations,
} from "./fred";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FRED_SERIES_MAP", () => {
  it("contains common US economic indicators", () => {
    expect(FRED_SERIES_MAP).toHaveProperty("CPIAUCSL");
    expect(FRED_SERIES_MAP).toHaveProperty("PAYEMS");
    expect(FRED_SERIES_MAP).toHaveProperty("GDP");
    expect(FRED_SERIES_MAP).toHaveProperty("UNRATE");
    expect(FRED_SERIES_MAP).toHaveProperty("FEDFUNDS");
  });

  it("maps series IDs to readable names", () => {
    expect(FRED_SERIES_MAP.CPIAUCSL).toBe("CPI (Consumer Price Index)");
    expect(FRED_SERIES_MAP.PAYEMS).toBe("Nonfarm Payrolls");
    expect(FRED_SERIES_MAP.UNRATE).toBe("Unemployment Rate");
  });
});

describe("fetchSeriesInfo", () => {
  it("returns series metadata on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          seriess: [
            {
              id: "CPIAUCSL",
              title: "Consumer Price Index for All Urban Consumers",
              frequency: "Monthly",
              frequency_short: "M",
              units: "Index 1982-1984=100",
              units_short: "Index",
              seasonal_adjustment: "Seasonally Adjusted",
              seasonal_adjustment_short: "SA",
              last_updated: "2026-01-15",
              observation_start: "1947-01-01",
              observation_end: "2025-12-01",
            },
          ],
        }),
    });

    const result = await fetchSeriesInfo("CPIAUCSL", "test_key");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("CPIAUCSL");
    expect(result?.frequency).toBe("Monthly");
  });

  it("returns null when series not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await fetchSeriesInfo("INVALID_SERIES", "test_key");
    expect(result).toBeNull();
  });
});

describe("fetchObservations", () => {
  it("returns parsed observations", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          realtime_start: "2026-01-01",
          realtime_end: "2026-12-31",
          observation_start: "2025-01-01",
          observation_end: "2025-12-01",
          count: 2,
          offset: 0,
          limit: 100000,
          observations: [
            { date: "2025-12-01", value: "319.456" },
            { date: "2025-11-01", value: "318.234" },
          ],
        }),
    });

    const result = await fetchObservations("CPIAUCSL", "test_key", {
      observationStart: "2025-01-01",
    });

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2025-12-01");
    expect(result[0].value).toBe("319.456");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });

    await expect(fetchObservations("CPIAUCSL", "test_key")).rejects.toThrow(
      "FRED API error"
    );
  });
});

describe("fetchSeriesData", () => {
  it("returns combined metadata and observations", async () => {
    // First call: series info
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          seriess: [
            {
              id: "UNRATE",
              title: "Unemployment Rate",
              frequency: "Monthly",
              frequency_short: "M",
              units: "Percent",
              units_short: "%",
              seasonal_adjustment: "Seasonally Adjusted",
              seasonal_adjustment_short: "SA",
              last_updated: "2026-01-10",
              observation_start: "1948-01-01",
              observation_end: "2025-12-01",
            },
          ],
        }),
    });

    // Second call: observations
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          realtime_start: "2026-01-01",
          realtime_end: "2026-12-31",
          observation_start: "2025-10-01",
          observation_end: "2025-12-01",
          count: 3,
          offset: 0,
          limit: 100000,
          observations: [
            { date: "2025-12-01", value: "3.7" },
            { date: "2025-11-01", value: "3.8" },
            { date: "2025-10-01", value: "." },
          ],
        }),
    });

    const result = await fetchSeriesData("UNRATE", "test_key", {
      observationStart: "2025-10-01",
    });

    expect(result.seriesId).toBe("UNRATE");
    expect(result.seriesInfo).not.toBeNull();
    expect(result.error).toBeUndefined();
    // "." values are filtered out
    expect(result.dataPoints).toHaveLength(2);
    expect(result.dataPoints[0].indicatorName).toBe("Unemployment Rate");
    expect(result.dataPoints[0].value).toBe("3.7");
    expect(result.dataPoints[0].unit).toBe("%");
  });

  it("returns error result on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await fetchSeriesData("CPIAUCSL", "test_key");

    expect(result.seriesId).toBe("CPIAUCSL");
    expect(result.dataPoints).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Network error");
  }, 15000);
});
