/**
 * World Bank API Client Tests
 *
 * Unit tests for the World Bank API client functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WorldBankClient,
  WorldBankApiError,
  WORLD_BANK_INDICATOR_CONFIG,
  WORLD_BANK_COUNTRIES,
} from "./world-bank-client";

describe("WorldBankClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create client without API key (World Bank is free)", () => {
      const client = new WorldBankClient();
      expect(client).toBeDefined();
    });
  });

  describe("getIndicatorInfo", () => {
    it("should return indicator metadata", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 1, pages: 1, per_page: "50", total: 1 },
          [
            {
              id: "NY.GDP.MKTP.CD",
              name: "GDP (current US$)",
              sourceNote: "GDP at purchaser prices...",
              sourceOrganization: "World Bank national accounts data",
            },
          ],
        ],
      });

      const client = new WorldBankClient();
      const info = await client.getIndicatorInfo("NY.GDP.MKTP.CD");

      expect(info.id).toBe("NY.GDP.MKTP.CD");
      expect(info.name).toBe("GDP (current US$)");
      expect(info.sourceNote).toBeDefined();
    });

    it("should throw error for non-existent indicator", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: [{ id: "120", value: "Invalid value" }],
        }),
      });

      const client = new WorldBankClient();

      await expect(
        client.getIndicatorInfo("INVALID.INDICATOR")
      ).rejects.toThrow(WorldBankApiError);
    });

    it("should handle empty response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 1, pages: 0, per_page: "50", total: 0 },
          [],
        ],
      });

      const client = new WorldBankClient();

      await expect(
        client.getIndicatorInfo("EMPTY.INDICATOR")
      ).rejects.toThrow("No data found");
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Server error",
      });

      const client = new WorldBankClient();

      await expect(
        client.getIndicatorInfo("NY.GDP.MKTP.CD")
      ).rejects.toThrow(WorldBankApiError);
    });
  });

  describe("getIndicatorObservations", () => {
    it("should return observations for multiple countries", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 1, pages: 1, per_page: "1000", total: 4 },
          [
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP (current US$)" },
              country: { id: "US", value: "United States" },
              date: "2023",
              value: 25462700000000,
            },
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP (current US$)" },
              country: { id: "US", value: "United States" },
              date: "2022",
              value: 25035164000000,
            },
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP (current US$)" },
              country: { id: "GB", value: "United Kingdom" },
              date: "2023",
              value: 3332059000000,
            },
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP (current US$)" },
              country: { id: "GB", value: "United Kingdom" },
              date: "2022",
              value: 3070668000000,
            },
          ],
        ],
      });

      const client = new WorldBankClient();
      const observations = await client.getIndicatorObservations(
        "NY.GDP.MKTP.CD",
        ["US", "GB"],
        "2022",
        "2023"
      );

      expect(observations).toHaveLength(4);
      expect(observations[0].countryCode).toBe("GB");
      expect(observations[0].period).toBe("2022");
      expect(observations[0].date).toBe("2022-01-01");
    });

    it("should skip null values", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 1, pages: 1, per_page: "1000", total: 3 },
          [
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
              country: { id: "US", value: "United States" },
              date: "2023",
              value: 25462700000000,
            },
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
              country: { id: "US", value: "United States" },
              date: "2022",
              value: null, // Missing data
            },
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
              country: { id: "US", value: "United States" },
              date: "2021",
              value: 23315081000000,
            },
          ],
        ],
      });

      const client = new WorldBankClient();
      const observations = await client.getIndicatorObservations(
        "NY.GDP.MKTP.CD",
        ["US"],
        "2021",
        "2023"
      );

      expect(observations).toHaveLength(2);
      expect(observations.find((o) => o.period === "2022")).toBeUndefined();
    });

    it("should handle pagination", async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 1, pages: 2, per_page: "1000", total: 1500 },
          Array(1000).fill({
            indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
            country: { id: "US", value: "United States" },
            date: "2023",
            value: 25462700000000,
          }),
        ],
      });

      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 2, pages: 2, per_page: "1000", total: 1500 },
          Array(500).fill({
            indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
            country: { id: "GB", value: "United Kingdom" },
            date: "2023",
            value: 3332059000000,
          }),
        ],
      });

      const client = new WorldBankClient();
      const observations = await client.getIndicatorObservations(
        "NY.GDP.MKTP.CD",
        ["US", "GB"],
        "2023",
        "2023"
      );

      expect(observations).toHaveLength(1500);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle empty response gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 1, pages: 0, per_page: "1000", total: 0 },
          null,
        ],
      });

      const client = new WorldBankClient();
      const observations = await client.getIndicatorObservations(
        "NY.GDP.MKTP.CD",
        ["ZZ"], // Non-existent country
        "2023",
        "2023"
      );

      expect(observations).toHaveLength(0);
    });

    it("should handle error response gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: [{ id: "120", value: "Invalid value" }],
        }),
      });

      const client = new WorldBankClient();
      const observations = await client.getIndicatorObservations(
        "NY.GDP.MKTP.CD",
        ["INVALID"],
        "2023",
        "2023"
      );

      expect(observations).toHaveLength(0);
    });

    it("should sort observations by date and country", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 1, pages: 1, per_page: "1000", total: 4 },
          [
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
              country: { id: "US", value: "United States" },
              date: "2023",
              value: 25462700000000,
            },
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
              country: { id: "GB", value: "United Kingdom" },
              date: "2023",
              value: 3332059000000,
            },
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
              country: { id: "US", value: "United States" },
              date: "2022",
              value: 25035164000000,
            },
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
              country: { id: "GB", value: "United Kingdom" },
              date: "2022",
              value: 3070668000000,
            },
          ],
        ],
      });

      const client = new WorldBankClient();
      const observations = await client.getIndicatorObservations(
        "NY.GDP.MKTP.CD",
        ["US", "GB"],
        "2022",
        "2023"
      );

      // Should be sorted by date first, then country
      expect(observations[0].period).toBe("2022");
      expect(observations[0].countryCode).toBe("GB");
      expect(observations[1].period).toBe("2022");
      expect(observations[1].countryCode).toBe("US");
      expect(observations[2].period).toBe("2023");
      expect(observations[2].countryCode).toBe("GB");
      expect(observations[3].period).toBe("2023");
      expect(observations[3].countryCode).toBe("US");
    });
  });

  describe("getSingleCountryObservations", () => {
    it("should return observations for a single country", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 1, pages: 1, per_page: "1000", total: 2 },
          [
            {
              indicator: { id: "SL.UEM.TOTL.ZS", value: "Unemployment" },
              country: { id: "US", value: "United States" },
              date: "2023",
              value: 3.6,
            },
            {
              indicator: { id: "SL.UEM.TOTL.ZS", value: "Unemployment" },
              country: { id: "US", value: "United States" },
              date: "2022",
              value: 3.7,
            },
          ],
        ],
      });

      const client = new WorldBankClient();
      const observations = await client.getSingleCountryObservations(
        "SL.UEM.TOTL.ZS",
        "US",
        "2022",
        "2023"
      );

      expect(observations).toHaveLength(2);
      expect(observations.every((o) => o.countryCode === "US")).toBe(true);
    });
  });

  describe("rate limiting", () => {
    it("should throttle requests", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          { page: 1, pages: 1, per_page: "1000", total: 1 },
          [
            {
              indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
              country: { id: "US", value: "United States" },
              date: "2023",
              value: 25462700000000,
            },
          ],
        ],
      });

      const client = new WorldBankClient();
      const startTime = Date.now();

      // Make 3 requests
      await client.getSingleCountryObservations("NY.GDP.MKTP.CD", "US", "2023", "2023");
      await client.getSingleCountryObservations("NY.GDP.MKTP.CD", "GB", "2023", "2023");
      await client.getSingleCountryObservations("NY.GDP.MKTP.CD", "JP", "2023", "2023");

      const elapsedTime = Date.now() - startTime;

      // Should take at least 1000ms (2 * 500ms throttle delay)
      expect(elapsedTime).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("API URL construction", () => {
    it("should construct correct URL with parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 1, pages: 1, per_page: "1000", total: 0 },
          [],
        ],
      });

      const client = new WorldBankClient();
      await client.getIndicatorObservations(
        "NY.GDP.MKTP.CD",
        ["US", "GB"],
        "2020",
        "2023"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("country/US;GB/indicator/NY.GDP.MKTP.CD"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("date=2020%3A2023"), // URL encoded "2020:2023"
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("format=json"),
        expect.anything()
      );
    });
  });
});

describe("WORLD_BANK_INDICATOR_CONFIG", () => {
  it("should have required properties for each indicator", () => {
    for (const [id, config] of Object.entries(WORLD_BANK_INDICATOR_CONFIG)) {
      expect(config.name).toBeDefined();
      expect(config.category).toBeDefined();
      expect(config.frequency).toBeDefined();
      expect(typeof id).toBe("string");
    }
  });

  it("should include key economic indicators", () => {
    expect(WORLD_BANK_INDICATOR_CONFIG["NY.GDP.MKTP.CD"]).toBeDefined();
    expect(WORLD_BANK_INDICATOR_CONFIG["FP.CPI.TOTL.ZG"]).toBeDefined();
    expect(WORLD_BANK_INDICATOR_CONFIG["SL.UEM.TOTL.ZS"]).toBeDefined();
  });
});

describe("WORLD_BANK_COUNTRIES", () => {
  it("should have country names for each code", () => {
    for (const [code, name] of Object.entries(WORLD_BANK_COUNTRIES)) {
      expect(code).toHaveLength(2); // ISO2 codes
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it("should include G7 countries", () => {
    expect(WORLD_BANK_COUNTRIES["US"]).toBe("United States");
    expect(WORLD_BANK_COUNTRIES["GB"]).toBe("United Kingdom");
    expect(WORLD_BANK_COUNTRIES["DE"]).toBe("Germany");
    expect(WORLD_BANK_COUNTRIES["JP"]).toBe("Japan");
    expect(WORLD_BANK_COUNTRIES["FR"]).toBe("France");
    expect(WORLD_BANK_COUNTRIES["IT"]).toBe("Italy");
    expect(WORLD_BANK_COUNTRIES["CA"]).toBe("Canada");
  });

  it("should include major emerging markets", () => {
    expect(WORLD_BANK_COUNTRIES["CN"]).toBe("China");
    expect(WORLD_BANK_COUNTRIES["IN"]).toBe("India");
    expect(WORLD_BANK_COUNTRIES["BR"]).toBe("Brazil");
  });
});
