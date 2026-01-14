import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkApiQuota,
  formatQuotaExceededMessage,
  type QuotaCheckResult,
} from "./quota";

// Mock the createSupabaseServiceClient function
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

// Import the mocked function to control its behavior
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

describe("API Quota Enforcement (T324)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Date mock
    vi.useRealTimers();
  });

  describe("checkApiQuota", () => {
    it("returns allowed=true when user has no API keys", async () => {
      // Mock subscriptions query (no subscription)
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: "PGRST116", message: "No rows returned" },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [],
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

      const result = await checkApiQuota("user-123");

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(0);
      expect(result.limit).toBe(100); // Default Free tier limit
      expect(result.planName).toBe("Free");
    });

    it("returns allowed=true when user is under quota", async () => {
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      status: "active",
                      plans: {
                        name: "Pro",
                        api_calls_limit: 10000,
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ id: "key-1" }, { id: "key-2" }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "request_logs") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({
                    count: 500,
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

      const result = await checkApiQuota("user-456");

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(500);
      expect(result.limit).toBe(10000);
      expect(result.planName).toBe("Pro");
    });

    it("returns allowed=false when user exceeds quota", async () => {
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      status: "active",
                      plans: {
                        name: "Free",
                        api_calls_limit: 100,
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ id: "key-1" }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "request_logs") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({
                    count: 100, // At limit
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

      const result = await checkApiQuota("user-789");

      expect(result.allowed).toBe(false);
      expect(result.currentUsage).toBe(100);
      expect(result.limit).toBe(100);
    });

    it("uses default Free tier limit when no subscription exists", async () => {
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: "PGRST116", message: "No rows returned" },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ id: "key-1" }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "request_logs") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({
                    count: 50,
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

      const result = await checkApiQuota("user-no-sub");

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100); // Default Free tier limit
      expect(result.planName).toBe("Free");
    });

    it("handles database error gracefully (fail open)", async () => {
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      status: "active",
                      plans: { name: "Pro", api_calls_limit: 10000 },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ id: "key-1" }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "request_logs") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({
                    count: null,
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

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await checkApiQuota("user-db-error");

      expect(result.allowed).toBe(true); // Fail open
      expect(result.currentUsage).toBe(0);
      
      consoleSpy.mockRestore();
    });

    it("includes resetAt timestamp for next month", async () => {
      // Set a fixed date for consistent testing
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: "PGRST116" },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [],
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

      const result = await checkApiQuota("user-reset");

      // Should be February 1, 2026
      expect(result.resetAt).toBe("2026-02-01T00:00:00.000Z");
    });

    it("handles plans returned as array (Supabase embedded relation)", async () => {
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      status: "active",
                      // Supabase sometimes returns embedded relations as arrays
                      plans: [{
                        name: "Enterprise",
                        api_calls_limit: 100000,
                      }],
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ id: "key-1" }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "request_logs") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({
                    count: 5000,
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

      const result = await checkApiQuota("user-enterprise");

      expect(result.limit).toBe(100000);
      expect(result.planName).toBe("Enterprise");
    });

    it("only counts calls from non-revoked API keys", async () => {
      const mockFrom = vi.fn().mockImplementation((table) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: "PGRST116" },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "api_keys") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                // is: vi.fn() checks for revoked_at IS NULL
                is: vi.fn().mockResolvedValue({
                  data: [{ id: "active-key" }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "request_logs") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({
                    count: 25,
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

      const result = await checkApiQuota("user-with-revoked");

      expect(result.currentUsage).toBe(25);
    });
  });

  describe("formatQuotaExceededMessage", () => {
    it("formats message with quota details", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

      const result: QuotaCheckResult = {
        allowed: false,
        currentUsage: 100,
        limit: 100,
        resetAt: "2026-02-01T00:00:00.000Z",
        planName: "Free",
      };

      const message = formatQuotaExceededMessage(result);

      expect(message).toContain("API quota exceeded");
      expect(message).toContain("100 of 100");
      expect(message).toContain("Free plan");
      expect(message).toContain("February 1, 2026");
      expect(message).toContain("/settings/billing");
    });

    it("includes correct plan name in message", () => {
      const result: QuotaCheckResult = {
        allowed: false,
        currentUsage: 10000,
        limit: 10000,
        resetAt: "2026-02-01T00:00:00.000Z",
        planName: "Pro",
      };

      const message = formatQuotaExceededMessage(result);

      expect(message).toContain("Pro plan");
      expect(message).toContain("10000 of 10000");
    });

    it("includes upgrade prompt in message", () => {
      const result: QuotaCheckResult = {
        allowed: false,
        currentUsage: 50,
        limit: 50,
        resetAt: "2026-03-01T00:00:00.000Z",
        planName: "Plus",
      };

      const message = formatQuotaExceededMessage(result);

      expect(message).toContain("Upgrade your plan");
      expect(message).toContain("/settings/billing");
    });
  });
});
