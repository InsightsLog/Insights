import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getRecentUploads,
  getRecentAuditLog,
  getUsers,
  getAdminDashboardData,
} from "./admin";

// Mock the auth module
vi.mock("@/lib/supabase/auth", () => ({
  checkAdminRole: vi.fn(),
}));

// Mock the service-role module
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

// Import the mocked functions
import { checkAdminRole } from "@/lib/supabase/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
const mockCheckAdminRole = vi.mocked(checkAdminRole);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

// Test UUIDs for mock data
const TEST_UUIDS = {
  user1: "11111111-1111-4111-a111-111111111111",
  user2: "22222222-2222-4222-a222-222222222222",
  admin: "33333333-3333-4333-a333-333333333333",
  audit1: "44444444-4444-4444-a444-444444444444",
  audit2: "55555555-5555-4555-a555-555555555555",
  audit3: "66666666-6666-4666-a666-666666666666",
  resource1: "77777777-7777-4777-a777-777777777777",
  resource2: "88888888-8888-4888-a888-888888888888",
};

describe("getRecentUploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user1,
    });

    const result = await getRecentUploads();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("returns empty array when no uploads exist", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getRecentUploads();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it("returns upload entries with user emails", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockAuditData = [
      {
        id: TEST_UUIDS.audit1,
        user_id: TEST_UUIDS.user1,
        action: "upload",
        resource_type: "release",
        resource_id: null,
        metadata: { filename: "test.csv", rowCount: 10 },
        created_at: "2026-01-10T12:00:00Z",
      },
    ];

    const mockProfiles = [{ id: TEST_UUIDS.user1, email: "user1@example.com" }];

    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === "audit_log") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: mockAuditData,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: mockProfiles,
                error: null,
              }),
            }),
          };
        }
        return {};
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getRecentUploads();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].user_email).toBe("user1@example.com");
      expect(result.data[0].action).toBe("upload");
    }
  });

  it("returns error when database query fails", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
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
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getRecentUploads();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Failed to fetch recent uploads");
    }

    consoleErrorSpy.mockRestore();
  });
});

describe("getRecentAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: null,
      error: "Not authenticated",
    });

    const result = await getRecentAuditLog();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("returns all action types in audit log", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockAuditData = [
      {
        id: TEST_UUIDS.audit1,
        user_id: TEST_UUIDS.user1,
        action: "upload",
        resource_type: "release",
        resource_id: null,
        metadata: {},
        created_at: "2026-01-10T12:00:00Z",
      },
      {
        id: TEST_UUIDS.audit2,
        user_id: TEST_UUIDS.user2,
        action: "role_change",
        resource_type: "user_role",
        resource_id: TEST_UUIDS.resource1,
        metadata: { fromRole: "user", toRole: "admin" },
        created_at: "2026-01-10T11:00:00Z",
      },
      {
        id: TEST_UUIDS.audit3,
        user_id: TEST_UUIDS.user1,
        action: "delete",
        resource_type: "indicator",
        resource_id: TEST_UUIDS.resource2,
        metadata: {},
        created_at: "2026-01-10T10:00:00Z",
      },
    ];

    const mockProfiles = [
      { id: TEST_UUIDS.user1, email: "user1@example.com" },
      { id: TEST_UUIDS.user2, email: "user2@example.com" },
    ];

    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === "audit_log") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockAuditData,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: mockProfiles,
                error: null,
              }),
            }),
          };
        }
        return {};
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getRecentAuditLog();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
      expect(result.data[0].action).toBe("upload");
      expect(result.data[1].action).toBe("role_change");
      expect(result.data[2].action).toBe("delete");
    }
  });

  it("handles null user_id gracefully", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockAuditData = [
      {
        id: TEST_UUIDS.audit1,
        user_id: null,
        action: "upload",
        resource_type: "release",
        resource_id: null,
        metadata: {},
        created_at: "2026-01-10T12:00:00Z",
      },
    ];

    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === "audit_log") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockAuditData,
                  error: null,
                }),
              }),
            }),
          };
        }
        // profiles query should not be called when there are no user IDs
        return {};
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getRecentAuditLog();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].user_id).toBeNull();
      expect(result.data[0].user_email).toBeNull();
    }
  });
});

describe("getUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user1,
    });

    const result = await getUsers();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("returns users with their roles", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockProfiles = [
      {
        id: TEST_UUIDS.user1,
        email: "admin@example.com",
        display_name: "Admin User",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: TEST_UUIDS.user2,
        email: "regular@example.com",
        display_name: null,
        created_at: "2026-01-05T00:00:00Z",
      },
    ];

    const mockRoles = [
      {
        user_id: TEST_UUIDS.user1,
        role: "admin",
        granted_at: "2026-01-02T00:00:00Z",
      },
    ];

    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockProfiles,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: mockRoles,
                error: null,
              }),
            }),
          };
        }
        return {};
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getUsers();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].email).toBe("admin@example.com");
      expect(result.data[0].role).toBe("admin");
      expect(result.data[1].email).toBe("regular@example.com");
      expect(result.data[1].role).toBeNull();
    }
  });

  it("returns users with null role when no role entry exists", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockProfiles = [
      {
        id: TEST_UUIDS.user1,
        email: "newuser@example.com",
        display_name: null,
        created_at: "2026-01-10T00:00:00Z",
      },
    ];

    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockProfiles,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return {};
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getUsers();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].role).toBeNull();
      expect(result.data[0].role_granted_at).toBeNull();
    }
  });

  it("returns error when profiles query fails", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getUsers();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Failed to fetch users");
    }

    consoleErrorSpy.mockRestore();
  });

  it("continues with empty roles when roles query fails", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockProfiles = [
      {
        id: TEST_UUIDS.user1,
        email: "user@example.com",
        display_name: null,
        created_at: "2026-01-10T00:00:00Z",
      },
    ];

    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockProfiles,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Roles error" },
              }),
            }),
          };
        }
        return {};
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getUsers();

    // Should succeed but with null roles
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].role).toBeNull();
    }

    consoleErrorSpy.mockRestore();
  });
});

describe("getAdminDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: null,
    });

    const result = await getAdminDashboardData();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("returns combined dashboard data", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockAuditData = [
      {
        id: TEST_UUIDS.audit1,
        user_id: TEST_UUIDS.user1,
        action: "upload",
        resource_type: "release",
        resource_id: null,
        metadata: { filename: "test.csv" },
        created_at: "2026-01-10T12:00:00Z",
      },
    ];

    const mockProfiles = [
      {
        id: TEST_UUIDS.user1,
        email: "user@example.com",
        display_name: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === "audit_log") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: mockAuditData,
                    error: null,
                  }),
                }),
              }),
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockAuditData,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: mockProfiles,
                error: null,
              }),
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockProfiles,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return {};
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getAdminDashboardData();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recentUploads).toBeDefined();
      expect(result.data.recentAuditLog).toBeDefined();
      expect(result.data.users).toBeDefined();
    }
  });
});
