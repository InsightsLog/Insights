/**
 * Tests for ECB API client.
 *
 * Task: T406
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ECB_SERIES_MAP, fetchEcbSeries, fetchSeriesData } from "./ecb";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ECB_SERIES_MAP", () => {
  it("contains ECB interest rate series", () => {
    expect(ECB_SERIES_MAP).toHaveProperty(
      "FM/B.U2.EUR.4F.KR.MRR.LEV"
    );
  });

  it("contains HICP inflation series", () => {
    expect(ECB_SERIES_MAP).toHaveProperty("ICP/M.U2.N.000000.4.ANR");
    expect(ECB_SERIES_MAP["ICP/M.U2.N.000000.4.ANR"]).toBe(
      "Euro Area HICP (YoY)"
    );
  });
});

describe("fetchEcbSeries", () => {
  it("parses SDMX JSON response correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          dataSets: [
            {
              series: {
                "0:0:0:0:0:0": {
                  observations: {
                    "0": [2.5],
                    "1": [2.8],
                    "2": [3.1],
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
                  name: "Time period",
                  values: [
                    { id: "2025-10", name: "October 2025" },
                    { id: "2025-11", name: "November 2025" },
                    { id: "2025-12", name: "December 2025" },
                  ],
                },
              ],
            },
          },
        }),
    });

    const result = await fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR");

    expect(result).toHaveLength(3);
    expect(result[0].date).toBe("2025-10-01");
    expect(result[0].value).toBe("2.5");
    expect(result[0].period).toBe("Oct 2025");
    expect(result[0].indicatorName).toBe("Euro Area HICP (YoY)");

    expect(result[2].date).toBe("2025-12-01");
    expect(result[2].value).toBe("3.1");
  });

  it("handles quarterly periods", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          dataSets: [
            {
              series: {
                "0": {
                  observations: {
                    "0": [0.3],
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
                  name: "Time period",
                  values: [{ id: "2025-Q4", name: "Q4 2025" }],
                },
              ],
            },
          },
        }),
    });

    const result = await fetchEcbSeries(
      "MNA",
      "Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY"
    );

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-10-01");
    expect(result[0].period).toBe("Q4 2025");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(
      fetchEcbSeries("ICP", "INVALID.SERIES")
    ).rejects.toThrow("ECB API error");
  });
});

describe("fetchSeriesData", () => {
  it("splits combined key and fetches data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          dataSets: [
            {
              series: {
                "0": {
                  observations: {
                    "0": [4.5],
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
                  name: "Time period",
                  values: [{ id: "2025-12", name: "December 2025" }],
                },
              ],
            },
          },
        }),
    });

    const result = await fetchSeriesData("FM/B.U2.EUR.4F.KR.MRR.LEV");

    expect(result.seriesKey).toBe("FM/B.U2.EUR.4F.KR.MRR.LEV");
    expect(result.dataPoints).toHaveLength(1);
    expect(result.error).toBeUndefined();
  });

  it("returns error for invalid key format", async () => {
    const result = await fetchSeriesData("no-slash-key");

    expect(result.error).toBeDefined();
    expect(result.dataPoints).toHaveLength(0);
  });
});
