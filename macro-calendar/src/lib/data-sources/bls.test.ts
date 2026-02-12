/**
 * Tests for BLS API client.
 *
 * Task: T405
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BLS_SERIES_MAP, fetchBlsSeries, fetchSeriesData } from "./bls";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BLS_SERIES_MAP", () => {
  it("contains common US employment indicators", () => {
    expect(BLS_SERIES_MAP).toHaveProperty("CES0000000001");
    expect(BLS_SERIES_MAP).toHaveProperty("LNS14000000");
    expect(BLS_SERIES_MAP).toHaveProperty("CUSR0000SA0");
  });

  it("maps series IDs to readable names", () => {
    expect(BLS_SERIES_MAP.CES0000000001).toBe("Nonfarm Payrolls");
    expect(BLS_SERIES_MAP.LNS14000000).toBe("Unemployment Rate");
    expect(BLS_SERIES_MAP.CUSR0000SA0).toBe("CPI All Items");
  });
});

describe("fetchBlsSeries", () => {
  it("returns parsed data on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          status: "REQUEST_SUCCEEDED",
          responseTime: 150,
          Results: {
            series: [
              {
                seriesID: "CES0000000001",
                data: [
                  {
                    year: "2025",
                    period: "M12",
                    periodName: "December",
                    value: "157600",
                    footnotes: [{}],
                  },
                  {
                    year: "2025",
                    period: "M11",
                    periodName: "November",
                    value: "157400",
                    footnotes: [{}],
                  },
                ],
              },
            ],
          },
        }),
    });

    const result = await fetchBlsSeries(["CES0000000001"], "test_key", {
      startYear: 2025,
      endYear: 2025,
    });

    expect(result.status).toBe("REQUEST_SUCCEEDED");
    expect(result.Results?.series).toHaveLength(1);
    expect(result.Results?.series[0].seriesID).toBe("CES0000000001");
    expect(result.Results?.series[0].data).toHaveLength(2);
  });

  it("throws when request fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          status: "REQUEST_FAILED",
          message: ["Invalid series ID"],
        }),
    });

    await expect(
      fetchBlsSeries(["INVALID"], "test_key")
    ).rejects.toThrow("BLS request failed");
  });

  it("throws on too many series", async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `SERIES${i}`);

    await expect(fetchBlsSeries(tooMany, "test_key")).rejects.toThrow(
      "Maximum 50 series per request"
    );
  });
});

describe("fetchSeriesData", () => {
  it("transforms BLS data into typed data points", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          status: "REQUEST_SUCCEEDED",
          responseTime: 100,
          Results: {
            series: [
              {
                seriesID: "LNS14000000",
                data: [
                  {
                    year: "2025",
                    period: "M12",
                    periodName: "December",
                    value: "3.7",
                    footnotes: [{}],
                  },
                ],
              },
            ],
          },
        }),
    });

    const results = await fetchSeriesData(["LNS14000000"], "test_key");

    expect(results).toHaveLength(1);
    expect(results[0].seriesId).toBe("LNS14000000");
    expect(results[0].dataPoints).toHaveLength(1);
    expect(results[0].dataPoints[0].indicatorName).toBe("Unemployment Rate");
    expect(results[0].dataPoints[0].value).toBe("3.7");
    expect(results[0].dataPoints[0].date).toBe("2025-12-01");
    expect(results[0].dataPoints[0].period).toBe("Dec 2025");
  });

  it("returns error for failed series", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const results = await fetchSeriesData(["LNS14000000"], "test_key");

    expect(results).toHaveLength(1);
    expect(results[0].error).toContain("Network error");
    expect(results[0].dataPoints).toHaveLength(0);
  }, 15000);
});
