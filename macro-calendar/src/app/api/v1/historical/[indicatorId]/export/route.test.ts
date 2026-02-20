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

const VALID_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("GET /api/v1/historical/[indicatorId]/export", () => {
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
        `http://localhost/api/v1/historical/${VALID_ID}/export`
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: VALID_ID }),
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Invalid or missing API key");
    });
  });

  describe("parameter validation", () => {
    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({
        userId: "user-123",
        apiKeyId: "key-123",
      });
    });

    it("returns 400 when indicator ID is not a valid UUID", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/historical/invalid-id/export"
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: "invalid-id" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
      expect(body.error).toContain("Invalid indicator ID format");
    });

    it("returns 400 when format is not csv or json", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateSupabaseServiceClient.mockReturnValue({ from: vi.fn() } as any);

      const request = new NextRequest(
        `http://localhost/api/v1/historical/${VALID_ID}/export?format=xml`
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: VALID_ID }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });
  });

  describe("indicator validation", () => {
    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({
        userId: "user-123",
        apiKeyId: "key-123",
      });
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
        `http://localhost/api/v1/historical/${VALID_ID}/export`
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: VALID_ID }),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("Indicator not found");
    });
  });

  describe("CSV export", () => {
    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({
        userId: "user-123",
        apiKeyId: "key-123",
      });

      const mockReleases = [
        {
          release_at: "2024-03-01T14:30:00Z",
          actual: "3.2",
          forecast: "3.0",
          previous: "3.1",
          revised: null,
        },
        {
          release_at: "2024-02-01T14:30:00Z",
          actual: "3.1",
          forecast: "2.9",
          previous: "3.0",
          revised: "3.05",
        },
      ];

      const mockFrom = vi.fn((table: string) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: VALID_ID },
                  error: null,
                }),
              }),
            }),
          };
        }
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
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateSupabaseServiceClient.mockReturnValue({ from: mockFrom } as any);
    });

    it("returns 200 with text/csv content type", async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/historical/${VALID_ID}/export?format=csv`
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: VALID_ID }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/csv");
    });

    it("includes correct CSV headers: date, actual, consensus, previous, revised", async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/historical/${VALID_ID}/export?format=csv`
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: VALID_ID }),
      });

      const text = await response.text();
      const firstLine = text.split("\n")[0];
      expect(firstLine).toBe("date,actual,consensus,previous,revised");
    });

    it("maps forecast column to consensus in CSV output", async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/historical/${VALID_ID}/export?format=csv`
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: VALID_ID }),
      });

      const text = await response.text();
      const lines = text.split("\n");
      // Second line is the first data row
      expect(lines[1]).toContain("3.2"); // actual
      expect(lines[1]).toContain("3.0"); // consensus (was forecast)
    });

    it("sets Content-Disposition attachment header for CSV", async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/historical/${VALID_ID}/export?format=csv`
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: VALID_ID }),
      });

      const cd = response.headers.get("Content-Disposition");
      expect(cd).toMatch(/attachment; filename=".+\.csv"/);
    });

    it("defaults to CSV format when format param is omitted", async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/historical/${VALID_ID}/export`
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: VALID_ID }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/csv");
    });
  });

  describe("JSON export", () => {
    beforeEach(() => {
      mockAuthenticateApiRequest.mockResolvedValue({
        userId: "user-123",
        apiKeyId: "key-123",
      });

      const mockReleases = [
        {
          release_at: "2024-03-01T14:30:00Z",
          actual: "3.2",
          forecast: "3.0",
          previous: "3.1",
          revised: null,
        },
      ];

      const mockFrom = vi.fn((table: string) => {
        if (table === "indicators") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: VALID_ID },
                  error: null,
                }),
              }),
            }),
          };
        }
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
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreateSupabaseServiceClient.mockReturnValue({ from: mockFrom } as any);
    });

    it("returns 200 with application/json content type", async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/historical/${VALID_ID}/export?format=json`
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: VALID_ID }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("returns a JSON array with correct shape", async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/historical/${VALID_ID}/export?format=json`
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: VALID_ID }),
      });

      const body = await response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0]).toEqual({
        date: "2024-03-01T14:30:00Z",
        actual: "3.2",
        consensus: "3.0",
        previous: "3.1",
        revised: null,
      });
    });

    it("sets Content-Disposition attachment header for JSON", async () => {
      const request = new NextRequest(
        `http://localhost/api/v1/historical/${VALID_ID}/export?format=json`
      );
      const response = await GET(request, {
        params: Promise.resolve({ indicatorId: VALID_ID }),
      });

      const cd = response.headers.get("Content-Disposition");
      expect(cd).toMatch(/attachment; filename=".+\.json"/);
    });
  });
});
