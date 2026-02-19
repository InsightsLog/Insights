/**
 * Tests for BLS API integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchLatestBlsValue } from "./bls";

describe("BLS API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch latest value successfully", async () => {
    const mockResponse = {
      status: "REQUEST_SUCCEEDED",
      responseTime: 100,
      Results: {
        series: [
          {
            seriesID: "CES0000000001",
            data: [
              {
                year: "2024",
                period: "M01",
                periodName: "January",
                value: "157000",
                latest: "true",
              },
            ],
          },
        ],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchLatestBlsValue("CES0000000001", "test-api-key");

    expect(result).toEqual({
      value: "157000",
      period: "January",
      year: "2024",
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.bls.gov/publicAPI/v2/timeseries/data"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("CES0000000001"),
      })
    );
  });

  it("should work without API key", async () => {
    const mockResponse = {
      status: "REQUEST_SUCCEEDED",
      responseTime: 100,
      Results: {
        series: [
          {
            seriesID: "CES0000000001",
            data: [
              {
                year: "2024",
                period: "M01",
                periodName: "January",
                value: "157000",
                latest: "true",
              },
            ],
          },
        ],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchLatestBlsValue("CES0000000001");

    expect(result).toEqual({
      value: "157000",
      period: "January",
      year: "2024",
    });
  });

  it("should return null when no data available", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "REQUEST_SUCCEEDED",
        Results: { series: [] },
      }),
    });

    const result = await fetchLatestBlsValue("INVALID");
    expect(result).toBeNull();
  });

  it("should throw error on API request failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "REQUEST_NOT_PROCESSED",
        message: ["Invalid series ID"],
      }),
    });

    await expect(fetchLatestBlsValue("INVALID")).rejects.toThrow(
      "BLS API request failed"
    );
  });

  it("should throw error on HTTP failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(fetchLatestBlsValue("INVALID")).rejects.toThrow(
      "BLS API error: 500"
    );
  });
});
