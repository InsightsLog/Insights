/**
 * World Bank Import Tests
 *
 * Unit tests for the World Bank historical data import functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { importWorldBankHistoricalData } from "./world-bank-import";

// Mock the dependencies
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  })),
}));

describe("importWorldBankHistoricalData", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  const originalEnv = process.env;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Set required env vars
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    };

    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should return import result structure", async () => {
    // Mock World Bank API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { page: 1, pages: 1, per_page: "1000", total: 1 },
        [
          {
            indicator: { id: "NY.GDP.MKTP.CD", value: "GDP (current US$)" },
            country: { id: "US", value: "United States" },
            date: "2023",
            value: 25462700000000,
          },
        ],
      ],
    });

    // Mock Supabase client
    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "indicator-1" },
              error: null,
            }),
          };
        }
        if (table === "releases") {
          return {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {};
      }),
    } as ReturnType<typeof createClient>);

    const result = await importWorldBankHistoricalData({
      indicatorIds: ["NY.GDP.MKTP.CD"],
      countryCodes: ["US"],
    });

    expect(result).toHaveProperty("totalIndicators");
    expect(result).toHaveProperty("totalCountries");
    expect(result).toHaveProperty("successfulImports");
    expect(result).toHaveProperty("failedImports");
    expect(result).toHaveProperty("importResults");
    expect(result).toHaveProperty("errors");
  });

  it("should track import results for multiple indicators", async () => {
    // Mock World Bank API responses for two indicators
    mockFetch
      // First indicator
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 1, pages: 1, per_page: "1000", total: 2 },
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
          ],
        ],
      })
      // Second indicator
      .mockResolvedValueOnce({
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
              country: { id: "GB", value: "United Kingdom" },
              date: "2023",
              value: 4.0,
            },
          ],
        ],
      });

    // Mock Supabase
    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "indicator-1" },
              error: null,
            }),
          };
        }
        if (table === "releases") {
          return {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {};
      }),
    } as ReturnType<typeof createClient>);

    const result = await importWorldBankHistoricalData({
      indicatorIds: ["NY.GDP.MKTP.CD", "SL.UEM.TOTL.ZS"],
      countryCodes: ["US", "GB"],
    });

    expect(result.totalIndicators).toBe(2);
    expect(result.totalCountries).toBe(2);
    // 2 indicators × 2 countries = 4 import results
    expect(result.importResults).toHaveLength(4);
  });

  it("should handle World Bank API errors gracefully", async () => {
    // Mock World Bank API failure
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Server error",
    });

    // Mock Supabase
    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn(() => ({})),
    } as ReturnType<typeof createClient>);

    const result = await importWorldBankHistoricalData({
      indicatorIds: ["NY.GDP.MKTP.CD"],
      countryCodes: ["US"],
    });

    expect(result.failedImports).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should use default start year", async () => {
    // Mock World Bank API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { page: 1, pages: 1, per_page: "1000", total: 0 },
        [],
      ],
    });

    // Mock Supabase
    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "indicator-1" },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    } as ReturnType<typeof createClient>);

    await importWorldBankHistoricalData({
      indicatorIds: ["NY.GDP.MKTP.CD"],
      countryCodes: ["US"],
    });

    // Should use default 2014 start year
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("date=2014"),
      expect.anything()
    );
  });

  it("should use custom start year when provided", async () => {
    // Mock World Bank API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { page: 1, pages: 1, per_page: "1000", total: 0 },
        [],
      ],
    });

    // Mock Supabase
    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "indicator-1" },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    } as ReturnType<typeof createClient>);

    await importWorldBankHistoricalData({
      indicatorIds: ["NY.GDP.MKTP.CD"],
      countryCodes: ["US"],
      startYear: "2020",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("date=2020"),
      expect.anything()
    );
  });

  it("should handle countries with no data gracefully", async () => {
    // Mock World Bank API returning data for only some countries
    mockFetch.mockResolvedValueOnce({
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
          // No data for "ZZ" country
        ],
      ],
    });

    // Mock Supabase
    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "indicator-1" },
              error: null,
            }),
          };
        }
        if (table === "releases") {
          return {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {};
      }),
    } as ReturnType<typeof createClient>);

    const result = await importWorldBankHistoricalData({
      indicatorIds: ["NY.GDP.MKTP.CD"],
      countryCodes: ["US", "ZZ"], // ZZ is not a real country
    });

    // Should have results for both countries, but ZZ has 0 observations
    expect(result.importResults).toHaveLength(2);
    const zzResult = result.importResults.find((r) => r.countryCode === "ZZ");
    expect(zzResult?.observationsCount).toBe(0);
    expect(zzResult?.error).toBeUndefined(); // Not an error, just no data
  });

  it("should create indicators with country-specific names", async () => {
    // Mock World Bank API
    mockFetch.mockResolvedValueOnce({
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

    // Track indicator insert calls
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: "new-indicator-id" },
      error: null,
    });

    // Mock Supabase
    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({
              data: null,
              error: { code: "PGRST116", message: "no rows returned" },
            }).mockResolvedValue({
              data: { id: "new-indicator-id" },
              error: null,
            }),
            insert: mockInsert,
          };
        }
        if (table === "releases") {
          return {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {};
      }),
    } as ReturnType<typeof createClient>);

    // Manually chain the mock
    mockInsert.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      single: mockSingle,
    });

    await importWorldBankHistoricalData({
      indicatorIds: ["NY.GDP.MKTP.CD"],
      countryCodes: ["US"],
    });

    // Verify that the indicator was created with country-specific name
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringContaining("United States"),
        country_code: "US",
        source_name: "World Bank Open Data",
      })
    );
  });
});
