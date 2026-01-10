import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentUser, checkAdminRole, logAuditAction, type UserProfile } from "./auth";

// Mock the createSupabaseServerClient function
vi.mock("./server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// Mock the createSupabaseServiceClient function
vi.mock("./service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

// Import the mocked functions to control their behavior
import { createSupabaseServerClient } from "./server";
import { createSupabaseServiceClient } from "./service-role";
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no user is logged in", async () => {
    // Mock Supabase client that returns no user
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentUser();

    expect(result).toBeNull();
    expect(mockSupabase.auth.getUser).toHaveBeenCalledOnce();
  });

  it("returns null when auth.getUser returns an error", async () => {
    // Mock Supabase client that returns an auth error
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("Auth error"),
        }),
      },
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });

  it("returns user profile when logged in", async () => {
    const mockUserId = "test-user-id-123";
    const mockProfile: UserProfile = {
      id: mockUserId,
      email: "test@example.com",
      display_name: "Test User",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    // Mock Supabase client that returns a user and profile
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
      from: mockFrom,
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentUser();

    expect(result).toEqual(mockProfile);
    expect(mockSupabase.auth.getUser).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledWith("profiles");
  });

  it("returns null when profile fetch fails", async () => {
    const mockUserId = "test-user-id-123";

    // Mock Supabase client that returns a user but profile fetch fails
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("Profile not found"),
          }),
        }),
      }),
    });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
      from: mockFrom,
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });

  it("returns null when profile does not exist", async () => {
    const mockUserId = "test-user-id-123";

    // Mock Supabase client that returns a user but no profile
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
      from: mockFrom,
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentUser();

    expect(result).toBeNull();
  });

  it("returns profile with null display_name when not set", async () => {
    const mockUserId = "test-user-id-456";
    const mockProfile: UserProfile = {
      id: mockUserId,
      email: "another@example.com",
      display_name: null,
      created_at: "2024-02-15T12:00:00Z",
      updated_at: "2024-02-15T12:00:00Z",
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
      from: mockFrom,
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentUser();

    expect(result).toEqual(mockProfile);
    expect(result?.display_name).toBeNull();
  });
});

describe("checkAdminRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isAdmin: false when not authenticated", async () => {
    // Mock server client that returns no user
    const mockServerSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockServerSupabase as never);

    const result = await checkAdminRole();

    expect(result.isAdmin).toBe(false);
    expect(result.userId).toBeNull();
    expect(result.error).toBe("Not authenticated");
  });

  it("returns isAdmin: false when auth error occurs", async () => {
    const mockServerSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("Auth error"),
        }),
      },
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockServerSupabase as never);

    const result = await checkAdminRole();

    expect(result.isAdmin).toBe(false);
    expect(result.userId).toBeNull();
    expect(result.error).toBe("Not authenticated");
  });

  it("returns isAdmin: true when user has admin role", async () => {
    const mockUserId = "admin-user-id-123";

    // Mock server client for auth
    const mockServerSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockServerSupabase as never);

    // Mock service client for role check
    const mockServiceFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: "admin" },
            error: null,
          }),
        }),
      }),
    });
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: mockServiceFrom,
    } as never);

    const result = await checkAdminRole();

    expect(result.isAdmin).toBe(true);
    expect(result.userId).toBe(mockUserId);
    expect(result.error).toBeUndefined();
    expect(mockServiceFrom).toHaveBeenCalledWith("user_roles");
  });

  it("returns isAdmin: false when user has 'user' role", async () => {
    const mockUserId = "regular-user-id-456";

    const mockServerSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockServerSupabase as never);

    const mockServiceFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: "user" },
            error: null,
          }),
        }),
      }),
    });
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: mockServiceFrom,
    } as never);

    const result = await checkAdminRole();

    expect(result.isAdmin).toBe(false);
    expect(result.userId).toBe(mockUserId);
    expect(result.error).toBeUndefined();
  });

  it("returns isAdmin: false when user has no role entry (PGRST116)", async () => {
    const mockUserId = "no-role-user-id-789";

    const mockServerSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockServerSupabase as never);

    // PGRST116 is "no rows returned" error
    const mockServiceFrom = vi.fn().mockReturnValue({
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
      from: mockServiceFrom,
    } as never);

    const result = await checkAdminRole();

    expect(result.isAdmin).toBe(false);
    expect(result.userId).toBe(mockUserId);
    expect(result.error).toBeUndefined();
  });

  it("returns isAdmin: false with error when role fetch fails", async () => {
    const mockUserId = "user-id-error";

    const mockServerSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
    };
    mockCreateSupabaseServerClient.mockResolvedValue(mockServerSupabase as never);

    const mockServiceFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "SOME_ERROR", message: "Database error" },
          }),
        }),
      }),
    });
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: mockServiceFrom,
    } as never);

    const result = await checkAdminRole();

    expect(result.isAdmin).toBe(false);
    expect(result.userId).toBe(mockUserId);
    expect(result.error).toBe("Database error");
  });
});

describe("logAuditAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when audit log insert succeeds", async () => {
    const mockServiceFrom = vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: mockServiceFrom,
    } as never);

    const result = await logAuditAction(
      "user-123",
      "upload",
      "release",
      null,
      { filename: "test.csv", rowCount: 10 }
    );

    expect(result).toBe(true);
    expect(mockServiceFrom).toHaveBeenCalledWith("audit_log");
    expect(mockServiceFrom().insert).toHaveBeenCalledWith({
      user_id: "user-123",
      action: "upload",
      resource_type: "release",
      resource_id: null,
      metadata: { filename: "test.csv", rowCount: 10 },
    });
  });

  it("returns true with resource_id when provided", async () => {
    const mockServiceFrom = vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: mockServiceFrom,
    } as never);

    const result = await logAuditAction(
      "user-456",
      "role_change",
      "user_role",
      "resource-uuid-789",
      { fromRole: "user", toRole: "admin" }
    );

    expect(result).toBe(true);
    expect(mockServiceFrom().insert).toHaveBeenCalledWith({
      user_id: "user-456",
      action: "role_change",
      resource_type: "user_role",
      resource_id: "resource-uuid-789",
      metadata: { fromRole: "user", toRole: "admin" },
    });
  });

  it("returns true with empty metadata when not provided", async () => {
    const mockServiceFrom = vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: mockServiceFrom,
    } as never);

    const result = await logAuditAction(
      "user-111",
      "delete",
      "indicator"
    );

    expect(result).toBe(true);
    expect(mockServiceFrom().insert).toHaveBeenCalledWith({
      user_id: "user-111",
      action: "delete",
      resource_type: "indicator",
      resource_id: null,
      metadata: {},
    });
  });

  it("returns false when audit log insert fails", async () => {
    // Mock console.error to avoid noise in test output
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockServiceFrom = vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Insert failed" },
      }),
    });
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: mockServiceFrom,
    } as never);

    const result = await logAuditAction(
      "user-error",
      "upload",
      "release"
    );

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to log audit action:",
      { message: "Insert failed" }
    );

    consoleErrorSpy.mockRestore();
  });
});
