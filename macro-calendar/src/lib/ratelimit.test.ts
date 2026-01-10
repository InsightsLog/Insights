import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getRateLimitEnv", () => {
  // Store original env values
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules before each test to ensure fresh env parsing
    vi.resetModules();
    // Create a fresh copy of process.env for each test
    process.env = { ...originalEnv };
    // Set required env vars for the module to load
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
  });

  afterEach(() => {
    // Restore original env after each test
    process.env = originalEnv;
  });

  it("returns null when no Upstash environment variables are set", async () => {
    // Ensure Upstash vars are not set
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    // Import the function fresh to pick up new env values
    const { getRateLimitEnv } = await import("./env");
    const result = getRateLimitEnv();

    expect(result).toBeNull();
  });

  it("returns null when only UPSTASH_REDIS_REST_URL is set", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.upstash.io";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { getRateLimitEnv } = await import("./env");
    const result = getRateLimitEnv();

    expect(result).toBeNull();
  });

  it("returns null when only UPSTASH_REDIS_REST_TOKEN is set", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const { getRateLimitEnv } = await import("./env");
    const result = getRateLimitEnv();

    expect(result).toBeNull();
  });

  it("returns url and token when both are set", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const { getRateLimitEnv } = await import("./env");
    const result = getRateLimitEnv();

    expect(result).toEqual({
      url: "https://redis.upstash.io",
      token: "test-token",
    });
  });

  it("rejects invalid URL format for UPSTASH_REDIS_REST_URL", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "not-a-valid-url";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const { getRateLimitEnv } = await import("./env");

    expect(() => getRateLimitEnv()).toThrow();
  });
});
