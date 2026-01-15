/**
 * BLS Import Tests
 *
 * Unit tests for the BLS historical data import functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { importBLSHistoricalData } from "./bls-import";

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

vi.mock("@/lib/env", () => ({
  getBLSApiKey: vi.fn(() => "test-api-key"),
}));

describe("importBLSHistoricalData", () => {
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
    // Mock BLS API responses
    mockFetch
      // First request: getSeriesInfo
      .mockResolvedValueOnce({
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
                },
                data: [],
              },
            ],
          },
        }),
      })
      // Second request: getSeriesObservations
      .mockResolvedValueOnce({
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

    const result = await importBLSHistoricalData({
      seriesIds: ["LNS14000000"],
      apiKey: "test-key",
    });

    expect(result).toHaveProperty("totalSeries");
    expect(result).toHaveProperty("successfulSeries");
    expect(result).toHaveProperty("failedSeries");
    expect(result).toHaveProperty("seriesResults");
    expect(result).toHaveProperty("errors");
  });

  it("should track series results", async () => {
    // Mock BLS API responses for two series
    mockFetch
      // First series info
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [
              {
                seriesID: "LNS14000000",
                catalog: { series_title: "Unemployment Rate" },
                data: [],
              },
            ],
          },
        }),
      })
      // First series observations
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [
              {
                seriesID: "LNS14000000",
                data: [{ year: "2024", period: "M01", periodName: "January", value: "3.7" }],
              },
            ],
          },
        }),
      })
      // Second series info
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [
              {
                seriesID: "CUUR0000SA0",
                catalog: { series_title: "CPI All Items" },
                data: [],
              },
            ],
          },
        }),
      })
      // Second series observations
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [
              {
                seriesID: "CUUR0000SA0",
                data: [
                  { year: "2024", period: "M01", periodName: "January", value: "308.5" },
                  { year: "2024", period: "M02", periodName: "February", value: "310.1" },
                ],
              },
            ],
          },
        }),
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

    const result = await importBLSHistoricalData({
      seriesIds: ["LNS14000000", "CUUR0000SA0"],
      apiKey: "test-key",
    });

    expect(result.totalSeries).toBe(2);
    expect(result.seriesResults).toHaveLength(2);
  });

  it("should handle BLS API errors gracefully", async () => {
    // Mock BLS API failure
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

    const result = await importBLSHistoricalData({
      seriesIds: ["LNS14000000"],
      apiKey: "test-key",
    });

    expect(result.failedSeries).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should use default start year", async () => {
    // Mock BLS API
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [{ seriesID: "LNS14000000", catalog: { series_title: "Test" }, data: [] }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [{ seriesID: "LNS14000000", data: [] }],
          },
        }),
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

    await importBLSHistoricalData({
      seriesIds: ["LNS14000000"],
      apiKey: "test-key",
    });

    // Should use default 2014 start year
    const calledBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(calledBody.startyear).toBe("2014");
  });

  it("should use custom start year when provided", async () => {
    // Mock BLS API
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [{ seriesID: "LNS14000000", catalog: { series_title: "Test" }, data: [] }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "REQUEST_SUCCEEDED",
          message: [],
          Results: {
            series: [{ seriesID: "LNS14000000", data: [] }],
          },
        }),
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

    await importBLSHistoricalData({
      seriesIds: ["LNS14000000"],
      startYear: "2020",
      apiKey: "test-key",
    });

    const calledBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(calledBody.startyear).toBe("2020");
  });

  it("should handle BLS API request failure status", async () => {
    // Mock BLS API returning failure status
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "REQUEST_FAILED",
        message: ["Invalid series ID"],
        Results: null,
      }),
    });

    // Mock Supabase
    const { createClient } = await import("@supabase/supabase-js");
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn(() => ({})),
    } as ReturnType<typeof createClient>);

    const result = await importBLSHistoricalData({
      // Cast to any to test handling of invalid series
      seriesIds: ["INVALID_SERIES"] as unknown as typeof result.seriesResults[0]["seriesId"][],
      apiKey: "test-key",
    });

    expect(result.failedSeries).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("INVALID_SERIES");
  });
});
