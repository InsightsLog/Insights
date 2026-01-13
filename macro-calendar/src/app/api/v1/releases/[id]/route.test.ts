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

describe("GET /api/v1/releases/:id", () => {
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

      const request = new NextRequest(
        "http://localhost/api/v1/releases/123e4567-e89b-12d3-a456-426614174000"
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe("parameter validation", () => {
    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123" });
    });

    it("returns 400 when release ID is not a valid UUID", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/releases/invalid-id"
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: "invalid-id" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });
  });

  describe("successful responses", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";

    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123" });
    });

    it("returns release with indicator", async () => {
      const mockRelease = {
        id: validUuid,
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
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockRelease,
              error: null,
            }),
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/releases/${validUuid}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(validUuid);
      expect(body.actual).toBe("3.1%");
      expect(body.indicator.name).toBe("CPI (YoY)");
      expect(body.indicator.country_code).toBe("US");
    });

    it("handles embedded indicator as array format", async () => {
      const mockRelease = {
        id: validUuid,
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
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockRelease,
              error: null,
            }),
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/releases/${validUuid}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.indicator.name).toBe("CPI (YoY)");
    });

    it("includes revision_history when present", async () => {
      const mockRelease = {
        id: validUuid,
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
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockRelease,
              error: null,
            }),
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/releases/${validUuid}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.revision_history).toHaveLength(1);
      expect(body.revision_history[0].new_actual).toBe("3.2%");
    });

    it("returns release with null values", async () => {
      const mockRelease = {
        id: validUuid,
        indicator_id: "ind-1",
        release_at: "2024-02-01T13:30:00Z",
        period: "Jan 2024",
        actual: null,
        forecast: null,
        previous: null,
        revised: null,
        unit: null,
        revision_history: null,
        created_at: "2024-01-15T00:00:00Z",
        indicators: {
          id: "ind-1",
          name: "Upcoming Release",
          country_code: "US",
          category: "GDP",
          source_name: "BEA",
          source_url: null,
          created_at: "2024-01-01T00:00:00Z",
        },
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockRelease,
              error: null,
            }),
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/releases/${validUuid}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.actual).toBeNull();
      expect(body.forecast).toBeNull();
      expect(body.previous).toBeNull();
    });
  });

  describe("error handling", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";

    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123" });
    });

    it("returns 404 when release is not found", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116", message: "No rows returned" },
            }),
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/releases/${validUuid}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.code).toBe("NOT_FOUND");
    });

    it("returns 500 when database query fails", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "OTHER_ERROR", message: "Database error" },
            }),
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/releases/${validUuid}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.code).toBe("INTERNAL_ERROR");

      consoleErrorSpy.mockRestore();
    });
  });
});
