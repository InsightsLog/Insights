import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("FRED_SERIES_MAP", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules before each test to ensure fresh env parsing
    vi.resetModules();
    // Create a fresh copy of process.env for each test
    process.env = { ...originalEnv };
    // Set required env vars for the module to load
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
  });

  afterEach(() => {
    // Restore original env after each test
    process.env = originalEnv;
  });

  it("contains standard economic indicators", async () => {
    const { FRED_SERIES_MAP } = await import("./fred");
    expect(FRED_SERIES_MAP["CPIAUCSL"]).toBe("CPI");
    expect(FRED_SERIES_MAP["UNRATE"]).toBe("Unemployment Rate");
    expect(FRED_SERIES_MAP["GDP"]).toBe("GDP");
  });

  it("maps series IDs to indicator names", async () => {
    const { FRED_SERIES_MAP } = await import("./fred");
    const seriesIds = Object.keys(FRED_SERIES_MAP);
    expect(seriesIds.length).toBeGreaterThan(0);
    seriesIds.forEach((id) => {
      expect(typeof FRED_SERIES_MAP[id]).toBe("string");
      expect(FRED_SERIES_MAP[id].length).toBeGreaterThan(0);
    });
  });
});

describe("fetchFredSeries", () => {
  const mockApiKey = "test-api-key-12345";
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules before each test to ensure fresh env parsing
    vi.resetModules();
    // Create a fresh copy of process.env for each test
    process.env = { ...originalEnv };
    // Set required env vars for the module to load
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
  });

  afterEach(() => {
    // Restore original env after each test
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("throws error when FRED_API_KEY is not configured", async () => {
    delete process.env.FRED_API_KEY;

    const { fetchFredSeries } = await import("./fred");

    await expect(fetchFredSeries("CPIAUCSL")).rejects.toThrow(
      "FRED_API_KEY is not configured"
    );
  });

  it("fetches series data successfully", async () => {
    process.env.FRED_API_KEY = mockApiKey;

    const { fetchFredSeries } = await import("./fred");

    const mockResponse = {
      realtime_start: "2026-02-19",
      realtime_end: "2026-02-19",
      observation_start: "1776-07-04",
      observation_end: "9999-12-31",
      units: "Index 1982-1984=100",
      output_type: 1,
      file_type: "json",
      order_by: "observation_date",
      sort_order: "desc",
      count: 1,
      offset: 0,
      limit: 1,
      observations: [
        {
          realtime_start: "2026-02-19",
          realtime_end: "2026-02-19",
          date: "2026-01-01",
          value: "314.159",
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await fetchFredSeries("CPIAUCSL");

    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].value).toBe("314.159");
    expect(result.observations[0].date).toBe("2026-01-01");
  });

  it("includes default parameters in request", async () => {
    process.env.FRED_API_KEY = mockApiKey;

    const { fetchFredSeries } = await import("./fred");

    const mockResponse = {
      realtime_start: "2026-02-19",
      realtime_end: "2026-02-19",
      observation_start: "1776-07-04",
      observation_end: "9999-12-31",
      units: "Index",
      output_type: 1,
      file_type: "json",
      order_by: "observation_date",
      sort_order: "desc",
      count: 1,
      offset: 0,
      limit: 1,
      observations: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    await fetchFredSeries("CPIAUCSL");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("series_id=CPIAUCSL")
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api_key=test-api-key-12345")
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("file_type=json")
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("sort_order=desc")
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("limit=1")
    );
  });

  it("includes custom parameters in request", async () => {
    process.env.FRED_API_KEY = mockApiKey;

    const { fetchFredSeries } = await import("./fred");

    const mockResponse = {
      realtime_start: "2026-02-19",
      realtime_end: "2026-02-19",
      observation_start: "2025-01-01",
      observation_end: "2025-12-31",
      units: "Index",
      output_type: 1,
      file_type: "json",
      order_by: "observation_date",
      sort_order: "asc",
      count: 10,
      offset: 0,
      limit: 10,
      observations: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    await fetchFredSeries("CPIAUCSL", {
      limit: 10,
      sort_order: "asc",
      observation_start: "2025-01-01",
      observation_end: "2025-12-31",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("limit=10")
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("sort_order=asc")
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("observation_start=2025-01-01")
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("observation_end=2025-12-31")
    );
  });

  it("handles 429 rate limit with exponential backoff", async () => {
    process.env.FRED_API_KEY = mockApiKey;

    const { fetchFredSeries } = await import("./fred");

    const mockSuccessResponse = {
      realtime_start: "2026-02-19",
      realtime_end: "2026-02-19",
      observation_start: "1776-07-04",
      observation_end: "9999-12-31",
      units: "Index",
      output_type: 1,
      file_type: "json",
      order_by: "observation_date",
      sort_order: "desc",
      count: 1,
      offset: 0,
      limit: 1,
      observations: [
        {
          realtime_start: "2026-02-19",
          realtime_end: "2026-02-19",
          date: "2026-01-01",
          value: "100.0",
        },
      ],
    };

    // First two calls return 429, third succeeds
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "Rate limit exceeded",
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "Rate limit exceeded",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      });

    const startTime = Date.now();
    const result = await fetchFredSeries("UNRATE");
    const endTime = Date.now();

    expect(result.observations[0].value).toBe("100.0");
    expect(global.fetch).toHaveBeenCalledTimes(3);

    // Should have waited approximately 1s + 2s = 3s
    // Allow some slack for test execution time
    const elapsedTime = endTime - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(2900); // 3s - 100ms slack
  });

  it("throws error after max retries for 429", async () => {
    process.env.FRED_API_KEY = mockApiKey;

    const { fetchFredSeries } = await import("./fred");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "Rate limit exceeded",
    });

    await expect(fetchFredSeries("CPIAUCSL")).rejects.toThrow(
      "FRED API rate limit exceeded after 3 retries"
    );
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("throws error for non-429 HTTP errors", async () => {
    process.env.FRED_API_KEY = mockApiKey;

    const { fetchFredSeries } = await import("./fred");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "Series not found",
    });

    await expect(fetchFredSeries("INVALID")).rejects.toThrow(
      "FRED API request failed: Not Found"
    );
  });

  it("throws error for network failures", async () => {
    process.env.FRED_API_KEY = mockApiKey;

    const { fetchFredSeries } = await import("./fred");

    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await expect(fetchFredSeries("CPIAUCSL")).rejects.toThrow(
      "Failed to fetch FRED series CPIAUCSL: Network error"
    );
  });

  it("throws error for invalid response data", async () => {
    process.env.FRED_API_KEY = mockApiKey;

    const { fetchFredSeries } = await import("./fred");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        // Missing required fields
        observations: "not an array",
      }),
    });

    await expect(fetchFredSeries("CPIAUCSL")).rejects.toThrow();
  });

  it("includes series ID in error messages", async () => {
    process.env.FRED_API_KEY = mockApiKey;

    const { fetchFredSeries, FredApiError } = await import("./fred");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Server error",
    });

    try {
      await fetchFredSeries("TESTID");
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(FredApiError);
      expect((error as FredApiError).seriesId).toBe("TESTID");
    }
  });

  it("validates response schema strictly", async () => {
    process.env.FRED_API_KEY = mockApiKey;

    const { fetchFredSeries } = await import("./fred");

    const mockResponse = {
      realtime_start: "2026-02-19",
      realtime_end: "2026-02-19",
      observation_start: "1776-07-04",
      observation_end: "9999-12-31",
      units: "Index",
      output_type: 1,
      file_type: "json",
      order_by: "observation_date",
      sort_order: "desc",
      count: 1,
      offset: 0,
      limit: 1,
      observations: [
        {
          realtime_start: "2026-02-19",
          realtime_end: "2026-02-19",
          date: "2026-01-01",
          value: "314.159",
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await fetchFredSeries("CPIAUCSL");

    // Verify all required fields are present and typed correctly
    expect(result.realtime_start).toBe("2026-02-19");
    expect(result.realtime_end).toBe("2026-02-19");
    expect(result.observation_start).toBe("1776-07-04");
    expect(result.observation_end).toBe("9999-12-31");
    expect(result.units).toBe("Index");
    expect(result.output_type).toBe(1);
    expect(result.file_type).toBe("json");
    expect(result.order_by).toBe("observation_date");
    expect(result.sort_order).toBe("desc");
    expect(result.count).toBe(1);
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(1);
    expect(Array.isArray(result.observations)).toBe(true);
  });

  it("retries only on 429 errors, not other errors", async () => {
    process.env.FRED_API_KEY = mockApiKey;

    const { fetchFredSeries } = await import("./fred");

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Server error",
    });

    await expect(fetchFredSeries("CPIAUCSL")).rejects.toThrow();
    // Should not retry on 500 errors
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
