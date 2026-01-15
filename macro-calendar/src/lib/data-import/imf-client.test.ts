/**
 * IMF Client Tests
 *
 * Unit tests for the IMF API client functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IMFClient, IMFApiError, IMF_INDICATOR_CONFIG, IMF_COUNTRIES } from "./imf-client";

describe("IMFClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Suppress console output during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getIndicatorObservations", () => {
    it("should fetch and parse observations correctly", async () => {
      // Mock IMF API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          CompactData: {
            DataSet: {
              Series: {
                "@FREQ": "A",
                "@INDICATOR": "NGDP_RPCH",
                "@REF_AREA": "US",
                Obs: [
                  { "@TIME_PERIOD": "2023", "@OBS_VALUE": "2.5" },
                  { "@TIME_PERIOD": "2024", "@OBS_VALUE": "2.8" },
                ],
              },
            },
          },
        }),
      });

      const client = new IMFClient();
      const observations = await client.getIndicatorObservations(
        "NGDP_RPCH",
        ["US"],
        "2023",
        "2024"
      );

      expect(observations).toHaveLength(2);
      expect(observations[0]).toEqual({
        date: "2023-01-01",
        value: "2.5",
        period: "2023",
        countryCode: "US",
        countryName: "United States",
      });
      expect(observations[1]).toEqual({
        date: "2024-01-01",
        value: "2.8",
        period: "2024",
        countryCode: "US",
        countryName: "United States",
      });
    });

    it("should handle multiple observations as array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          CompactData: {
            DataSet: {
              Series: {
                "@FREQ": "A",
                "@INDICATOR": "PCPIPCH",
                "@REF_AREA": "GB",
                Obs: [
                  { "@TIME_PERIOD": "2022", "@OBS_VALUE": "9.1" },
                  { "@TIME_PERIOD": "2023", "@OBS_VALUE": "7.3" },
                  { "@TIME_PERIOD": "2024", "@OBS_VALUE": "2.5" },
                ],
              },
            },
          },
        }),
      });

      const client = new IMFClient();
      const observations = await client.getIndicatorObservations(
        "PCPIPCH",
        ["GB"],
        "2022",
        "2024"
      );

      expect(observations).toHaveLength(3);
      expect(observations[0].countryName).toBe("United Kingdom");
    });

    it("should handle single observation (not array)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          CompactData: {
            DataSet: {
              Series: {
                "@FREQ": "A",
                "@INDICATOR": "LUR",
                "@REF_AREA": "JP",
                Obs: { "@TIME_PERIOD": "2024", "@OBS_VALUE": "2.6" },
              },
            },
          },
        }),
      });

      const client = new IMFClient();
      const observations = await client.getIndicatorObservations(
        "LUR",
        ["JP"],
        "2024",
        "2024"
      );

      expect(observations).toHaveLength(1);
      expect(observations[0].value).toBe("2.6");
    });

    it("should skip null/empty values", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          CompactData: {
            DataSet: {
              Series: {
                "@FREQ": "A",
                "@INDICATOR": "NGDP_RPCH",
                "@REF_AREA": "US",
                Obs: [
                  { "@TIME_PERIOD": "2022", "@OBS_VALUE": "2.1" },
                  { "@TIME_PERIOD": "2023", "@OBS_VALUE": "" },
                  { "@TIME_PERIOD": "2024", "@OBS_VALUE": "2.8" },
                ],
              },
            },
          },
        }),
      });

      const client = new IMFClient();
      const observations = await client.getIndicatorObservations(
        "NGDP_RPCH",
        ["US"],
        "2022",
        "2024"
      );

      expect(observations).toHaveLength(2);
      expect(observations.map((o) => o.period)).toEqual(["2022", "2024"]);
    });

    it("should handle empty response gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          CompactData: {
            DataSet: {},
          },
        }),
      });

      const client = new IMFClient();
      const observations = await client.getIndicatorObservations(
        "NGDP_RPCH",
        ["XX"],
        "2024",
        "2024"
      );

      expect(observations).toHaveLength(0);
    });

    it("should handle API errors gracefully for individual countries", async () => {
      // First call fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Server error",
      });

      const client = new IMFClient();
      const observations = await client.getIndicatorObservations(
        "NGDP_RPCH",
        ["XX"],
        "2024",
        "2024"
      );

      // Should return empty array on error
      expect(observations).toHaveLength(0);
    });

    it("should sort observations by date then country", async () => {
      // Mock two country requests
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            CompactData: {
              DataSet: {
                Series: {
                  "@REF_AREA": "US",
                  Obs: [
                    { "@TIME_PERIOD": "2024", "@OBS_VALUE": "2.8" },
                    { "@TIME_PERIOD": "2023", "@OBS_VALUE": "2.5" },
                  ],
                },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            CompactData: {
              DataSet: {
                Series: {
                  "@REF_AREA": "GB",
                  Obs: [
                    { "@TIME_PERIOD": "2024", "@OBS_VALUE": "0.1" },
                    { "@TIME_PERIOD": "2023", "@OBS_VALUE": "0.5" },
                  ],
                },
              },
            },
          }),
        });

      const client = new IMFClient();
      const observations = await client.getIndicatorObservations(
        "NGDP_RPCH",
        ["US", "GB"],
        "2023",
        "2024"
      );

      // Should be sorted by date first, then by country
      expect(observations[0].period).toBe("2023");
      expect(observations[1].period).toBe("2023");
      expect(observations[2].period).toBe("2024");
      expect(observations[3].period).toBe("2024");
    });
  });

  describe("getSingleCountryObservations", () => {
    it("should be a convenience wrapper", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          CompactData: {
            DataSet: {
              Series: {
                "@REF_AREA": "DE",
                Obs: { "@TIME_PERIOD": "2024", "@OBS_VALUE": "0.2" },
              },
            },
          },
        }),
      });

      const client = new IMFClient();
      const observations = await client.getSingleCountryObservations(
        "NGDP_RPCH",
        "DE",
        "2024"
      );

      expect(observations).toHaveLength(1);
      expect(observations[0].countryCode).toBe("DE");
    });
  });
});

describe("IMF_INDICATOR_CONFIG", () => {
  it("should have all required indicator properties", () => {
    for (const [_id, config] of Object.entries(IMF_INDICATOR_CONFIG)) {
      expect(config).toHaveProperty("name");
      expect(config).toHaveProperty("category");
      expect(config).toHaveProperty("frequency");
      expect(typeof config.name).toBe("string");
      expect(typeof config.category).toBe("string");
      expect(config.frequency).toBe("Annual");
    }
  });

  it("should have key economic indicators", () => {
    expect(IMF_INDICATOR_CONFIG).toHaveProperty("NGDP_RPCH");
    expect(IMF_INDICATOR_CONFIG).toHaveProperty("PCPIPCH");
    expect(IMF_INDICATOR_CONFIG).toHaveProperty("LUR");
    expect(IMF_INDICATOR_CONFIG).toHaveProperty("BCA_NGDPD");
    expect(IMF_INDICATOR_CONFIG).toHaveProperty("GGXWDG_NGDP");
  });
});

describe("IMF_COUNTRIES", () => {
  it("should have G7 countries", () => {
    expect(IMF_COUNTRIES).toHaveProperty("US");
    expect(IMF_COUNTRIES).toHaveProperty("GB");
    expect(IMF_COUNTRIES).toHaveProperty("DE");
    expect(IMF_COUNTRIES).toHaveProperty("JP");
    expect(IMF_COUNTRIES).toHaveProperty("FR");
    expect(IMF_COUNTRIES).toHaveProperty("IT");
    expect(IMF_COUNTRIES).toHaveProperty("CA");
  });

  it("should have major emerging markets", () => {
    expect(IMF_COUNTRIES).toHaveProperty("CN");
    expect(IMF_COUNTRIES).toHaveProperty("IN");
    expect(IMF_COUNTRIES).toHaveProperty("BR");
  });
});

describe("IMFApiError", () => {
  it("should have correct name and properties", () => {
    const error = new IMFApiError("Test error", 404, "NGDP_RPCH");
    expect(error.name).toBe("IMFApiError");
    expect(error.message).toBe("Test error");
    expect(error.statusCode).toBe(404);
    expect(error.indicatorId).toBe("NGDP_RPCH");
  });
});
