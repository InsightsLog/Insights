import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminUsers } from "./admin-users";

// Mock the auth module
vi.mock("@/lib/supabase/auth", () => ({
  checkAdminRole: vi.fn(),
}));

// Mock the service-role module
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

import { checkAdminRole } from "@/lib/supabase/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
const mockCheckAdminRole = vi.mocked(checkAdminRole);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

// Test UUIDs
const T = {
  admin: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  user1: "11111111-1111-4111-a111-111111111111",
  user2: "22222222-2222-4222-a222-222222222222",
};

// Helper: build a Supabase mock that handles the chained query builder
function buildMockSupabase({
  profiles = { data: [], error: null, count: 0 },
  roles = { data: [], error: null },
  subscriptions = { data: [], error: null },
  apiKeys = { data: [], error: null },
}: {
  profiles?: { data: unknown[]; error: unknown; count: number };
  roles?: { data: unknown[]; error: unknown };
  subscriptions?: { data: unknown[]; error: unknown };
  apiKeys?: { data: unknown[]; error: unknown };
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue(profiles),
              ilike: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue(profiles),
              }),
            }),
          }),
        };
      }
      if (table === "user_roles") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue(roles),
          }),
        };
      }
      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue(subscriptions),
            }),
          }),
        };
      }
      if (table === "api_keys") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue(apiKeys),
            }),
          }),
        };
      }
      return {};
    }),
  };
}

describe("getAdminUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({ isAdmin: false, userId: T.user1 });

    const result = await getAdminUsers();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("returns empty array when no users exist", async () => {
    mockCheckAdminRole.mockResolvedValue({ isAdmin: true, userId: T.admin });
    mockCreateSupabaseServiceClient.mockReturnValue(
      buildMockSupabase({ profiles: { data: [], error: null, count: 0 } }) as never
    );

    const result = await getAdminUsers();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.users).toEqual([]);
      expect(result.data.total).toBe(0);
    }
  });

  it("returns users with plan, subscription status, api key count, and role", async () => {
    mockCheckAdminRole.mockResolvedValue({ isAdmin: true, userId: T.admin });

    const mockProfiles = [
      {
        id: T.user1,
        email: "admin@example.com",
        display_name: "Admin User",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: T.user2,
        email: "user@example.com",
        display_name: null,
        created_at: "2026-01-05T00:00:00Z",
      },
    ];

    mockCreateSupabaseServiceClient.mockReturnValue(
      buildMockSupabase({
        profiles: { data: mockProfiles, error: null, count: 2 },
        roles: {
          data: [{ user_id: T.user1, role: "admin" }],
          error: null,
        },
        subscriptions: {
          data: [
            {
              user_id: T.user1,
              status: "active",
              created_at: "2026-01-01T00:00:00Z",
              plans: { name: "Pro" },
            },
          ],
          error: null,
        },
        apiKeys: {
          data: [
            { user_id: T.user1 },
            { user_id: T.user1 },
            { user_id: T.user2 },
          ],
          error: null,
        },
      }) as never
    );

    const result = await getAdminUsers();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(2);
      expect(result.data.users).toHaveLength(2);

      const adminUser = result.data.users.find((u) => u.id === T.user1);
      expect(adminUser?.role).toBe("admin");
      expect(adminUser?.plan_name).toBe("Pro");
      expect(adminUser?.subscription_status).toBe("active");
      expect(adminUser?.api_key_count).toBe(2);

      const regularUser = result.data.users.find((u) => u.id === T.user2);
      expect(regularUser?.role).toBeNull();
      expect(regularUser?.plan_name).toBeNull();
      expect(regularUser?.subscription_status).toBeNull();
      expect(regularUser?.api_key_count).toBe(1);
    }
  });

  it("returns error when profiles query fails", async () => {
    mockCheckAdminRole.mockResolvedValue({ isAdmin: true, userId: T.admin });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockCreateSupabaseServiceClient.mockReturnValue(
      buildMockSupabase({
        profiles: {
          data: [],
          error: { message: "Database error" },
          count: 0,
        },
      }) as never
    );

    const result = await getAdminUsers();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Failed to fetch users");
    }
    consoleErrorSpy.mockRestore();
  });

  it("returns correct page and limit in result", async () => {
    mockCheckAdminRole.mockResolvedValue({ isAdmin: true, userId: T.admin });
    mockCreateSupabaseServiceClient.mockReturnValue(
      buildMockSupabase({ profiles: { data: [], error: null, count: 120 } }) as never
    );

    const result = await getAdminUsers({ page: 2, limit: 50 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(50);
      expect(result.data.total).toBe(120);
    }
  });

  it("prefers active subscription over other statuses", async () => {
    mockCheckAdminRole.mockResolvedValue({ isAdmin: true, userId: T.admin });

    const mockProfiles = [
      {
        id: T.user1,
        email: "user@example.com",
        display_name: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    mockCreateSupabaseServiceClient.mockReturnValue(
      buildMockSupabase({
        profiles: { data: mockProfiles, error: null, count: 1 },
        subscriptions: {
          data: [
            {
              user_id: T.user1,
              status: "canceled",
              created_at: "2026-01-10T00:00:00Z",
              plans: { name: "Pro" },
            },
            {
              user_id: T.user1,
              status: "active",
              created_at: "2026-01-01T00:00:00Z",
              plans: { name: "Plus" },
            },
          ],
          error: null,
        },
      }) as never
    );

    const result = await getAdminUsers();

    expect(result.success).toBe(true);
    if (result.success) {
      // The "canceled" entry comes first (most recent), but "active" should be preferred
      expect(result.data.users[0].subscription_status).toBe("active");
      expect(result.data.users[0].plan_name).toBe("Plus");
    }
  });

  it("returns error for invalid page number", async () => {
    mockCheckAdminRole.mockResolvedValue({ isAdmin: true, userId: T.admin });

    const result = await getAdminUsers({ page: 0 });

    expect(result.success).toBe(false);
  });
});
