import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchEcbSeries,
  ECB_SERIES_MAP,
  type EcbResponse,
} from "./ecb";

describe("fetchEcbSeries", () => {
  // Mock fetch globally
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("fetches and validates ECB data successfully", async () => {
    const mockResponse: EcbResponse = {
      dataSets: [
        {
          series: {
            "0:0:0:0:0": {
              observations: [
                { id: "0", value: 2.8 },
                { id: "1", value: 2.9 },
              ],
            },
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR", {
      startPeriod: "2023-01",
      endPeriod: "2024-01",
    });

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "https://data-api.ecb.europa.eu/service/data/ICP/M.U2.N.000000.4.ANR"
      ),
      expect.objectContaining({
        headers: {
          Accept: "application/json",
        },
      })
    );
  });

  it("includes query parameters in the request URL", async () => {
    const mockResponse: EcbResponse = {
      dataSets: [{ series: {} }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    await fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR", {
      startPeriod: "2023-01",
      endPeriod: "2024-01",
      lastNObservations: 10,
      detail: "dataonly",
    });

    const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(callUrl).toContain("format=jsondata");
    expect(callUrl).toContain("startPeriod=2023-01");
    expect(callUrl).toContain("endPeriod=2024-01");
    expect(callUrl).toContain("lastNObservations=10");
    expect(callUrl).toContain("detail=dataonly");
  });

  it("handles rate limiting with exponential backoff", async () => {
    const mockResponse: EcbResponse = {
      dataSets: [{ series: {} }],
    };

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });
    });

    const fetchPromise = fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR", {}, {
      maxRetries: 3,
      initialDelayMs: 100,
    });

    // Fast-forward through first retry delay (100ms)
    await vi.advanceTimersByTimeAsync(100);
    // Fast-forward through second retry delay (200ms)
    await vi.advanceTimersByTimeAsync(200);

    const result = await fetchPromise;

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("throws error after max retries on rate limiting", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });

    const fetchPromise = fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR", {}, {
      maxRetries: 2,
      initialDelayMs: 100,
    });

    // Fast-forward through retry delays
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

    await expect(fetchPromise).rejects.toThrow(
      "ECB API rate limit exceeded after 2 retries"
    );
  });

  it("handles HTTP errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(
      fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR")
    ).rejects.toThrow("ECB API error: 500 Internal Server Error");
  });

  it("handles network errors with retry", async () => {
    const mockResponse: EcbResponse = {
      dataSets: [{ series: {} }],
    };

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 2) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });
    });

    const fetchPromise = fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR", {}, {
      maxRetries: 3,
      initialDelayMs: 100,
    });

    // Fast-forward through retry delay
    await vi.advanceTimersByTimeAsync(100);

    const result = await fetchPromise;

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws error after max retries on network errors", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const fetchPromise = fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR", {}, {
      maxRetries: 1,
      initialDelayMs: 100,
    });

    // Fast-forward through retry delay
    await vi.advanceTimersByTimeAsync(100);

    await expect(fetchPromise).rejects.toThrow("Network error");
  });

  it("validates response data with Zod schema", async () => {
    // Invalid response missing required structure
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ invalid: "data" }),
    });

    await expect(
      fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR")
    ).rejects.toThrow();
  });

  it("accepts response with nested data structure", async () => {
    const mockResponse: EcbResponse = {
      data: {
        dataSets: [
          {
            series: {
              "0:0": {
                name: "Test Series",
                observations: [{ value: 3.2 }],
              },
            },
          },
        ],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR");

    expect(result).toEqual(mockResponse);
  });

  it("handles observations with string values", async () => {
    const mockResponse: EcbResponse = {
      dataSets: [
        {
          series: {
            "0": {
              observations: [
                { value: "2.8" },
                { value: 2.9 },
              ],
            },
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR");

    expect(result).toEqual(mockResponse);
  });

  it("uses default retry options when not specified", async () => {
    const mockResponse: EcbResponse = {
      dataSets: [{ series: {} }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    await fetchEcbSeries("ICP", "M.U2.N.000000.4.ANR");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("ECB_SERIES_MAP", () => {
  it("contains mapping for HICP inflation", () => {
    expect(ECB_SERIES_MAP["ICP:M.U2.N.000000.4.ANR"]).toBe(
      "Eurozone HICP - All Items Annual Rate"
    );
  });

  it("contains mapping for ECB interest rates", () => {
    expect(ECB_SERIES_MAP["FM:B.U2.EUR.4F.KR.MRR_FR.LEV"]).toBe(
      "ECB Main Refinancing Rate"
    );
    expect(ECB_SERIES_MAP["FM:B.U2.EUR.4F.KR.DFR.LEV"]).toBe(
      "ECB Deposit Facility Rate"
    );
    expect(ECB_SERIES_MAP["FM:B.U2.EUR.4F.KR.MLFR.LEV"]).toBe(
      "ECB Marginal Lending Facility Rate"
    );
  });

  it("contains mapping for GDP", () => {
    expect(ECB_SERIES_MAP["MNA:Q.Y.I8.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.V.N"]).toBe(
      "Eurozone GDP"
    );
  });

  it("contains mapping for unemployment", () => {
    expect(ECB_SERIES_MAP["LFSI:M.I8.S.UNEHRT.TOTAL0.15_74.T"]).toBe(
      "Eurozone Unemployment Rate"
    );
  });

  it("has at least 5 series mappings", () => {
    const keys = Object.keys(ECB_SERIES_MAP);
    expect(keys.length).toBeGreaterThanOrEqual(5);
  });
});
