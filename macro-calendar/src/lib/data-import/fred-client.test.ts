/**
 * FRED Client Tests
 *
 * Unit tests for the FRED API client module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FredClient, FredApiError, FRED_SERIES_CONFIG } from "./fred-client";

// Mock getFredApiKey
vi.mock("@/lib/env", () => ({
  getFredApiKey: vi.fn(() => "test-api-key"),
}));

describe("FredClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create client with provided API key", () => {
      const client = new FredClient("custom-key");
      expect(client).toBeInstanceOf(FredClient);
    });

    it("should create client with environment API key", () => {
      const client = new FredClient();
      expect(client).toBeInstanceOf(FredClient);
    });

    it("should throw error when no API key is available", async () => {
      const { getFredApiKey } = await import("@/lib/env");
      vi.mocked(getFredApiKey).mockReturnValue(null);

      expect(() => new FredClient()).toThrow(FredApiError);
    });
  });

  describe("getSeriesInfo", () => {
    it("should fetch series metadata", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seriess: [
            {
              id: "GDP",
              title: "Gross Domestic Product",
              frequency: "Quarterly",
              units: "Billions of Dollars",
              notes: "Real GDP",
            },
          ],
        }),
      });

      const client = new FredClient("test-key");
      const info = await client.getSeriesInfo("GDP");

      expect(info).toEqual({
        id: "GDP",
        title: "Gross Domestic Product",
        frequency: "Quarterly",
        units: "Billions of Dollars",
        notes: "Real GDP",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("series?")
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("series_id=GDP")
      );
    });

    it("should throw error when series not found", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ seriess: [] }),
      });

      const client = new FredClient("test-key");

      await expect(client.getSeriesInfo("INVALID")).rejects.toThrow(
        /Series not found/
      );
    });

    it("should throw error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Server error",
      });

      const client = new FredClient("test-key");

      await expect(client.getSeriesInfo("GDP")).rejects.toThrow(FredApiError);
    });
  });

  describe("getSeriesObservations", () => {
    it("should fetch series observations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          observations: [
            { date: "2024-01-01", value: "100.5" },
            { date: "2024-02-01", value: "101.2" },
            { date: "2024-03-01", value: "." }, // Missing value
          ],
        }),
      });

      const client = new FredClient("test-key");
      const observations = await client.getSeriesObservations("UNRATE");

      // Should filter out missing values
      expect(observations).toHaveLength(2);
      expect(observations).toEqual([
        { date: "2024-01-01", value: "100.5" },
        { date: "2024-02-01", value: "101.2" },
      ]);
    });

    it("should pass date range parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ observations: [] }),
      });

      const client = new FredClient("test-key");
      await client.getSeriesObservations("GDP", "2020-01-01", "2024-01-01");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("observation_start=2020-01-01")
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("observation_end=2024-01-01")
      );
    });

    it("should handle empty observations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ observations: [] }),
      });

      const client = new FredClient("test-key");
      const observations = await client.getSeriesObservations("EMPTY");

      expect(observations).toEqual([]);
    });
  });

  describe("rate limiting", () => {
    it("should track request count", async () => {
      // First request
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          seriess: [
            { id: "GDP", title: "GDP", frequency: "Q", units: "$" },
          ],
        }),
      });

      const client = new FredClient("test-key");

      // Make multiple requests
      await client.getSeriesInfo("GDP");
      await client.getSeriesInfo("GDP");
      await client.getSeriesInfo("GDP");

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});

describe("FRED_SERIES_CONFIG", () => {
  it("should have valid configuration for all series", () => {
    const seriesIds = Object.keys(FRED_SERIES_CONFIG);

    expect(seriesIds.length).toBeGreaterThan(0);

    for (const id of seriesIds) {
      const config = FRED_SERIES_CONFIG[id as keyof typeof FRED_SERIES_CONFIG];
      expect(config.name).toBeTruthy();
      expect(config.category).toBeTruthy();
      expect(config.countryCode).toBe("US");
    }
  });

  it("should include key economic indicators", () => {
    expect(FRED_SERIES_CONFIG).toHaveProperty("GDPC1"); // Real GDP
    expect(FRED_SERIES_CONFIG).toHaveProperty("CPIAUCSL"); // CPI
    expect(FRED_SERIES_CONFIG).toHaveProperty("UNRATE"); // Unemployment
    expect(FRED_SERIES_CONFIG).toHaveProperty("PAYEMS"); // Payrolls
    expect(FRED_SERIES_CONFIG).toHaveProperty("FEDFUNDS"); // Fed Funds
    expect(FRED_SERIES_CONFIG).toHaveProperty("DGS10"); // 10Y Treasury
  });
});

describe("FredApiError", () => {
  it("should create error with message", () => {
    const error = new FredApiError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("FredApiError");
  });

  it("should include status code", () => {
    const error = new FredApiError("Not found", 404);
    expect(error.statusCode).toBe(404);
  });

  it("should include series ID", () => {
    const error = new FredApiError("Series not found", 404, "INVALID");
    expect(error.seriesId).toBe("INVALID");
  });
});
