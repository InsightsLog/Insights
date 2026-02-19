import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getIndicatorsForOnboarding,
  completeOnboarding,
} from "./onboarding";

// Mock the createSupabaseServerClient function
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

// Valid UUIDs for testing
const mockUserId = "user-1234-5678-9abc-def012345678";
const validIndicatorId1 = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const validIndicatorId2 = "b2c3d4e5-f6a7-8901-bcde-f01234567891";

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

describe("getIndicatorsForOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getIndicatorsForOnboarding();

    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when database query fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getIndicatorsForOnboarding();

    expect(result).toEqual({ success: false, error: "Failed to fetch indicators" });
  });

  it("returns indicators on success", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockIndicators = [
      {
        id: validIndicatorId1,
        name: "CPI",
        country_code: "US",
        category: "Inflation",
        importance: "high",
      },
    ];
    const mockOrder = vi.fn().mockResolvedValue({ data: mockIndicators, error: null });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getIndicatorsForOnboarding();

    expect(result).toEqual({ success: true, data: mockIndicators });
    expect(mockSupabase.from).toHaveBeenCalledWith("indicators");
    expect(mockSelect).toHaveBeenCalledWith(
      "id, name, country_code, category, importance"
    );
  });

  it("returns empty array when no indicators exist", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getIndicatorsForOnboarding();

    expect(result).toEqual({ success: true, data: [] });
  });
});

describe("completeOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await completeOnboarding([], false);

    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error for invalid indicator ID", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await completeOnboarding(["not-a-uuid"], false);

    expect(result).toEqual({ success: false, error: "Invalid input" });
  });

  it("marks profile complete when no indicators selected", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ update: mockUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await completeOnboarding([], false);

    expect(result).toEqual({ success: true });
    expect(mockSupabase.from).toHaveBeenCalledWith("profiles");
    expect(mockUpdate).toHaveBeenCalledWith({ onboarding_complete: true });
    expect(mockEq).toHaveBeenCalledWith("id", mockUserId);
  });

  it("saves watchlist and marks profile complete (no alerts)", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // watchlist upsert
    const mockWatchlistUpsert = vi.fn().mockResolvedValue({ error: null });
    // profile update
    const mockProfileEq = vi.fn().mockResolvedValue({ error: null });
    const mockProfileUpdate = vi.fn().mockReturnValue({ eq: mockProfileEq });

    mockSupabase.from
      .mockReturnValueOnce({ upsert: mockWatchlistUpsert })
      .mockReturnValueOnce({ update: mockProfileUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await completeOnboarding(
      [validIndicatorId1, validIndicatorId2],
      false
    );

    expect(result).toEqual({ success: true });
    expect(mockWatchlistUpsert).toHaveBeenCalledWith(
      [
        { user_id: mockUserId, indicator_id: validIndicatorId1 },
        { user_id: mockUserId, indicator_id: validIndicatorId2 },
      ],
      { onConflict: "user_id,indicator_id" }
    );
    expect(mockProfileUpdate).toHaveBeenCalledWith({
      onboarding_complete: true,
    });
  });

  it("saves watchlist + alerts and marks profile complete", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // watchlist upsert
    const mockWatchlistUpsert = vi.fn().mockResolvedValue({ error: null });
    // alert_preferences upsert
    const mockAlertsUpsert = vi.fn().mockResolvedValue({ error: null });
    // profile update
    const mockProfileEq = vi.fn().mockResolvedValue({ error: null });
    const mockProfileUpdate = vi.fn().mockReturnValue({ eq: mockProfileEq });

    mockSupabase.from
      .mockReturnValueOnce({ upsert: mockWatchlistUpsert })
      .mockReturnValueOnce({ upsert: mockAlertsUpsert })
      .mockReturnValueOnce({ update: mockProfileUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await completeOnboarding([validIndicatorId1], true);

    expect(result).toEqual({ success: true });
    expect(mockAlertsUpsert).toHaveBeenCalledWith(
      [{ user_id: mockUserId, indicator_id: validIndicatorId1, email_enabled: true }],
      { onConflict: "user_id,indicator_id" }
    );
  });

  it("returns error when watchlist upsert fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockWatchlistUpsert = vi
      .fn()
      .mockResolvedValue({ error: { message: "DB error" } });
    mockSupabase.from.mockReturnValue({ upsert: mockWatchlistUpsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await completeOnboarding([validIndicatorId1], false);

    expect(result).toEqual({ success: false, error: "Failed to save watchlist" });
  });

  it("returns error when alert_preferences upsert fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockWatchlistUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockAlertsUpsert = vi
      .fn()
      .mockResolvedValue({ error: { message: "DB error" } });

    mockSupabase.from
      .mockReturnValueOnce({ upsert: mockWatchlistUpsert })
      .mockReturnValueOnce({ upsert: mockAlertsUpsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await completeOnboarding([validIndicatorId1], true);

    expect(result).toEqual({
      success: false,
      error: "Failed to save alert preferences",
    });
  });

  it("returns error when profile update fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockProfileEq = vi
      .fn()
      .mockResolvedValue({ error: { message: "DB error" } });
    const mockProfileUpdate = vi.fn().mockReturnValue({ eq: mockProfileEq });
    mockSupabase.from.mockReturnValue({ update: mockProfileUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await completeOnboarding([], false);

    expect(result).toEqual({
      success: false,
      error: "Failed to complete onboarding",
    });
  });
});
