import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";

// Mock the auth module
vi.mock("@/lib/api/auth", () => ({
  authenticateApiRequest: vi.fn(),
  createApiErrorResponse: vi.fn((error, code, status) => {
    return NextResponse.json({ error, code }, { status: status ?? 500 });
  }),
}));

// Mock the supabase service client
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

// Mock the usage logger (T314)
vi.mock("@/lib/api/usage-logger", () => ({
  logApiUsage: vi.fn(),
}));

// Import the mocked functions
import { authenticateApiRequest } from "@/lib/api/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
const mockAuthenticateApiRequest = vi.mocked(authenticateApiRequest);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

describe("GET /api/v1/calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock current time for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("authentication", () => {
    it("returns 401 when API key is missing", async () => {
      mockAuthenticateApiRequest.mockResolvedValue(
        NextResponse.json(
          { error: "Invalid or missing API key", code: "UNAUTHORIZED" },
          { status: 401 }
        )
      );

      const request = new NextRequest("http://localhost/api/v1/calendar");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Invalid or missing API key");
    });

    it("returns 401 when API key is invalid", async () => {
      mockAuthenticateApiRequest.mockResolvedValue(
        NextResponse.json(
          { error: "Invalid or missing API key", code: "UNAUTHORIZED" },
          { status: 401 }
        )
      );

      const request = new NextRequest("http://localhost/api/v1/calendar", {
        headers: { Authorization: "Bearer invalid_key" },
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe("parameter validation", () => {
    beforeEach(() => {
      // Mock successful authentication
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123" });
    });

    it("returns 400 when days is invalid", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/calendar?days=abc"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when days is out of range (too low)", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/calendar?days=0"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when days is out of range (too high)", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/calendar?days=91"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });
  });

  describe("successful responses", () => {
    beforeEach(() => {
      // Mock successful authentication
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123" });
    });

    it("returns calendar events with default 7 days", async () => {
      const mockReleases = [
        {
          id: "rel-1",
          indicator_id: "ind-1",
          release_at: "2024-02-03T13:30:00Z",
          period: "Jan 2024",
          actual: null,
          forecast: "3.2%",
          previous: "3.4%",
          revision_history: null,
          indicators: {
            id: "ind-1",
            name: "CPI (YoY)",
            country_code: "US",
            category: "Inflation",
          },
        },
        {
          id: "rel-2",
          indicator_id: "ind-2",
          release_at: "2024-02-05T08:30:00Z",
          period: "Q4 2023",
          actual: null,
          forecast: "2.8%",
          previous: "2.5%",
          revision_history: null,
          indicators: {
            id: "ind-2",
            name: "GDP (QoQ)",
            country_code: "US",
            category: "GDP",
          },
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockReleases,
            error: null,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/calendar");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].indicator_name).toBe("CPI (YoY)");
      expect(body.data[0].country_code).toBe("US");
      expect(body.data[0].has_revisions).toBe(false);
      expect(body.meta.from_date).toBe("2024-02-01T00:00:00.000Z");
      expect(body.meta.to_date).toBe("2024-02-08T00:00:00.000Z");
      expect(body.meta.total_events).toBe(2);
    });

    it("applies days parameter correctly", async () => {
      const mockGte = vi.fn().mockReturnThis();
      const mockLte = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: mockGte,
          lte: mockLte,
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        "http://localhost/api/v1/calendar?days=30"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      // From date should be now (2024-02-01)
      expect(mockGte).toHaveBeenCalledWith(
        "release_at",
        "2024-02-01T00:00:00.000Z"
      );
      // To date should be 30 days later (2024-03-02)
      expect(mockLte).toHaveBeenCalledWith(
        "release_at",
        "2024-03-02T00:00:00.000Z"
      );
      expect(body.meta.to_date).toBe("2024-03-02T00:00:00.000Z");
    });

    it("applies country filter", async () => {
      const mockEq = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          eq: mockEq,
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        "http://localhost/api/v1/calendar?country=us"
      );
      await GET(request);

      // Country should be uppercased and applied to indicator filter
      expect(mockEq).toHaveBeenCalledWith("indicators.country_code", "US");
    });

    it("applies category filter", async () => {
      const mockEq = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          eq: mockEq,
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        "http://localhost/api/v1/calendar?category=Inflation"
      );
      await GET(request);

      expect(mockEq).toHaveBeenCalledWith("indicators.category", "Inflation");
    });

    it("applies both country and category filters", async () => {
      const mockEq = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          eq: mockEq,
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        "http://localhost/api/v1/calendar?country=EU&category=GDP"
      );
      await GET(request);

      expect(mockEq).toHaveBeenCalledWith("indicators.country_code", "EU");
      expect(mockEq).toHaveBeenCalledWith("indicators.category", "GDP");
    });

    it("handles embedded indicator as array format", async () => {
      const mockReleases = [
        {
          id: "rel-1",
          indicator_id: "ind-1",
          release_at: "2024-02-03T13:30:00Z",
          period: "Jan 2024",
          actual: null,
          forecast: "3.2%",
          previous: "3.4%",
          revision_history: null,
          // Some Supabase versions return embedded relations as arrays
          indicators: [
            {
              id: "ind-1",
              name: "CPI (YoY)",
              country_code: "US",
              category: "Inflation",
            },
          ],
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockReleases,
            error: null,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/calendar");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0].indicator_name).toBe("CPI (YoY)");
    });

    it("marks events with revision history as has_revisions: true", async () => {
      const mockReleases = [
        {
          id: "rel-1",
          indicator_id: "ind-1",
          release_at: "2024-02-03T13:30:00Z",
          period: "Jan 2024",
          actual: "3.2%",
          forecast: "3.1%",
          previous: "3.4%",
          revision_history: [
            {
              previous_actual: "3.1%",
              new_actual: "3.2%",
              revised_at: "2024-02-15T00:00:00Z",
            },
          ],
          indicators: {
            id: "ind-1",
            name: "CPI (YoY)",
            country_code: "US",
            category: "Inflation",
          },
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockReleases,
            error: null,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/calendar");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0].has_revisions).toBe(true);
    });

    it("returns empty array when no events in range", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/calendar");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toEqual([]);
      expect(body.meta.total_events).toBe(0);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123" });
    });

    it("returns 500 when database query fails", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/calendar");
      const response = await GET(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.code).toBe("INTERNAL_ERROR");

      consoleErrorSpy.mockRestore();
    });
  });
});
