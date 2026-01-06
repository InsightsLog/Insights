import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addToWatchlist,
  removeFromWatchlist,
  toggleWatchlist,
} from "./watchlist";

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
const validIndicatorId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const mockUserId = "user-1234-5678-9abc-def012345678";

describe("addToWatchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid indicator ID format", async () => {
    const result = await addToWatchlist("invalid-id");

    expect(result).toEqual({
      success: false,
      error: "Invalid indicator ID format",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await addToWatchlist(validIndicatorId);

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

    const result = await addToWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully adds indicator to watchlist", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await addToWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { isWatching: true },
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("watchlist");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: mockUserId,
      indicator_id: validIndicatorId,
    });
  });

  it("returns success when indicator already in watchlist (unique violation)", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "23505", message: "Unique violation" } });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await addToWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { isWatching: true },
    });
  });

  it("returns error when indicator not found (foreign key violation)", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "23503", message: "FK violation" } });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await addToWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Indicator not found",
    });
  });

  it("returns error on generic database error", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "50000", message: "DB error" } });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await addToWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to add to watchlist",
    });
  });
});

describe("removeFromWatchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid indicator ID format", async () => {
    const result = await removeFromWatchlist("not-a-uuid");

    expect(result).toEqual({
      success: false,
      error: "Invalid indicator ID format",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await removeFromWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully removes indicator from watchlist", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEqIndicator = vi.fn().mockResolvedValue({ error: null });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqUser });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await removeFromWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { isWatching: false },
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("watchlist");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEqUser).toHaveBeenCalledWith("user_id", mockUserId);
    expect(mockEqIndicator).toHaveBeenCalledWith("indicator_id", validIndicatorId);
  });

  it("returns error on delete failure", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEqIndicator = vi
      .fn()
      .mockResolvedValue({ error: { message: "Delete failed" } });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqUser });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await removeFromWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to remove from watchlist",
    });
  });
});

describe("toggleWatchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid indicator ID format", async () => {
    const result = await toggleWatchlist("bad-uuid");

    expect(result).toEqual({
      success: false,
      error: "Invalid indicator ID format",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("adds indicator when not currently watching", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (returns null = not watching)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqIndicatorSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi.fn().mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });

    // Second call: insert
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { isWatching: true },
    });
    expect(mockSelect).toHaveBeenCalledWith("id");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: mockUserId,
      indicator_id: validIndicatorId,
    });
  });

  it("removes indicator when currently watching", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const existingWatchlistId = "watchlist-item-uuid-1234-567890abcdef";

    // First call: select (returns existing item)
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: existingWatchlistId },
      error: null,
    });
    const mockEqIndicatorSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi.fn().mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });

    // Second call: delete
    const mockEqId = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqId });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { isWatching: false },
    });
    expect(mockEqId).toHaveBeenCalledWith("id", existingWatchlistId);
  });

  it("returns error when select fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Select failed" } });
    const mockEqIndicatorSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi.fn().mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to check watchlist status",
    });
  });

  it("returns error when insert fails during toggle", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (not watching)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqIndicatorSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi.fn().mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });

    // Second call: insert fails
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "50000", message: "Insert failed" } });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to add to watchlist",
    });
  });

  it("returns error when delete fails during toggle", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const existingWatchlistId = "watchlist-item-uuid-1234-567890abcdef";

    // First call: select (returns existing item)
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: existingWatchlistId },
      error: null,
    });
    const mockEqIndicatorSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi.fn().mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });

    // Second call: delete fails
    const mockEqId = vi
      .fn()
      .mockResolvedValue({ error: { message: "Delete failed" } });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqId });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to remove from watchlist",
    });
  });

  it("returns error when indicator not found during insert", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (not watching)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqIndicatorSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi.fn().mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });

    // Second call: insert fails with FK violation
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "23503", message: "FK violation" } });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleWatchlist(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Indicator not found",
    });
  });
});
