import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  validateApiKeyFromHeader,
  createApiErrorResponse,
  authenticateApiRequest,
} from "./auth";

// Mock the createSupabaseServiceClient function
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

// Mock the quota module (T324)
vi.mock("@/lib/api/quota", () => ({
  checkApiQuota: vi.fn(),
  formatQuotaExceededMessage: vi.fn(),
}));

// Mock the rate limit module (T501)
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: vi.fn(),
  applyRateLimitHeaders: vi.fn((response) => response),
}));

// Import the mocked function to control its behavior
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

import { checkApiQuota, formatQuotaExceededMessage } from "@/lib/api/quota";
const mockCheckApiQuota = vi.mocked(checkApiQuota);
const mockFormatQuotaExceededMessage = vi.mocked(formatQuotaExceededMessage);

import { checkApiRateLimit } from "@/lib/rate-limit";
const mockCheckApiRateLimit = vi.mocked(checkApiRateLimit);

describe("API Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateApiKeyFromHeader", () => {
    it("returns invalid when no Authorization header is present", async () => {
      const request = new NextRequest("http://localhost/api/v1/indicators");

      const result = await validateApiKeyFromHeader(request);

      expect(result.valid).toBe(false);
      expect(result.userId).toBeNull();
      expect(result.error).toBe("Invalid or missing API key");
      expect(result.status).toBe(401);
    });

    it("returns invalid when Authorization header is empty", async () => {
      const request = new NextRequest("http://localhost/api/v1/indicators", {
        headers: { Authorization: "" },
      });

      const result = await validateApiKeyFromHeader(request);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid or missing API key");
    });

    it("returns invalid when API key has wrong format", async () => {
      const request = new NextRequest("http://localhost/api/v1/indicators", {
        headers: { Authorization: "Bearer invalid_key" },
      });

      const result = await validateApiKeyFromHeader(request);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid or missing API key");
    });

    it("returns invalid when API key is too short", async () => {
      const request = new NextRequest("http://localhost/api/v1/indicators", {
        headers: { Authorization: "Bearer mc_abc" },
      });

      const result = await validateApiKeyFromHeader(request);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid or missing API key");
    });

    it("returns invalid when API key is not found in database", async () => {
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

      const request = new NextRequest("http://localhost/api/v1/indicators", {
        headers: { Authorization: "Bearer mc_valid_but_not_found_key" },
      });

      const result = await validateApiKeyFromHeader(request);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid or missing API key");
    });

    it("returns invalid when API key is revoked", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                user_id: "user-123",
                revoked_at: "2024-01-01T00:00:00Z",
              },
              error: null,
            }),
          }),
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/indicators", {
        headers: { Authorization: "Bearer mc_revoked_api_key_here" },
      });

      const result = await validateApiKeyFromHeader(request);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("API key has been revoked");
    });

    it("returns valid when API key is correct and not revoked", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: "user-123",
                    revoked_at: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/indicators", {
        headers: { Authorization: "Bearer mc_valid_api_key_here" },
      });

      const result = await validateApiKeyFromHeader(request);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe("user-123");
      expect(result.error).toBeUndefined();
    });

    it("accepts API key without Bearer prefix", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: "user-456",
                    revoked_at: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      const request = new NextRequest("http://localhost/api/v1/indicators", {
        headers: { Authorization: "mc_direct_api_key_here" },
      });

      const result = await validateApiKeyFromHeader(request);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe("user-456");
    });
  });

  describe("createApiErrorResponse", () => {
    it("creates error response with message only", async () => {
      const response = createApiErrorResponse("Something went wrong");

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "Something went wrong" });
    });

    it("creates error response with code", async () => {
      const response = createApiErrorResponse("Not found", "NOT_FOUND", 404);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body).toEqual({ error: "Not found", code: "NOT_FOUND" });
    });

    it("creates 401 unauthorized response", async () => {
      const response = createApiErrorResponse(
        "Invalid API key",
        "UNAUTHORIZED",
        401
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({
        error: "Invalid API key",
        code: "UNAUTHORIZED",
      });
    });

    it("creates 429 quota exceeded response with quota info (T324)", async () => {
      const quotaResult = {
        allowed: false,
        currentUsage: 100,
        limit: 100,
        resetAt: "2026-02-01T00:00:00.000Z",
        planName: "Free",
      };

      const response = createApiErrorResponse(
        "API quota exceeded",
        "QUOTA_EXCEEDED",
        429,
        quotaResult
      );

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body).toEqual({
        error: "API quota exceeded",
        code: "QUOTA_EXCEEDED",
        quota: {
          current: 100,
          limit: 100,
          reset_at: "2026-02-01T00:00:00.000Z",
          plan: "Free",
        },
      });
    });
  });

  describe("authenticateApiRequest", () => {
    it("returns error response for invalid API key", async () => {
      const request = new NextRequest("http://localhost/api/v1/indicators");

      const result = await authenticateApiRequest(request);

      // Should return a NextResponse (error)
      expect(result).toHaveProperty("status");
      // Narrowing type for NextResponse check
      if ("status" in result && typeof result.status === "number") {
        expect(result.status).toBe(401);
      }
    });

    it("returns user ID and API key ID for valid API key within quota (T324)", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "key-123",
                    user_id: "user-789",
                    revoked_at: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      // Mock quota check to return allowed
      mockCheckApiQuota.mockResolvedValue({
        allowed: true,
        currentUsage: 50,
        limit: 100,
        resetAt: "2026-02-01T00:00:00.000Z",
        planName: "Free",
      });

      // Mock rate limit check to allow the request (T501)
      mockCheckApiRateLimit.mockResolvedValue({
        allowed: true,
        limit: 60,
        remaining: 59,
        resetAt: 9999999999,
      });

      const request = new NextRequest("http://localhost/api/v1/indicators", {
        headers: { Authorization: "Bearer mc_valid_api_key_here" },
      });

      const result = await authenticateApiRequest(request);

      // Should return object with userId, apiKeyId, and rateLimit
      expect(result).toEqual({
        userId: "user-789",
        apiKeyId: "key-123",
        rateLimit: { allowed: true, limit: 60, remaining: 59, resetAt: 9999999999 },
      });
      expect(mockCheckApiQuota).toHaveBeenCalledWith("user-789");
      expect(mockCheckApiRateLimit).toHaveBeenCalledWith("key-123", "Free");
    });

    it("returns 429 error when quota is exceeded (T324)", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "key-123",
                    user_id: "user-quota-exceeded",
                    revoked_at: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      // Mock quota check to return not allowed
      const quotaResult = {
        allowed: false,
        currentUsage: 100,
        limit: 100,
        resetAt: "2026-02-01T00:00:00.000Z",
        planName: "Free",
      };
      mockCheckApiQuota.mockResolvedValue(quotaResult);
      mockFormatQuotaExceededMessage.mockReturnValue(
        "API quota exceeded. You have used 100 of 100 API calls."
      );

      const request = new NextRequest("http://localhost/api/v1/indicators", {
        headers: { Authorization: "Bearer mc_valid_api_key_here" },
      });

      const result = await authenticateApiRequest(request);

      // Should return a NextResponse with 429 status
      expect(result).toHaveProperty("status");
      if ("status" in result && typeof result.status === "number") {
        expect(result.status).toBe(429);
        const body = await (result as Response).json();
        expect(body.code).toBe("QUOTA_EXCEEDED");
        expect(body.quota).toEqual({
          current: 100,
          limit: 100,
          reset_at: "2026-02-01T00:00:00.000Z",
          plan: "Free",
        });
      }
    });
    it("returns 429 with Retry-After when rate limit is exceeded (T501)", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "key-rate-limited",
                    user_id: "user-rate-limited",
                    revoked_at: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: mockFrom,
      } as never);

      // Quota is fine
      mockCheckApiQuota.mockResolvedValue({
        allowed: true,
        currentUsage: 50,
        limit: 100,
        resetAt: "2026-02-01T00:00:00.000Z",
        planName: "Free",
      });

      // Rate limit is exceeded
      mockCheckApiRateLimit.mockResolvedValue({
        allowed: false,
        limit: 60,
        remaining: 0,
        resetAt: 9999999999,
      });

      const request = new NextRequest("http://localhost/api/v1/indicators", {
        headers: { Authorization: "Bearer mc_valid_api_key_here" },
      });

      const result = await authenticateApiRequest(request);

      expect(result).toHaveProperty("status");
      if ("status" in result && typeof result.status === "number") {
        expect(result.status).toBe(429);
        const body = await (result as Response).json();
        expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
        // Retry-After is set directly in auth.ts as seconds to wait (not via applyRateLimitHeaders)
        const headers = (result as Response).headers;
        const retryAfter = Number(headers.get("Retry-After"));
        // Should be positive seconds to wait (difference between resetAt and now)
        expect(retryAfter).toBeGreaterThan(0);
      }
    });
  });
});
