import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchBlsSeries,
  BLS_SERIES_MAP,
  type BlsParams,
  type BlsResponse,
} from "./bls";

// Mock the env module
vi.mock("@/lib/env", () => ({
  getDataSourceEnv: vi.fn(),
}));

import { getDataSourceEnv } from "@/lib/env";
const mockGetDataSourceEnv = vi.mocked(getDataSourceEnv);

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("BLS API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("BLS_SERIES_MAP", () => {
    it("includes Non-Farm Payrolls mapping", () => {
      expect(BLS_SERIES_MAP.CES0000000001).toBe("Non-Farm Payrolls");
    });

    it("includes Unemployment Rate mapping", () => {
      expect(BLS_SERIES_MAP.LNS14000000).toBe("Unemployment Rate");
    });

    it("includes CPI mapping", () => {
      expect(BLS_SERIES_MAP.CUUR0000SA0).toBe("Consumer Price Index");
    });
  });

  describe("fetchBlsSeries", () => {
    const validResponse: BlsResponse = {
      status: "REQUEST_SUCCEEDED",
      responseTime: 123,
      Results: {
        series: [
          {
            seriesID: "CES0000000001",
            data: [
              {
                year: "2024",
                period: "M01",
                periodName: "January",
                value: "158000",
                footnotes: [],
              },
            ],
          },
        ],
      },
    };

    it("throws error when no series IDs provided", async () => {
      await expect(fetchBlsSeries([])).rejects.toThrow(
        "At least one series ID is required"
      );
    });

    it("throws error when more than 50 series IDs provided", async () => {
      const tooManySeries = Array.from({ length: 51 }, (_, i) => `SERIES${i}`);
      await expect(fetchBlsSeries(tooManySeries)).rejects.toThrow(
        "Maximum 50 series IDs allowed per request"
      );
    });

    it("makes POST request to BLS API with series IDs", async () => {
      mockGetDataSourceEnv.mockReturnValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validResponse,
      } as Response);

      await fetchBlsSeries(["CES0000000001"]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.bls.gov/publicAPI/v2/timeseries/data/",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("CES0000000001"),
        })
      );
    });

    it("includes API key in request when available", async () => {
      mockGetDataSourceEnv.mockReturnValue({ blsApiKey: "test-api-key" });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validResponse,
      } as Response);

      await fetchBlsSeries(["CES0000000001"]);

      const requestBody = JSON.parse(
        mockFetch.mock.calls[0][1]?.body as string
      );
      expect(requestBody.registrationkey).toBe("test-api-key");
    });

    it("includes optional parameters in request", async () => {
      mockGetDataSourceEnv.mockReturnValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validResponse,
      } as Response);

      const params: BlsParams = {
        startyear: "2023",
        endyear: "2024",
        catalog: true,
      };

      await fetchBlsSeries(["CES0000000001"], params);

      const requestBody = JSON.parse(
        mockFetch.mock.calls[0][1]?.body as string
      );
      expect(requestBody.startyear).toBe("2023");
      expect(requestBody.endyear).toBe("2024");
      expect(requestBody.catalog).toBe(true);
    });

    it("returns validated response on success", async () => {
      mockGetDataSourceEnv.mockReturnValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validResponse,
      } as Response);

      const result = await fetchBlsSeries(["CES0000000001"]);

      expect(result.status).toBe("REQUEST_SUCCEEDED");
      expect(result.Results?.series).toHaveLength(1);
      expect(result.Results?.series[0].seriesID).toBe("CES0000000001");
    });

    it("supports batch requests with multiple series", async () => {
      mockGetDataSourceEnv.mockReturnValue(null);
      const batchResponse: BlsResponse = {
        status: "REQUEST_SUCCEEDED",
        responseTime: 234,
        Results: {
          series: [
            {
              seriesID: "CES0000000001",
              data: [
                {
                  year: "2024",
                  period: "M01",
                  periodName: "January",
                  value: "158000",
                },
              ],
            },
            {
              seriesID: "LNS14000000",
              data: [
                {
                  year: "2024",
                  period: "M01",
                  periodName: "January",
                  value: "3.7",
                },
              ],
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => batchResponse,
      } as Response);

      const result = await fetchBlsSeries([
        "CES0000000001",
        "LNS14000000",
      ]);

      expect(result.Results?.series).toHaveLength(2);
      expect(result.Results?.series[0].seriesID).toBe("CES0000000001");
      expect(result.Results?.series[1].seriesID).toBe("LNS14000000");
    });

    it("throws error when HTTP request fails", async () => {
      mockGetDataSourceEnv.mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      const promise = expect(fetchBlsSeries(["CES0000000001"])).rejects.toThrow(
        "BLS API request failed after 3 retries"
      );
      
      // Fast-forward through all retries
      await vi.runAllTimersAsync();
      
      await promise;
    });

    it("throws error when BLS API returns error status", async () => {
      mockGetDataSourceEnv.mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "REQUEST_FAILED",
          responseTime: 50,
          message: ["Invalid series ID"],
        }),
      } as Response);

      const promise = expect(fetchBlsSeries(["INVALID"])).rejects.toThrow(
        "BLS API error: Invalid series ID"
      );
      
      // Fast-forward through all retries
      await vi.runAllTimersAsync();
      
      await promise;
    });

    it("throws error when response validation fails", async () => {
      mockGetDataSourceEnv.mockReturnValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing required fields
          invalid: "response",
        }),
      } as Response);

      await expect(fetchBlsSeries(["CES0000000001"])).rejects.toThrow(
        "BLS API response validation failed"
      );
    });

    it("retries up to 3 times with exponential backoff on transient errors", async () => {
      mockGetDataSourceEnv.mockReturnValue(null);

      // First two attempts fail, third succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => validResponse,
        } as Response);

      const promise = fetchBlsSeries(["CES0000000001"]);
      
      // Fast-forward through retries
      await vi.runAllTimersAsync();
      
      const result = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.status).toBe("REQUEST_SUCCEEDED");
    });

    it("fails after max retries exhausted", async () => {
      mockGetDataSourceEnv.mockReturnValue(null);

      // All attempts fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      } as Response);

      const promise = expect(fetchBlsSeries(["CES0000000001"])).rejects.toThrow(
        "BLS API request failed after 3 retries"
      );
      
      // Fast-forward through all retries
      await vi.runAllTimersAsync();
      
      await promise;

      // Initial attempt + 3 retries = 4 total calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("does not retry on validation errors", async () => {
      mockGetDataSourceEnv.mockReturnValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: "response" }),
      } as Response);

      await expect(fetchBlsSeries(["CES0000000001"])).rejects.toThrow(
        "BLS API response validation failed"
      );

      // Should only attempt once (no retries for validation errors)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
