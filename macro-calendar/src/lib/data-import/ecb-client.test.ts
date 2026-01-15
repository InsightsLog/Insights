/**
 * ECB Client Tests
 *
 * Unit tests for the ECB API client module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ECBClient, ECBApiError, ECB_SERIES_CONFIG } from "./ecb-client";

describe("ECBClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create client without API key (ECB is free)", () => {
      const client = new ECBClient();
      expect(client).toBeInstanceOf(ECBClient);
    });
  });

  describe("getSeriesObservations", () => {
    it("should fetch series observations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dataSets: [
            {
              series: {
                "0:0:0": {
                  observations: {
                    "0": [3.5],
                    "1": [3.6],
                    "2": [3.7],
                  },
                },
              },
            },
          ],
          structure: {
            dimensions: {
              series: [{ id: "FREQ", values: [{ id: "M", name: "Monthly" }] }],
              observation: [
                {
                  id: "TIME_PERIOD",
                  values: [
                    { id: "2024-01", name: "2024-01" },
                    { id: "2024-02", name: "2024-02" },
                    { id: "2024-03", name: "2024-03" },
                  ],
                },
              ],
            },
          },
        }),
      });

      const client = new ECBClient();
      const observations = await client.getSeriesObservations(
        "ICP",
        "M.U2.N.000000.4.ANR",
        "2024-01"
      );

      expect(observations).toHaveLength(3);
      expect(observations[0].value).toBe("3.5");
      expect(observations[0].date).toBe("2024-01-01");
      expect(observations[0].period).toBe("Jan 2024");
    });

    it("should filter out null values", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dataSets: [
            {
              series: {
                "0:0:0": {
                  observations: {
                    "0": [3.5],
                    "1": [null],
                    "2": [3.7],
                  },
                },
              },
            },
          ],
          structure: {
            dimensions: {
              series: [{ id: "FREQ", values: [{ id: "M", name: "Monthly" }] }],
              observation: [
                {
                  id: "TIME_PERIOD",
                  values: [
                    { id: "2024-01", name: "2024-01" },
                    { id: "2024-02", name: "2024-02" },
                    { id: "2024-03", name: "2024-03" },
                  ],
                },
              ],
            },
          },
        }),
      });

      const client = new ECBClient();
      const observations = await client.getSeriesObservations(
        "ICP",
        "M.U2.N.000000.4.ANR"
      );

      // Should filter out null value
      expect(observations).toHaveLength(2);
    });

    it("should handle quarterly data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dataSets: [
            {
              series: {
                "0:0:0": {
                  observations: {
                    "0": [0.5],
                  },
                },
              },
            },
          ],
          structure: {
            dimensions: {
              series: [{ id: "FREQ", values: [{ id: "Q", name: "Quarterly" }] }],
              observation: [
                {
                  id: "TIME_PERIOD",
                  values: [{ id: "2024-Q1", name: "2024-Q1" }],
                },
              ],
            },
          },
        }),
      });

      const client = new ECBClient();
      const observations = await client.getSeriesObservations(
        "MNA",
        "Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY"
      );

      expect(observations).toHaveLength(1);
      expect(observations[0].date).toBe("2024-01-01");
      expect(observations[0].period).toBe("Q1 2024");
    });

    it("should handle empty datasets", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dataSets: [],
        }),
      });

      const client = new ECBClient();
      const observations = await client.getSeriesObservations(
        "ICP",
        "M.U2.N.000000.4.ANR"
      );

      expect(observations).toEqual([]);
    });

    it("should handle 404 as no data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "No data found",
      });

      const client = new ECBClient();
      const observations = await client.getSeriesObservations(
        "ICP",
        "M.XX.N.000000.4.ANR" // Invalid country code
      );

      // Should return empty array for 404
      expect(observations).toEqual([]);
    });

    it("should throw error on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Server error",
      });

      const client = new ECBClient();

      await expect(
        client.getSeriesObservations("ICP", "M.U2.N.000000.4.ANR")
      ).rejects.toThrow(ECBApiError);
    });

    it("should sort observations by date", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dataSets: [
            {
              series: {
                "0:0:0": {
                  observations: {
                    "2": [3.7],
                    "0": [3.5],
                    "1": [3.6],
                  },
                },
              },
            },
          ],
          structure: {
            dimensions: {
              series: [{ id: "FREQ", values: [{ id: "M", name: "Monthly" }] }],
              observation: [
                {
                  id: "TIME_PERIOD",
                  values: [
                    { id: "2024-01", name: "2024-01" },
                    { id: "2024-02", name: "2024-02" },
                    { id: "2024-03", name: "2024-03" },
                  ],
                },
              ],
            },
          },
        }),
      });

      const client = new ECBClient();
      const observations = await client.getSeriesObservations(
        "ICP",
        "M.U2.N.000000.4.ANR"
      );

      // Should be sorted by date
      expect(observations[0].date).toBe("2024-01-01");
      expect(observations[1].date).toBe("2024-02-01");
      expect(observations[2].date).toBe("2024-03-01");
    });
  });

  describe("getSeriesInfo", () => {
    it("should fetch series metadata", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dataSets: [{ series: {} }],
          structure: {
            name: "HICP - All items",
            dimensions: {
              series: [{ id: "FREQ", values: [{ id: "M", name: "Monthly" }] }],
              observation: [],
            },
          },
        }),
      });

      const client = new ECBClient();
      const info = await client.getSeriesInfo("ICP", "M.U2.N.000000.4.ANR");

      expect(info.title).toBe("HICP - All items");
      expect(info.frequency).toBe("M");
      expect(info.seriesKey).toBe("ICP/M.U2.N.000000.4.ANR");
    });

    it("should use fallback title when structure name is missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dataSets: [{ series: {} }],
          structure: {
            dimensions: {
              series: [{ id: "FREQ", values: [{ id: "Q", name: "Quarterly" }] }],
              observation: [],
            },
          },
        }),
      });

      const client = new ECBClient();
      const info = await client.getSeriesInfo("MNA", "Q.Y.I9.GDP");

      expect(info.title).toBe("MNA - Q.Y.I9.GDP");
      expect(info.frequency).toBe("Q");
    });
  });
});

describe("ECB_SERIES_CONFIG", () => {
  it("should have valid configuration for all series", () => {
    const seriesIds = Object.keys(ECB_SERIES_CONFIG);

    expect(seriesIds.length).toBeGreaterThan(0);

    for (const id of seriesIds) {
      const config = ECB_SERIES_CONFIG[id as keyof typeof ECB_SERIES_CONFIG];
      expect(config.name).toBeTruthy();
      expect(config.category).toBeTruthy();
      expect(config.countryCode).toBeTruthy();
      expect(config.dataflow).toBeTruthy();
      expect(config.seriesKey).toBeTruthy();
      expect(config.frequency).toBeTruthy();
    }
  });

  it("should include key Eurozone indicators", () => {
    expect(ECB_SERIES_CONFIG).toHaveProperty("ICP.M.U2.N.000000.4.ANR"); // HICP Inflation
    expect(ECB_SERIES_CONFIG).toHaveProperty("FM.D.U2.EUR.4F.KR.MRR_FR.LEV"); // ECB Main Rate
  });

  it("should include indicators for major EU countries", () => {
    // Check for Germany, France, Italy, Spain
    const seriesIds = Object.keys(ECB_SERIES_CONFIG);
    const countryCodes = seriesIds.map(
      (id) => ECB_SERIES_CONFIG[id as keyof typeof ECB_SERIES_CONFIG].countryCode
    );

    expect(countryCodes).toContain("EU");
    expect(countryCodes).toContain("DE");
    expect(countryCodes).toContain("FR");
    expect(countryCodes).toContain("IT");
    expect(countryCodes).toContain("ES");
  });
});

describe("ECBApiError", () => {
  it("should create error with message", () => {
    const error = new ECBApiError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("ECBApiError");
  });

  it("should include status code", () => {
    const error = new ECBApiError("Not found", 404);
    expect(error.statusCode).toBe(404);
  });

  it("should include dataflow", () => {
    const error = new ECBApiError("Series not found", 404, "ICP");
    expect(error.dataflow).toBe("ICP");
  });
});
