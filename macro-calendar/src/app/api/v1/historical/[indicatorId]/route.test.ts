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

// Mock the usage logger
vi.mock("@/lib/api/usage-logger", () => ({
  logApiUsage: vi.fn(),
}));

// Import the mocked functions
import { authenticateApiRequest } from "@/lib/api/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
const mockAuthenticateApiRequest = vi.mocked(authenticateApiRequest);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

describe("GET /api/v1/historical/[indicatorId]", () => {
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
        "http://localhost/api/v1/historical/123e4567-e89b-12d3-a456-426614174000"
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: "123e4567-e89b-12d3-a456-426614174000" }),
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Invalid or missing API key");
    });
  });

  describe("parameter validation", () => {
    beforeEach(() => {
      // Mock successful authentication
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123" });
    });

    it("returns 400 when indicator ID is not a valid UUID", async () => {
      const request = new NextRequest("http://localhost/api/v1/historical/invalid-id");
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: "invalid-id" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
      expect(body.error).toContain("Invalid indicator ID format");
    });

    it("returns 400 when from_date is not valid ISO 8601", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/historical/123e4567-e89b-12d3-a456-426614174000?from_date=invalid-date"
      );

      // Mock Supabase to prevent execution after validation
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: { id: "123e4567-e89b-12d3-a456-426614174000" },
            error: null,
          }),
        }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateSupabaseServiceClient.mockReturnValue({ from: mockFrom } as any);

      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: "123e4567-e89b-12d3-a456-426614174000" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when limit exceeds maximum", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/historical/123e4567-e89b-12d3-a456-426614174000?limit=2000"
      );

      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: "123e4567-e89b-12d3-a456-426614174000" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when offset is negative", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/historical/123e4567-e89b-12d3-a456-426614174000?offset=-5"
      );

      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: "123e4567-e89b-12d3-a456-426614174000" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });
  });

  describe("indicator validation", () => {
    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123" });
    });

    it("returns 404 when indicator does not exist", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateSupabaseServiceClient.mockReturnValue({ from: mockFrom } as any);

      const request = new NextRequest(
        "http://localhost/api/v1/historical/123e4567-e89b-12d3-a456-426614174000"
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: "123e4567-e89b-12d3-a456-426614174000" }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("Indicator not found");
    });
  });

  describe("successful responses", () => {
    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123", apiKeyId: "key-123" });
    });

    it("returns paginated historical releases", async () => {
      const mockReleases = [
        {
          id: "rel-1",
          indicator_id: "123e4567-e89b-12d3-a456-426614174000",
          release_at: "2024-03-01T14:30:00Z",
          period: "2024-02",
          actual: "3.2",
          forecast: "3.0",
          previous: "3.1",
          revised: null,
          unit: "%",
          revision_history: [],
          created_at: "2024-03-01T00:00:00Z",
        },
        {
          id: "rel-2",
          indicator_id: "123e4567-e89b-12d3-a456-426614174000",
          release_at: "2024-02-01T14:30:00Z",
          period: "2024-01",
          actual: "3.1",
          forecast: "2.9",
          previous: "3.0",
          revised: null,
          unit: "%",
          revision_history: [],
          created_at: "2024-02-01T00:00:00Z",
        },
      ];

      const mockFrom = vi.fn((table: string) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "123e4567-e89b-12d3-a456-426614174000" },
                  error: null,
                }),
              }),
            }),
          };
        } else {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: mockReleases,
                    error: null,
                    count: 50,
                  }),
                }),
              }),
            }),
          };
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateSupabaseServiceClient.mockReturnValue({ from: mockFrom } as any);

      const request = new NextRequest(
        "http://localhost/api/v1/historical/123e4567-e89b-12d3-a456-426614174000?limit=10&offset=0"
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: "123e4567-e89b-12d3-a456-426614174000" }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination).toEqual({
        total: 50,
        limit: 10,
        offset: 0,
      });
    });

    it("applies date filters correctly", async () => {
      const mockReleases = [
        {
          id: "rel-1",
          indicator_id: "123e4567-e89b-12d3-a456-426614174000",
          release_at: "2024-03-01T14:30:00Z",
          period: "2024-02",
          actual: "3.2",
          forecast: "3.0",
          previous: "3.1",
          revised: null,
          unit: "%",
          revision_history: [],
          created_at: "2024-03-01T00:00:00Z",
        },
      ];

      const mockFrom = vi.fn((table: string) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "123e4567-e89b-12d3-a456-426614174000" },
                  error: null,
                }),
              }),
            }),
          };
        } else {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: mockReleases,
                    error: null,
                    count: 1,
                  }),
                }),
              }),
            }),
          };
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateSupabaseServiceClient.mockReturnValue({ from: mockFrom } as any);

      const request = new NextRequest(
        "http://localhost/api/v1/historical/123e4567-e89b-12d3-a456-426614174000?from_date=2024-01-01T00:00:00Z&to_date=2024-12-31T23:59:59Z"
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: "123e4567-e89b-12d3-a456-426614174000" }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
    });

    it("uses default pagination values when not specified", async () => {
      const mockFrom = vi.fn((table: string) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "123e4567-e89b-12d3-a456-426614174000" },
                  error: null,
                }),
              }),
            }),
          };
        } else {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                    count: 0,
                  }),
                }),
              }),
            }),
          };
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateSupabaseServiceClient.mockReturnValue({ from: mockFrom } as any);

      const request = new NextRequest(
        "http://localhost/api/v1/historical/123e4567-e89b-12d3-a456-426614174000"
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: "123e4567-e89b-12d3-a456-426614174000" }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.pagination).toEqual({
        total: 0,
        limit: 100, // Default limit
        offset: 0, // Default offset
      });
    });
  });
});
