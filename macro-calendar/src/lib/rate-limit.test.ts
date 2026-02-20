import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkApiRateLimit,
  applyRateLimitHeaders,
  FREE_RATE_LIMIT,
  PRO_RATE_LIMIT,
} from "./rate-limit";
import { NextResponse } from "next/server";

// Mock the supabase service client
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

describe("checkApiRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockSupabaseCount(count: number | null, error: object | null = null) {
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count, error }),
          }),
        }),
      }),
    } as never);
  }

  it("allows the request when under the free rate limit", async () => {
    mockSupabaseCount(30);

    const result = await checkApiRateLimit("key-1", "Free");

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(FREE_RATE_LIMIT);
    expect(result.remaining).toBe(30);
  });

  it("blocks the request when at the free rate limit", async () => {
    mockSupabaseCount(60);

    const result = await checkApiRateLimit("key-1", "Free");

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(FREE_RATE_LIMIT);
    expect(result.remaining).toBe(0);
  });

  it("uses pro rate limit for non-free plans", async () => {
    mockSupabaseCount(300);

    const result = await checkApiRateLimit("key-1", "Pro");

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(PRO_RATE_LIMIT);
    expect(result.remaining).toBe(300);
  });

  it("blocks pro plan request when at the pro rate limit", async () => {
    mockSupabaseCount(600);

    const result = await checkApiRateLimit("key-1", "Pro");

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(PRO_RATE_LIMIT);
    expect(result.remaining).toBe(0);
  });

  it("uses pro rate limit for Enterprise plan", async () => {
    mockSupabaseCount(100);

    const result = await checkApiRateLimit("key-1", "Enterprise");

    expect(result.limit).toBe(PRO_RATE_LIMIT);
    expect(result.allowed).toBe(true);
  });

  it("uses pro rate limit for Plus plan", async () => {
    mockSupabaseCount(100);

    const result = await checkApiRateLimit("key-1", "Plus");

    expect(result.limit).toBe(PRO_RATE_LIMIT);
  });

  it("sets remaining to 0 when count exceeds limit", async () => {
    mockSupabaseCount(70); // Above free limit of 60

    const result = await checkApiRateLimit("key-1", "Free");

    expect(result.remaining).toBe(0);
    expect(result.allowed).toBe(false);
  });

  it("includes a resetAt Unix timestamp approximately 60s in the future", async () => {
    mockSupabaseCount(0);
    const before = Math.floor(Date.now() / 1000);

    const result = await checkApiRateLimit("key-1", "Free");

    const after = Math.floor(Date.now() / 1000);
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 59);
    expect(result.resetAt).toBeLessThanOrEqual(after + 61);
  });

  it("fails open (allows request) when the database returns an error", async () => {
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({
              count: null,
              error: { message: "connection failed" },
            }),
          }),
        }),
      }),
    } as never);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await checkApiRateLimit("key-1", "Free");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(FREE_RATE_LIMIT);
    consoleSpy.mockRestore();
  });
});

describe("applyRateLimitHeaders", () => {
  it("sets X-RateLimit-Limit header", () => {
    const response = NextResponse.json({});
    const rateLimit = { allowed: true, limit: 60, remaining: 45, resetAt: 1700000000 };

    applyRateLimitHeaders(response, rateLimit);

    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
  });

  it("sets X-RateLimit-Remaining header", () => {
    const response = NextResponse.json({});
    const rateLimit = { allowed: true, limit: 60, remaining: 45, resetAt: 1700000000 };

    applyRateLimitHeaders(response, rateLimit);

    expect(response.headers.get("X-RateLimit-Remaining")).toBe("45");
  });

  it("sets X-RateLimit-Reset header", () => {
    const response = NextResponse.json({});
    const rateLimit = { allowed: true, limit: 60, remaining: 45, resetAt: 1700000000 };

    applyRateLimitHeaders(response, rateLimit);

    expect(response.headers.get("X-RateLimit-Reset")).toBe("1700000000");
  });

  it("returns the same response object", () => {
    const response = NextResponse.json({});
    const rateLimit = { allowed: false, limit: 60, remaining: 0, resetAt: 1700000000 };

    const result = applyRateLimitHeaders(response, rateLimit);

    expect(result).toBe(response);
  });
});
