/**
 * FRED Import Tests
 *
 * Unit tests for the FRED historical data import functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { importFredHistoricalData } from "./fred-import";

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
  getFredApiKey: vi.fn(() => "test-api-key"),
}));

describe("importFredHistoricalData", () => {
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
    // Mock FRED API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seriess: [
            { id: "GDPC1", title: "Real GDP", frequency: "Quarterly", units: "Billions" },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          observations: [
            { date: "2024-01-01", value: "1000.5" },
          ],
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

    const result = await importFredHistoricalData({
      seriesIds: ["GDPC1"],
      apiKey: "test-key",
    });

    expect(result).toHaveProperty("totalSeries");
    expect(result).toHaveProperty("successfulSeries");
    expect(result).toHaveProperty("failedSeries");
    expect(result).toHaveProperty("seriesResults");
    expect(result).toHaveProperty("errors");
  });

  it("should track series results", async () => {
    // Mock FRED API responses for two series
    mockFetch
      // First series info
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seriess: [
            { id: "GDPC1", title: "Real GDP", frequency: "Quarterly", units: "Billions" },
          ],
        }),
      })
      // First series observations
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          observations: [{ date: "2024-01-01", value: "100" }],
        }),
      })
      // Second series info
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seriess: [
            { id: "UNRATE", title: "Unemployment Rate", frequency: "Monthly", units: "Percent" },
          ],
        }),
      })
      // Second series observations
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          observations: [
            { date: "2024-01-01", value: "3.5" },
            { date: "2024-02-01", value: "3.6" },
          ],
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

    const result = await importFredHistoricalData({
      seriesIds: ["GDPC1", "UNRATE"],
      apiKey: "test-key",
    });

    expect(result.totalSeries).toBe(2);
    expect(result.seriesResults).toHaveLength(2);
  });

  it("should handle FRED API errors gracefully", async () => {
    // Mock FRED API failure
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

    const result = await importFredHistoricalData({
      seriesIds: ["GDPC1"],
      apiKey: "test-key",
    });

    expect(result.failedSeries).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should use default start date", async () => {
    // Mock FRED API
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seriess: [{ id: "GDP", title: "GDP", frequency: "Q", units: "$" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ observations: [] }),
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

    await importFredHistoricalData({
      seriesIds: ["GDPC1"],
      apiKey: "test-key",
    });

    // Should use default 2014-01-01 start date
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("observation_start=2014-01-01")
    );
  });

  it("should use custom start date when provided", async () => {
    // Mock FRED API
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          seriess: [{ id: "GDP", title: "GDP", frequency: "Q", units: "$" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ observations: [] }),
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

    await importFredHistoricalData({
      seriesIds: ["GDPC1"],
      startDate: "2020-01-01",
      apiKey: "test-key",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("observation_start=2020-01-01")
    );
  });
});
