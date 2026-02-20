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

describe("GET /api/v1/indicators", () => {
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

      const request = new NextRequest("http://localhost/api/v1/indicators");
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

      const request = new NextRequest("http://localhost/api/v1/indicators", {
        headers: { Authorization: "Bearer invalid_key" },
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe("parameter validation", () => {
    beforeEach(() => {
      // Mock successful authentication
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123", rateLimit: { allowed: true, limit: 60, remaining: 59, resetAt: 9999999999 } });
    });

    it("returns 400 when limit is invalid", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/indicators?limit=abc"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when limit is out of range", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/indicators?limit=200"
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when offset is negative", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/indicators?offset=-5"
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
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123", rateLimit: { allowed: true, limit: 60, remaining: 59, resetAt: 9999999999 } });
    });

    it("returns paginated indicators list", async () => {
      const mockIndicators = [
        {
          id: "ind-1",
          name: "CPI (YoY)",
          country_code: "US",
          category: "Inflation",
          source_name: "Bureau of Labor Statistics",
          source_url: "https://www.bls.gov",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "ind-2",
          name: "GDP (QoQ)",
          country_code: "US",
          category: "GDP",
          source_name: "Bureau of Economic Analysis",
          source_url: "https://www.bea.gov",
          created_at: "2024-01-02T00:00:00Z",
        },
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockIndicators,
            error: null,
            count: 10,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/indicators");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination).toEqual({
        total: 10,
        limit: 20,
        offset: 0,
        has_more: true,
      });
    });

    it("applies country filter", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
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
        "http://localhost/api/v1/indicators?country=us"
      );
      await GET(request);

      // Verify that eq was called with uppercase country code
      const selectCall = mockFrom().select();
      expect(selectCall.eq).toHaveBeenCalledWith("country_code", "US");
    });

    it("applies search filter", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
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
        "http://localhost/api/v1/indicators?search=inflation"
      );
      await GET(request);

      const selectCall = mockFrom().select();
      expect(selectCall.ilike).toHaveBeenCalledWith("name", "%inflation%");
    });

    it("applies pagination parameters", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
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
        "http://localhost/api/v1/indicators?limit=50&offset=20"
      );
      await GET(request);

      const selectCall = mockFrom().select();
      // range(offset, offset + limit - 1) = range(20, 69)
      expect(selectCall.range).toHaveBeenCalledWith(20, 69);
    });

    it("returns has_more: false when no more results", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: "ind-1" }],
            error: null,
            count: 1,
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/indicators");
      const response = await GET(request);

      const body = await response.json();
      expect(body.pagination.has_more).toBe(false);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123", rateLimit: { allowed: true, limit: 60, remaining: 59, resetAt: 9999999999 } });
    });

    it("returns 500 when database query fails", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
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

      const request = new NextRequest("http://localhost/api/v1/indicators");
      const response = await GET(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.code).toBe("INTERNAL_ERROR");

      consoleErrorSpy.mockRestore();
    });
  });
});
