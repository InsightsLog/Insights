/**
 * ECB Import Tests
 *
 * Unit tests for the ECB historical data import functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { importECBHistoricalData } from "./ecb-import";

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

describe("importECBHistoricalData", () => {
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
    // Mock ECB API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        dataSets: [
          {
            series: {
              "0:0:0": {
                observations: {
                  "0": [2.4],
                },
              },
            },
          },
        ],
        structure: {
          name: "HICP - All items",
          dimensions: {
            series: [{ id: "FREQ", values: [{ id: "M", name: "Monthly" }] }],
            observation: [
              {
                id: "TIME_PERIOD",
                values: [{ id: "2024-01", name: "2024-01" }],
              },
            ],
          },
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

    const result = await importECBHistoricalData({
      seriesIds: ["ICP.M.U2.N.000000.4.ANR"],
    });

    expect(result).toHaveProperty("totalSeries");
    expect(result).toHaveProperty("successfulSeries");
    expect(result).toHaveProperty("failedSeries");
    expect(result).toHaveProperty("seriesResults");
    expect(result).toHaveProperty("errors");
  });

  it("should track series results", async () => {
    // Mock ECB API responses for two series
    mockFetch
      // First series
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dataSets: [
            {
              series: {
                "0:0:0": {
                  observations: { "0": [2.4] },
                },
              },
            },
          ],
          structure: {
            name: "HICP",
            dimensions: {
              series: [{ id: "FREQ", values: [{ id: "M", name: "Monthly" }] }],
              observation: [
                {
                  id: "TIME_PERIOD",
                  values: [{ id: "2024-01", name: "2024-01" }],
                },
              ],
            },
          },
        }),
      })
      // Second series
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dataSets: [
            {
              series: {
                "0:0:0": {
                  observations: { "0": [4.5], "1": [4.25] },
                },
              },
            },
          ],
          structure: {
            name: "ECB Main Rate",
            dimensions: {
              series: [{ id: "FREQ", values: [{ id: "D", name: "Daily" }] }],
              observation: [
                {
                  id: "TIME_PERIOD",
                  values: [
                    { id: "2024-01", name: "2024-01" },
                    { id: "2024-02", name: "2024-02" },
                  ],
                },
              ],
            },
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

    const result = await importECBHistoricalData({
      seriesIds: ["ICP.M.U2.N.000000.4.ANR", "FM.D.U2.EUR.4F.KR.MRR_FR.LEV"],
    });

    expect(result.totalSeries).toBe(2);
    expect(result.seriesResults).toHaveLength(2);
  });

  it("should handle ECB API errors gracefully", async () => {
    // Mock ECB API failure
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

    const result = await importECBHistoricalData({
      seriesIds: ["ICP.M.U2.N.000000.4.ANR"],
    });

    expect(result.failedSeries).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should use default start period", async () => {
    // Mock ECB API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        dataSets: [
          {
            series: {
              "0:0:0": { observations: {} },
            },
          },
        ],
        structure: {
          dimensions: {
            series: [{ id: "FREQ", values: [{ id: "M", name: "Monthly" }] }],
            observation: [{ id: "TIME_PERIOD", values: [] }],
          },
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

    await importECBHistoricalData({
      seriesIds: ["ICP.M.U2.N.000000.4.ANR"],
    });

    // Should use default 2014-01 start period
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("startPeriod=2014-01"),
      expect.anything()
    );
  });

  it("should use custom start period when provided", async () => {
    // Mock ECB API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        dataSets: [
          {
            series: {
              "0:0:0": { observations: {} },
            },
          },
        ],
        structure: {
          dimensions: {
            series: [{ id: "FREQ", values: [{ id: "M", name: "Monthly" }] }],
            observation: [{ id: "TIME_PERIOD", values: [] }],
          },
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

    await importECBHistoricalData({
      seriesIds: ["ICP.M.U2.N.000000.4.ANR"],
      startPeriod: "2020-01",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("startPeriod=2020-01"),
      expect.anything()
    );
  });

  it("should handle 404 as no data available", async () => {
    // Mock ECB API returning 404 (no data)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "No data found",
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

    const result = await importECBHistoricalData({
      seriesIds: ["ICP.M.U2.N.000000.4.ANR"],
    });

    // 404 means no data, not a failure
    expect(result.successfulSeries).toBe(1);
    expect(result.failedSeries).toBe(0);
    expect(result.seriesResults[0].observationsCount).toBe(0);
  });
});
