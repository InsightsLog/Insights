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

// Import the mocked functions
import { authenticateApiRequest } from "@/lib/api/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
const mockAuthenticateApiRequest = vi.mocked(authenticateApiRequest);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

describe("GET /api/v1/indicators/:id", () => {
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
        "http://localhost/api/v1/indicators/123e4567-e89b-12d3-a456-426614174000"
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe("parameter validation", () => {
    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123" });
    });

    it("returns 400 when indicator ID is not a valid UUID", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/indicators/invalid-id"
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: "invalid-id" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when releases_limit is invalid", async () => {
      const validUuid = "123e4567-e89b-12d3-a456-426614174000";
      const request = new NextRequest(
        `http://localhost/api/v1/indicators/${validUuid}?releases_limit=abc`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 when releases_limit is out of range", async () => {
      const validUuid = "123e4567-e89b-12d3-a456-426614174000";
      const request = new NextRequest(
        `http://localhost/api/v1/indicators/${validUuid}?releases_limit=200`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });
  });

  describe("successful responses", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";

    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123" });
    });

    it("returns indicator with releases by default", async () => {
      const mockIndicator = {
        id: validUuid,
        name: "CPI (YoY)",
        country_code: "US",
        category: "Inflation",
        source_name: "Bureau of Labor Statistics",
        source_url: "https://www.bls.gov",
        created_at: "2024-01-01T00:00:00Z",
      };

      const mockReleases = [
        {
          id: "rel-1",
          indicator_id: validUuid,
          release_at: "2024-02-01T13:30:00Z",
          period: "Jan 2024",
          actual: "3.1%",
          forecast: "3.2%",
          previous: "3.4%",
          revised: null,
          unit: "%",
          revision_history: null,
          created_at: "2024-01-15T00:00:00Z",
        },
      ];

      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockIndicator,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "releases") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: mockReleases,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/indicators/${validUuid}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(validUuid);
      expect(body.name).toBe("CPI (YoY)");
      expect(body.releases).toHaveLength(1);
      expect(body.releases[0].actual).toBe("3.1%");
    });

    it("returns indicator without releases when include_releases=false", async () => {
      const mockIndicator = {
        id: validUuid,
        name: "GDP (QoQ)",
        country_code: "US",
        category: "GDP",
        source_name: "BEA",
        source_url: null,
        created_at: "2024-01-01T00:00:00Z",
      };

      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockIndicator,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/indicators/${validUuid}?include_releases=false`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(validUuid);
      expect(body.releases).toBeUndefined();
    });

    it("applies releases_limit parameter", async () => {
      const mockIndicator = {
        id: validUuid,
        name: "Unemployment Rate",
        country_code: "US",
        category: "Employment",
        source_name: "BLS",
        source_url: null,
        created_at: "2024-01-01T00:00:00Z",
      };

      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockIndicator,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "releases") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: mockLimit,
                }),
              }),
            }),
          };
        }
        return {};
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/indicators/${validUuid}?releases_limit=25`
      );
      await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(mockLimit).toHaveBeenCalledWith(25);
    });

    it("includes revision_history in releases when present", async () => {
      const mockIndicator = {
        id: validUuid,
        name: "CPI (YoY)",
        country_code: "US",
        category: "Inflation",
        source_name: "BLS",
        source_url: null,
        created_at: "2024-01-01T00:00:00Z",
      };

      const mockReleases = [
        {
          id: "rel-1",
          indicator_id: validUuid,
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
        },
      ];

      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockIndicator,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "releases") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: mockReleases,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/indicators/${validUuid}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.releases[0].revision_history).toHaveLength(1);
      expect(body.releases[0].revision_history[0].new_actual).toBe("3.2%");
    });
  });

  describe("error handling", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";

    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({ userId: "user-123" });
    });

    it("returns 404 when indicator is not found", async () => {
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
        `http://localhost/api/v1/indicators/${validUuid}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.code).toBe("NOT_FOUND");
    });

    it("returns 500 when indicator query fails", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
        `http://localhost/api/v1/indicators/${validUuid}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.code).toBe("INTERNAL_ERROR");

      consoleErrorSpy.mockRestore();
    });

    it("returns indicator with empty releases when releases query fails", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mockIndicator = {
        id: validUuid,
        name: "CPI (YoY)",
        country_code: "US",
        category: "Inflation",
        source_name: "BLS",
        source_url: null,
        created_at: "2024-01-01T00:00:00Z",
      };

      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockIndicator,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "releases") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Database error" },
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/v1/indicators/${validUuid}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: validUuid }),
      });

      // Should still return 200 with empty releases
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(validUuid);
      expect(body.releases).toEqual([]);

      consoleErrorSpy.mockRestore();
    });
  });
});
