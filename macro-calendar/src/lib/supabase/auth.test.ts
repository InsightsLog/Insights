import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentUser, type UserProfile } from "./auth";

// Mock the createSupabaseServerClient function
vi.mock("./server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// Import the mocked function to control its behavior
import { createSupabaseServerClient } from "./server";
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

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
