/**
 * BLS Client Tests
 *
 * Unit tests for the BLS API client module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BLSClient, BLSApiError, BLS_SERIES_CONFIG } from "./bls-client";

// Mock getBLSApiKey
vi.mock("@/lib/env", () => ({
  getBLSApiKey: vi.fn(() => "test-api-key"),
}));

describe("BLSClient", () => {
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
      const client = new BLSClient("custom-key");
      expect(client).toBeInstanceOf(BLSClient);
    });

    it("should create client with environment API key", () => {
      const client = new BLSClient();
      expect(client).toBeInstanceOf(BLSClient);
    });

    it("should create client without API key (unauthenticated mode)", async () => {
      const { getBLSApiKey } = await import("@/lib/env");
      vi.mocked(getBLSApiKey).mockReturnValue(null);

      // Should not throw, BLS works without key
      const client = new BLSClient();
      expect(client).toBeInstanceOf(BLSClient);
    });
  });

  describe("getSeriesInfo", () => {
    it("should fetch series metadata", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [
              {
                seriesID: "LNS14000000",
                catalog: {
                  series_title: "Unemployment Rate",
                  survey_name: "Labor Force Statistics",
                  seasonality: "Seasonally Adjusted",
                  periodicity_code: "M",
                },
                data: [],
              },
            ],
          },
        }),
      });

      const client = new BLSClient("test-key");
      const info = await client.getSeriesInfo("LNS14000000");

      expect(info).toEqual({
        seriesId: "LNS14000000",
        title: "Unemployment Rate",
        surveyName: "Labor Force Statistics",
        seasonalAdjustment: "Seasonally Adjusted",
        periodicity: "M",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("api.bls.gov"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should throw error when series not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [],
          },
        }),
      });

      const client = new BLSClient("test-key");

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

      const client = new BLSClient("test-key");

      await expect(client.getSeriesInfo("LNS14000000")).rejects.toThrow(BLSApiError);
    });

    it("should throw error when API returns failure status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_FAILED",
          message: ["Invalid series ID"],
          Results: null,
        }),
      });

      const client = new BLSClient("test-key");

      await expect(client.getSeriesInfo("INVALID")).rejects.toThrow(
        /BLS API request failed/
      );
    });
  });

  describe("getSeriesObservations", () => {
    it("should fetch series observations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [
              {
                seriesID: "LNS14000000",
                data: [
                  { year: "2024", period: "M03", periodName: "March", value: "3.9" },
                  { year: "2024", period: "M02", periodName: "February", value: "3.8" },
                  { year: "2024", period: "M01", periodName: "January", value: "3.7" },
                ],
              },
            ],
          },
        }),
      });

      const client = new BLSClient("test-key");
      const results = await client.getSeriesObservations(["LNS14000000"], "2024", "2024");

      const observations = results.get("LNS14000000");
      expect(observations).toHaveLength(3);
      // BLS returns reverse chronological, our code reverses to chronological
      expect(observations?.[0].value).toBe("3.7");
      expect(observations?.[0].date).toBe("2024-01-01");
      expect(observations?.[0].period).toBe("Jan 2024");
    });

    it("should filter out missing values", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [
              {
                seriesID: "LNS14000000",
                data: [
                  { year: "2024", period: "M02", periodName: "February", value: "3.8" },
                  { year: "2024", period: "M01", periodName: "January", value: "-" },
                ],
              },
            ],
          },
        }),
      });

      const client = new BLSClient("test-key");
      const results = await client.getSeriesObservations(["LNS14000000"], "2024", "2024");

      // Should filter out missing value
      expect(results.get("LNS14000000")).toHaveLength(1);
    });

    it("should handle quarterly data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [
              {
                seriesID: "TEST_QUARTERLY",
                data: [
                  { year: "2024", period: "Q01", periodName: "1st Quarter", value: "100" },
                ],
              },
            ],
          },
        }),
      });

      const client = new BLSClient("test-key");
      const results = await client.getSeriesObservations(["TEST_QUARTERLY"], "2024", "2024");

      const obs = results.get("TEST_QUARTERLY")?.[0];
      expect(obs?.date).toBe("2024-01-01");
      expect(obs?.period).toBe("Q1 2024");
    });

    it("should handle empty observations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [
              {
                seriesID: "EMPTY",
                data: [],
              },
            ],
          },
        }),
      });

      const client = new BLSClient("test-key");
      const results = await client.getSeriesObservations(["EMPTY"], "2024", "2024");

      expect(results.get("EMPTY")).toEqual([]);
    });

    it("should use default end year if not provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [{ seriesID: "TEST", data: [] }],
          },
        }),
      });

      const client = new BLSClient("test-key");
      await client.getSeriesObservations(["TEST"], "2020");

      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const currentYear = new Date().getFullYear().toString();
      expect(calledBody.endyear).toBe(currentYear);
    });
  });

  describe("getSingleSeriesObservations", () => {
    it("should return observations for single series", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [
              {
                seriesID: "LNS14000000",
                data: [
                  { year: "2024", period: "M01", periodName: "January", value: "3.7" },
                ],
              },
            ],
          },
        }),
      });

      const client = new BLSClient("test-key");
      const observations = await client.getSingleSeriesObservations("LNS14000000", "2024");

      expect(observations).toHaveLength(1);
      expect(observations[0].value).toBe("3.7");
    });
  });

  describe("rate limiting", () => {
    it("should include API key in request when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: { series: [{ seriesID: "TEST", data: [] }] },
        }),
      });

      const client = new BLSClient("my-api-key");
      await client.getSeriesObservations(["TEST"], "2024", "2024");

      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(calledBody.registrationkey).toBe("my-api-key");
    });

    it("should not include API key when not provided", async () => {
      const { getBLSApiKey } = await import("@/lib/env");
      vi.mocked(getBLSApiKey).mockReturnValue(null);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: { series: [{ seriesID: "TEST", data: [] }] },
        }),
      });

      const client = new BLSClient();
      await client.getSeriesObservations(["TEST"], "2024", "2024");

      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(calledBody.registrationkey).toBeUndefined();
    });
  });
});

describe("BLS_SERIES_CONFIG", () => {
  it("should have valid configuration for all series", () => {
    const seriesIds = Object.keys(BLS_SERIES_CONFIG);

    expect(seriesIds.length).toBeGreaterThan(0);

    for (const id of seriesIds) {
      const config = BLS_SERIES_CONFIG[id as keyof typeof BLS_SERIES_CONFIG];
      expect(config.name).toBeTruthy();
      expect(config.category).toBeTruthy();
      expect(config.countryCode).toBe("US");
      expect(config.frequency).toBeTruthy();
    }
  });

  it("should include key economic indicators", () => {
    expect(BLS_SERIES_CONFIG).toHaveProperty("LNS14000000"); // Unemployment Rate
    expect(BLS_SERIES_CONFIG).toHaveProperty("CUUR0000SA0"); // CPI All Items
    expect(BLS_SERIES_CONFIG).toHaveProperty("CES0000000001"); // Nonfarm Employment
  });
});

describe("BLSApiError", () => {
  it("should create error with message", () => {
    const error = new BLSApiError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("BLSApiError");
  });

  it("should include status code", () => {
    const error = new BLSApiError("Not found", 404);
    expect(error.statusCode).toBe(404);
  });

  it("should include series ID", () => {
    const error = new BLSApiError("Series not found", 404, "INVALID");
    expect(error.seriesId).toBe("INVALID");
  });
});
