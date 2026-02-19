import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getWatchlistWithAlertPreferences,
  updateAlertPreferences,
} from "./alert-preferences";

// Mock the createSupabaseServerClient function
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

// Valid UUIDs for testing
const validIndicatorId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const mockUserId = "user-1234-5678-9abc-def012345678";
const mockWatchlistId = "wtch-1234-5678-9abc-def012345678";

// Helper to build a chainable Supabase mock
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

describe("getWatchlistWithAlertPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getWatchlistWithAlertPreferences();

    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns empty array when watchlist is empty", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // watchlist query returns empty
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getWatchlistWithAlertPreferences();

    expect(result).toEqual({ success: true, data: [] });
  });

  it("returns error when watchlist query fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockOrder = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "DB error" } });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getWatchlistWithAlertPreferences();

    expect(result).toEqual({ success: false, error: "Failed to fetch watchlist" });
  });

  it("combines watchlist items with alert preferences", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const watchlistItem = {
      id: mockWatchlistId,
      indicator_id: validIndicatorId,
      indicator: {
        id: validIndicatorId,
        name: "CPI (YoY)",
        country_code: "US",
        category: "Inflation",
        importance: "high",
      },
    };
    const prefItem = {
      indicator_id: validIndicatorId,
      email_enabled: true,
      push_enabled: false,
    };

    // First call: watchlist
    const mockOrder = vi
      .fn()
      .mockResolvedValue({ data: [watchlistItem], error: null });
    const mockEqWatchlist = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelectWatchlist = vi
      .fn()
      .mockReturnValue({ eq: mockEqWatchlist });

    // Second call: alert_preferences
    const mockIn = vi
      .fn()
      .mockResolvedValue({ data: [prefItem], error: null });
    const mockEqPrefs = vi.fn().mockReturnValue({ in: mockIn });
    const mockSelectPrefs = vi.fn().mockReturnValue({ eq: mockEqPrefs });

    mockSupabase.from
      .mockReturnValueOnce({ select: mockSelectWatchlist })
      .mockReturnValueOnce({ select: mockSelectPrefs });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getWatchlistWithAlertPreferences();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        watchlistId: mockWatchlistId,
        indicatorId: validIndicatorId,
        indicatorName: "CPI (YoY)",
        countryCode: "US",
        category: "Inflation",
        importance: "high",
        emailEnabled: true,
        pushEnabled: false,
      });
    }
  });

  it("defaults email/push to false when no preference exists", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const watchlistItem = {
      id: mockWatchlistId,
      indicator_id: validIndicatorId,
      indicator: {
        id: validIndicatorId,
        name: "NFP",
        country_code: "US",
        category: "Employment",
        importance: "high",
      },
    };

    // watchlist call
    const mockOrder = vi
      .fn()
      .mockResolvedValue({ data: [watchlistItem], error: null });
    const mockEqWatchlist = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelectWatchlist = vi
      .fn()
      .mockReturnValue({ eq: mockEqWatchlist });

    // prefs call returns empty
    const mockIn = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEqPrefs = vi.fn().mockReturnValue({ in: mockIn });
    const mockSelectPrefs = vi.fn().mockReturnValue({ eq: mockEqPrefs });

    mockSupabase.from
      .mockReturnValueOnce({ select: mockSelectWatchlist })
      .mockReturnValueOnce({ select: mockSelectPrefs });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getWatchlistWithAlertPreferences();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].emailEnabled).toBe(false);
      expect(result.data[0].pushEnabled).toBe(false);
    }
  });

  it("returns error when alert preferences query fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const watchlistItem = {
      id: mockWatchlistId,
      indicator_id: validIndicatorId,
      indicator: {
        id: validIndicatorId,
        name: "CPI",
        country_code: "US",
        category: "Inflation",
        importance: "high",
      },
    };

    // watchlist call succeeds
    const mockOrder = vi
      .fn()
      .mockResolvedValue({ data: [watchlistItem], error: null });
    const mockEqWatchlist = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelectWatchlist = vi
      .fn()
      .mockReturnValue({ eq: mockEqWatchlist });

    // prefs call fails
    const mockIn = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "DB error" } });
    const mockEqPrefs = vi.fn().mockReturnValue({ in: mockIn });
    const mockSelectPrefs = vi.fn().mockReturnValue({ eq: mockEqPrefs });

    mockSupabase.from
      .mockReturnValueOnce({ select: mockSelectWatchlist })
      .mockReturnValueOnce({ select: mockSelectPrefs });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getWatchlistWithAlertPreferences();

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch alert preferences",
    });
  });
});

describe("updateAlertPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid indicator ID", async () => {
    const result = await updateAlertPreferences("not-a-uuid", true, false);

    expect(result).toEqual({
      success: false,
      error: "Invalid indicator ID format",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreferences(validIndicatorId, true, false);

    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("upserts email and push preference successfully", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreferences(validIndicatorId, true, true);

    expect(result).toEqual({
      success: true,
      data: { emailEnabled: true, pushEnabled: true },
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("alert_preferences");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: mockUserId,
        indicator_id: validIndicatorId,
        email_enabled: true,
        push_enabled: true,
      },
      { onConflict: "user_id,indicator_id" }
    );
  });

  it("returns error when indicator not found (FK violation)", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockUpsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "23503", message: "FK violation" } });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreferences(validIndicatorId, true, false);

    expect(result).toEqual({ success: false, error: "Indicator not found" });
  });

  it("returns error on database failure", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockUpsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "50000", message: "DB error" } });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreferences(validIndicatorId, false, false);

    expect(result).toEqual({
      success: false,
      error: "Failed to update alert preferences",
    });
  });
});
