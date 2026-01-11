import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getApiKeys,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  validateApiKey,
} from "./api-keys";

// Mock the createSupabaseServerClient function
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// Import the mocked function to control its behavior
import { createSupabaseServerClient } from "@/lib/supabase/server";
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

// Helper to create a mock Supabase client
function createMockSupabase(options: {
  user?: { id: string } | null;
  authError?: Error | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user ?? null },
        error: options.authError ?? null,
      }),
    },
    from: vi.fn(),
  };
}

// Valid UUID for testing
const mockUserId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const mockKeyId = "b2c3d4e5-f6a7-8901-bcde-f23456789012";

describe("getApiKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getApiKeys();

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when auth returns error", async () => {
    const mockSupabase = createMockSupabase({
      user: null,
      authError: new Error("Auth failed"),
    });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getApiKeys();

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully returns empty array when no API keys", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getApiKeys();

    expect(result).toEqual({
      success: true,
      data: [],
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("api_keys");
    expect(mockSelect).toHaveBeenCalledWith(
      "id, name, created_at, last_used_at, revoked_at"
    );
  });

  it("successfully returns user API keys", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockKeys = [
      {
        id: mockKeyId,
        name: "Test Key",
        created_at: "2026-01-11T00:00:00Z",
        last_used_at: null,
        revoked_at: null,
      },
    ];
    const mockOrder = vi.fn().mockResolvedValue({ data: mockKeys, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getApiKeys();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Test Key");
      expect(result.data[0].key_prefix).toBe("mc_****");
    }
  });

  it("returns error on database failure", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockOrder = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "DB error" } });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getApiKeys();

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch API keys",
    });
  });
});

describe("createApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for empty name", async () => {
    const result = await createApiKey("");

    expect(result).toEqual({
      success: false,
      error: "Name is required",
    });
  });

  it("returns error for name exceeding max length", async () => {
    const longName = "a".repeat(101);
    const result = await createApiKey(longName);

    expect(result).toEqual({
      success: false,
      error: "Name must be 100 characters or less",
    });
  });

  it("returns error for invalid name characters", async () => {
    const result = await createApiKey("Test Key @#$%");

    expect(result).toEqual({
      success: false,
      error: "Name can only contain letters, numbers, spaces, hyphens, and underscores",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await createApiKey("Test Key");

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully creates API key", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockCreatedKey = {
      id: mockKeyId,
      name: "Test Key",
      created_at: "2026-01-11T00:00:00Z",
    };
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: mockCreatedKey, error: null });
    const mockSelectReturn = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelectReturn });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await createApiKey("Test Key");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(mockKeyId);
      expect(result.data.name).toBe("Test Key");
      // Key should start with mc_ prefix
      expect(result.data.key).toMatch(/^mc_[a-f0-9]{32}$/);
    }
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: mockUserId,
        name: "Test Key",
        key_hash: expect.any(String),
      })
    );
  });

  it("returns error on database failure", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "50000", message: "DB error" } });
    const mockSelectReturn = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelectReturn });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await createApiKey("Test Key");

    expect(result).toEqual({
      success: false,
      error: "Failed to create API key",
    });
  });

  it("returns retry error on unique constraint violation", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "23505", message: "Unique violation" } });
    const mockSelectReturn = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelectReturn });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await createApiKey("Test Key");

    expect(result).toEqual({
      success: false,
      error: "Failed to create API key. Please try again.",
    });
  });
});

describe("revokeApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid key ID format", async () => {
    const result = await revokeApiKey("invalid-id");

    expect(result).toEqual({
      success: false,
      error: "Invalid API key ID",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await revokeApiKey(mockKeyId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when key not found", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "PGRST116", message: "No rows" } });
    const mockEqUser = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqId });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await revokeApiKey(mockKeyId);

    expect(result).toEqual({
      success: false,
      error: "API key not found",
    });
  });

  it("returns error when key is already revoked", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: mockKeyId, revoked_at: "2026-01-11T00:00:00Z" },
      error: null,
    });
    const mockEqUser = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqId });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await revokeApiKey(mockKeyId);

    expect(result).toEqual({
      success: false,
      error: "API key is already revoked",
    });
  });

  it("successfully revokes API key", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    
    // First call: select to check key exists
    const mockSingleSelect = vi.fn().mockResolvedValue({
      data: { id: mockKeyId, revoked_at: null },
      error: null,
    });
    const mockEqUser = vi.fn().mockReturnValue({ single: mockSingleSelect });
    const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqId });

    // Second call: update to revoke
    const revokedAt = "2026-01-11T01:00:00.000Z";
    const mockSingleUpdate = vi.fn().mockResolvedValue({
      data: { revoked_at: revokedAt },
      error: null,
    });
    const mockSelectUpdate = vi.fn().mockReturnValue({ single: mockSingleUpdate });
    const mockEqUpdate = vi.fn().mockReturnValue({ select: mockSelectUpdate });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await revokeApiKey(mockKeyId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.revoked_at).toBe(revokedAt);
    }
    expect(mockUpdate).toHaveBeenCalledWith({
      revoked_at: expect.any(String),
    });
  });
});

describe("deleteApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid key ID format", async () => {
    const result = await deleteApiKey("not-a-uuid");

    expect(result).toEqual({
      success: false,
      error: "Invalid API key ID",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await deleteApiKey(mockKeyId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully deletes API key", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEqUser = vi.fn().mockResolvedValue({ error: null });
    const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqId });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await deleteApiKey(mockKeyId);

    expect(result).toEqual({
      success: true,
      data: undefined,
    });
  });
});

describe("validateApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for empty key", async () => {
    const result = await validateApiKey("");

    expect(result).toBeNull();
  });

  it("returns null for key with wrong prefix", async () => {
    const result = await validateApiKey("wrong_prefix_key");

    expect(result).toBeNull();
  });

  it("returns null for non-string key", async () => {
    // @ts-expect-error - Testing invalid input
    const result = await validateApiKey(123);

    expect(result).toBeNull();
  });

  it("returns null when key not found in database", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await validateApiKey("mc_1234567890abcdef1234567890abcdef");

    expect(result).toBeNull();
  });

  it("returns null when key is revoked", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: mockUserId, revoked_at: "2026-01-11T00:00:00Z" },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await validateApiKey("mc_1234567890abcdef1234567890abcdef");

    expect(result).toBeNull();
  });

  it("returns user_id for valid active key", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    
    // First call: select to find key
    const mockSingle = vi.fn().mockResolvedValue({
      data: { user_id: mockUserId, revoked_at: null },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    // Second call: update last_used_at (async, returns a promise)
    const mockUpdatePromise = Promise.resolve();
    const mockEqUpdate = vi.fn().mockReturnValue(mockUpdatePromise);
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await validateApiKey("mc_1234567890abcdef1234567890abcdef");

    expect(result).toBe(mockUserId);
  });
});
