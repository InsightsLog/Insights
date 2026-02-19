/**
 * Tests for FRED API integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchLatestFredValue } from "./fred";

describe("FRED API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch latest value successfully", async () => {
    const mockResponse = {
      observations: [
        {
          date: "2024-01-01",
          value: "306.746",
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchLatestFredValue("CPIAUCSL", "test-api-key");

    expect(result).toEqual({
      value: "306.746",
      date: "2024-01-01",
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.stlouisfed.org/fred/series/observations")
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("series_id=CPIAUCSL")
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("api_key=test-api-key")
    );
  });

  it("should return null when no observations available", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ observations: [] }),
    });

    const result = await fetchLatestFredValue("INVALID", "test-api-key");
    expect(result).toBeNull();
  });

  it("should return null when value is missing (.)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        observations: [{ date: "2024-01-01", value: "." }],
      }),
    });

    const result = await fetchLatestFredValue("CPIAUCSL", "test-api-key");
    expect(result).toBeNull();
  });

  it("should throw error on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
    });

    await expect(
      fetchLatestFredValue("INVALID", "test-api-key")
    ).rejects.toThrow("FRED API error: 400");
  });
});
