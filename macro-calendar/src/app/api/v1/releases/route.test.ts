import { describe, it, expect, vi, beforeEach } from "vitest";
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

describe("GET /api/v1/releases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when API key is missing", async () => {
      mockAuthenticateApiRequest.mockResolvedValue(
        NextResponse.json(
          { error: "Invalid or missing API key", code: "UNAUTHORIZED" },
          { status: 401 }
        )
      );

      const request = new NextRequest("http://localhost/api/v1/releases");
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

      const request = new NextRequest("http://localhost/api/v1/releases", {
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

    it("returns 400 when limit is invalid", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/releases?limit=abc"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when limit is out of range", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/releases?limit=200"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when offset is negative", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/releases?offset=-5"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when indicator_id is not a valid UUID", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/releases?indicator_id=not-a-uuid"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when from_date is invalid", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/releases?from_date=not-a-date"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when to_date is invalid", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/releases?to_date=invalid"
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

    it("returns paginated releases list with indicators", async () => {
      const mockReleases = [
        {
          id: "rel-1",
          indicator_id: "ind-1",
          release_at: "2024-02-01T13:30:00Z",
          period: "Jan 2024",
          actual: "3.1%",
          forecast: "3.2%",
          previous: "3.4%",
          revised: null,
          unit: "%",
          revision_history: null,
          created_at: "2024-01-15T00:00:00Z",
          indicators: {
            id: "ind-1",
            name: "CPI (YoY)",
            country_code: "US",
            category: "Inflation",
            source_name: "Bureau of Labor Statistics",
            source_url: "https://www.bls.gov",
            created_at: "2024-01-01T00:00:00Z",
          },
        },
        {
          id: "rel-2",
          indicator_id: "ind-2",
          release_at: "2024-02-02T08:30:00Z",
          period: "Q4 2023",
          actual: null,
          forecast: "2.8%",
          previous: "2.5%",
          revised: null,
          unit: "%",
          revision_history: null,
          created_at: "2024-01-16T00:00:00Z",
          indicators: {
            id: "ind-2",
            name: "GDP (QoQ)",
            country_code: "US",
            category: "GDP",
            source_name: "Bureau of Economic Analysis",
            source_url: "https://www.bea.gov",
            created_at: "2024-01-02T00:00:00Z",
          },
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockReleases,
            error: null,
            count: 10,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/releases");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].indicator.name).toBe("CPI (YoY)");
      expect(body.data[1].indicator.name).toBe("GDP (QoQ)");
      expect(body.pagination).toEqual({
        total: 10,
        limit: 20,
        offset: 0,
        has_more: true,
      });
    });

    it("applies indicator_id filter", async () => {
      const validUuid = "123e4567-e89b-12d3-a456-426614174000";
      const mockEq = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEq,
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/releases?indicator_id=${validUuid}`
      );
      await GET(request);

      expect(mockEq).toHaveBeenCalledWith("indicator_id", validUuid);
    });

    it("applies from_date filter", async () => {
      const mockGte = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          gte: mockGte,
          lte: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        "http://localhost/api/v1/releases?from_date=2024-01-01T00:00:00Z"
      );
      await GET(request);

      expect(mockGte).toHaveBeenCalledWith("release_at", "2024-01-01T00:00:00Z");
    });

    it("applies to_date filter", async () => {
      const mockLte = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: mockLte,
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        "http://localhost/api/v1/releases?to_date=2024-12-31T23:59:59Z"
      );
      await GET(request);

      expect(mockLte).toHaveBeenCalledWith(
        "release_at",
        "2024-12-31T23:59:59Z"
      );
    });

    it("applies pagination parameters", async () => {
      const mockRange = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          range: mockRange,
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
            count: 100,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        "http://localhost/api/v1/releases?limit=50&offset=20"
      );
      await GET(request);

      // range(offset, offset + limit - 1) = range(20, 69)
      expect(mockRange).toHaveBeenCalledWith(20, 69);
    });

    it("returns has_more: false when no more results", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "rel-1",
                indicator_id: "ind-1",
                release_at: "2024-02-01T13:30:00Z",
                period: "Jan 2024",
                actual: "3.1%",
                forecast: "3.2%",
                previous: "3.4%",
                revised: null,
                unit: "%",
                revision_history: null,
                created_at: "2024-01-15T00:00:00Z",
                indicators: {
                  id: "ind-1",
                  name: "CPI (YoY)",
                  country_code: "US",
                  category: "Inflation",
                  source_name: "BLS",
                  source_url: null,
                  created_at: "2024-01-01T00:00:00Z",
                },
              },
            ],
            error: null,
            count: 1,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/releases");
      const response = await GET(request);

      const body = await response.json();
      expect(body.pagination.has_more).toBe(false);
    });

    it("handles embedded indicator as array format", async () => {
      const mockReleases = [
        {
          id: "rel-1",
          indicator_id: "ind-1",
          release_at: "2024-02-01T13:30:00Z",
          period: "Jan 2024",
          actual: "3.1%",
          forecast: "3.2%",
          previous: "3.4%",
          revised: null,
          unit: "%",
          revision_history: null,
          created_at: "2024-01-15T00:00:00Z",
          // Some Supabase versions return embedded relations as arrays
          indicators: [
            {
              id: "ind-1",
              name: "CPI (YoY)",
              country_code: "US",
              category: "Inflation",
              source_name: "BLS",
              source_url: null,
              created_at: "2024-01-01T00:00:00Z",
            },
          ],
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockReleases,
            error: null,
            count: 1,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/releases");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0].indicator.name).toBe("CPI (YoY)");
    });

    it("includes revision_history when present", async () => {
      const mockReleases = [
        {
          id: "rel-1",
          indicator_id: "ind-1",
          release_at: "2024-02-01T13:30:00Z",
          period: "Jan 2024",
          actual: "3.2%",
          forecast: "3.1%",
          previous: "3.4%",
          revised: null,
          unit: "%",
          revision_history: [
            {
              previous_actual: "3.1%",
              new_actual: "3.2%",
              revised_at: "2024-02-15T00:00:00Z",
            },
          ],
          created_at: "2024-01-15T00:00:00Z",
          indicators: {
            id: "ind-1",
            name: "CPI (YoY)",
            country_code: "US",
            category: "Inflation",
            source_name: "BLS",
            source_url: null,
            created_at: "2024-01-01T00:00:00Z",
          },
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockReleases,
            error: null,
            count: 1,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/releases");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0].revision_history).toHaveLength(1);
      expect(body.data[0].revision_history[0].new_actual).toBe("3.2%");
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
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
            count: null,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/releases");
      const response = await GET(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.code).toBe("INTERNAL_ERROR");

      consoleErrorSpy.mockRestore();
    });
  });
});
