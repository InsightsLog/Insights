/**
 * Tests for ECB API integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchLatestEcbValue } from "./ecb";

describe("ECB API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch latest value successfully", async () => {
    const mockResponse = {
      dataSets: [
        {
          series: {
            "0": {
              observations: {
                "0": [1.05],
              },
            },
          },
        },
      ],
      structure: {
        dimensions: {
          observation: [
            {
              id: "TIME_PERIOD",
              values: [
                {
                  id: "2024-01",
                },
              ],
            },
          ],
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchLatestEcbValue("EXR", "D.USD.EUR.SP00.A");

    expect(result).toEqual({
      value: "1.05",
      date: "2024-01",
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("data-api.ecb.europa.eu/service/data/EXR"),
      expect.objectContaining({
        headers: { Accept: "application/json" },
      })
    );
  });

  it("should return null when no datasets available", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ dataSets: [] }),
    });

    const result = await fetchLatestEcbValue("EXR", "D.USD.EUR.SP00.A");
    expect(result).toBeNull();
  });

  it("should return null when no series available", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dataSets: [{}],
      }),
    });

    const result = await fetchLatestEcbValue("EXR", "D.USD.EUR.SP00.A");
    expect(result).toBeNull();
  });

  it("should return null when no observations available", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dataSets: [
          {
            series: {
              "0": {
                observations: {},
              },
            },
          },
        ],
      }),
    });

    const result = await fetchLatestEcbValue("EXR", "D.USD.EUR.SP00.A");
    expect(result).toBeNull();
  });

  it("should throw error on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(
      fetchLatestEcbValue("INVALID", "INVALID")
    ).rejects.toThrow("ECB API error: 404");
  });
});
