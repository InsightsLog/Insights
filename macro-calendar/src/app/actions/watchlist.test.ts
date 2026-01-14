import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addToWatchlist,
  removeFromWatchlist,
  toggleWatchlist,
  addToOrgWatchlist,
  removeFromOrgWatchlist,
  getOrgWatchlist,
  toggleOrgWatchlist,
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
const validOrgId = "12345678-e5f6-7890-abcd-ef1234567890";
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

// ================== Organization Watchlist Tests ==================

describe("addToOrgWatchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid organization ID format", async () => {
    const result = await addToOrgWatchlist("invalid-org-id", validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Invalid organization ID format",
    });
  });

  it("returns error for invalid indicator ID format", async () => {
    const result = await addToOrgWatchlist(validOrgId, "invalid-id");

    expect(result).toEqual({
      success: false,
      error: "Invalid indicator ID format",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await addToOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully adds indicator to organization watchlist", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await addToOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { isWatching: true },
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("watchlist");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: mockUserId,
      indicator_id: validIndicatorId,
      org_id: validOrgId,
    });
  });

  it("returns success when indicator already in org watchlist (unique violation)", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "23505", message: "Unique violation" } });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await addToOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { isWatching: true },
    });
  });

  it("returns error when indicator or org not found (foreign key violation)", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "23503", message: "FK violation" } });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await addToOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Indicator or organization not found",
    });
  });

  it("returns error when not authorized (RLS violation)", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "42501", message: "RLS violation" } });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await addToOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authorized to modify organization watchlist",
    });
  });

  it("returns error on generic database error", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "50000", message: "DB error" } });
    mockSupabase.from.mockReturnValue({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await addToOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to add to organization watchlist",
    });
  });
});

describe("removeFromOrgWatchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid organization ID format", async () => {
    const result = await removeFromOrgWatchlist("invalid-org-id", validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Invalid organization ID format",
    });
  });

  it("returns error for invalid indicator ID format", async () => {
    const result = await removeFromOrgWatchlist(validOrgId, "invalid-id");

    expect(result).toEqual({
      success: false,
      error: "Invalid indicator ID format",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await removeFromOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully removes indicator from organization watchlist", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEqIndicator = vi.fn().mockResolvedValue({ error: null });
    const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqOrg });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await removeFromOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { isWatching: false },
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("watchlist");
    expect(mockEqOrg).toHaveBeenCalledWith("org_id", validOrgId);
    expect(mockEqIndicator).toHaveBeenCalledWith("indicator_id", validIndicatorId);
  });

  it("returns error when not authorized (RLS violation)", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEqIndicator = vi
      .fn()
      .mockResolvedValue({ error: { code: "42501", message: "RLS violation" } });
    const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqOrg });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await removeFromOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authorized to modify organization watchlist",
    });
  });

  it("returns error on delete failure", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEqIndicator = vi
      .fn()
      .mockResolvedValue({ error: { code: "50000", message: "Delete failed" } });
    const mockEqOrg = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqOrg });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await removeFromOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to remove from organization watchlist",
    });
  });
});

describe("getOrgWatchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid organization ID format", async () => {
    const result = await getOrgWatchlist("invalid-org-id");

    expect(result).toEqual({
      success: false,
      error: "Invalid organization ID format",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getOrgWatchlist(validOrgId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully fetches organization watchlist", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockWatchlistData = [
      {
        id: "watchlist-1",
        indicator_id: validIndicatorId,
        org_id: validOrgId,
        created_at: "2026-01-14T12:00:00Z",
      },
    ];
    const mockOrder = vi.fn().mockResolvedValue({ data: mockWatchlistData, error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getOrgWatchlist(validOrgId);

    expect(result).toEqual({
      success: true,
      data: mockWatchlistData,
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("watchlist");
    expect(mockSelect).toHaveBeenCalledWith("id, indicator_id, org_id, created_at");
    expect(mockEq).toHaveBeenCalledWith("org_id", validOrgId);
  });

  it("returns empty array when no items in org watchlist", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getOrgWatchlist(validOrgId);

    expect(result).toEqual({
      success: true,
      data: [],
    });
  });

  it("returns error on fetch failure", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockOrder = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Fetch failed" } });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getOrgWatchlist(validOrgId);

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch organization watchlist",
    });
  });
});

describe("toggleOrgWatchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid organization ID format", async () => {
    const result = await toggleOrgWatchlist("invalid-org-id", validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Invalid organization ID format",
    });
  });

  it("returns error for invalid indicator ID format", async () => {
    const result = await toggleOrgWatchlist(validOrgId, "invalid-id");

    expect(result).toEqual({
      success: false,
      error: "Invalid indicator ID format",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("adds indicator when not currently in org watchlist", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (returns null = not watching)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqIndicatorSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqOrgSelect = vi.fn().mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrgSelect });

    // Second call: insert
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { isWatching: true },
    });
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: mockUserId,
      indicator_id: validIndicatorId,
      org_id: validOrgId,
    });
  });

  it("removes indicator when currently in org watchlist", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const existingWatchlistId = "watchlist-item-uuid-1234-567890abcdef";

    // First call: select (returns existing item)
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: existingWatchlistId },
      error: null,
    });
    const mockEqIndicatorSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqOrgSelect = vi.fn().mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrgSelect });

    // Second call: delete
    const mockEqId = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqId });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleOrgWatchlist(validOrgId, validIndicatorId);

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
    const mockEqOrgSelect = vi.fn().mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrgSelect });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to check organization watchlist status",
    });
  });

  it("returns error when not authorized during delete", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const existingWatchlistId = "watchlist-item-uuid-1234-567890abcdef";

    // First call: select (returns existing item)
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: existingWatchlistId },
      error: null,
    });
    const mockEqIndicatorSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqOrgSelect = vi.fn().mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrgSelect });

    // Second call: delete fails with RLS violation
    const mockEqId = vi
      .fn()
      .mockResolvedValue({ error: { code: "42501", message: "RLS violation" } });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqId });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authorized to modify organization watchlist",
    });
  });

  it("returns error when not authorized during insert", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (not in watchlist)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqIndicatorSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqOrgSelect = vi.fn().mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqOrgSelect });

    // Second call: insert fails with RLS violation
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "42501", message: "RLS violation" } });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleOrgWatchlist(validOrgId, validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authorized to modify organization watchlist",
    });
  });
});
