import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAlertPreferences,
  updateAlertPreference,
  toggleEmailAlert,
} from "./alerts";

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

// Valid UUIDs for testing
const validIndicatorId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const mockUserId = "user-1234-5678-9abc-def012345678";
const mockPreferenceId = "pref-1234-5678-9abc-def012345678";

describe("getAlertPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getAlertPreferences();

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

    const result = await getAlertPreferences();

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully returns alert preferences", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockPreferences = [
      {
        id: mockPreferenceId,
        user_id: mockUserId,
        indicator_id: validIndicatorId,
        email_enabled: true,
        created_at: "2026-01-08T00:00:00Z",
        updated_at: "2026-01-08T00:00:00Z",
      },
    ];

    const mockEq = vi.fn().mockResolvedValue({ data: mockPreferences, error: null });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getAlertPreferences();

    expect(result).toEqual({
      success: true,
      data: mockPreferences,
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("alert_preferences");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEq).toHaveBeenCalledWith("user_id", mockUserId);
  });

  it("returns empty array when no preferences exist", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getAlertPreferences();

    expect(result).toEqual({
      success: true,
      data: [],
    });
  });

  it("returns error on database failure", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getAlertPreferences();

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch alert preferences",
    });
  });
});

describe("updateAlertPreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid indicator ID format", async () => {
    const result = await updateAlertPreference("invalid-id", true);

    expect(result).toEqual({
      success: false,
      error: "Invalid indicator ID format",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreference(validIndicatorId, true);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully creates new alert preference", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockPreference = {
      id: mockPreferenceId,
      user_id: mockUserId,
      indicator_id: validIndicatorId,
      email_enabled: true,
      created_at: "2026-01-08T00:00:00Z",
      updated_at: "2026-01-08T00:00:00Z",
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: mockPreference, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreference(validIndicatorId, true);

    expect(result).toEqual({
      success: true,
      data: mockPreference,
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("alert_preferences");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: mockUserId,
        indicator_id: validIndicatorId,
        email_enabled: true,
      }),
      { onConflict: "user_id,indicator_id" }
    );
  });

  it("successfully updates existing alert preference", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockPreference = {
      id: mockPreferenceId,
      user_id: mockUserId,
      indicator_id: validIndicatorId,
      email_enabled: false,
      created_at: "2026-01-08T00:00:00Z",
      updated_at: "2026-01-08T01:00:00Z",
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: mockPreference, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreference(validIndicatorId, false);

    expect(result).toEqual({
      success: true,
      data: mockPreference,
    });
  });

  it("returns error when indicator not found (foreign key violation)", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23503", message: "FK violation" },
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreference(validIndicatorId, true);

    expect(result).toEqual({
      success: false,
      error: "Indicator not found",
    });
  });

  it("returns error on generic database error", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "50000", message: "DB error" },
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreference(validIndicatorId, true);

    expect(result).toEqual({
      success: false,
      error: "Failed to update alert preference",
    });
  });
});

describe("toggleEmailAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid indicator ID format", async () => {
    const result = await toggleEmailAlert("bad-uuid");

    expect(result).toEqual({
      success: false,
      error: "Invalid indicator ID format",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("creates new preference with email enabled when not existing", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockPreference = {
      id: mockPreferenceId,
      user_id: mockUserId,
      indicator_id: validIndicatorId,
      email_enabled: true,
      created_at: "2026-01-08T00:00:00Z",
      updated_at: "2026-01-08T00:00:00Z",
    };

    // First call: select (returns null = no existing preference)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqIndicator = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });

    // Second call: insert
    const mockSingle = vi.fn().mockResolvedValue({ data: mockPreference, error: null });
    const mockInsertSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: mockPreference,
    });
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: mockUserId,
      indicator_id: validIndicatorId,
      email_enabled: true,
    });
  });

  it("toggles existing preference from enabled to disabled", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const existingPreference = {
      id: mockPreferenceId,
      user_id: mockUserId,
      indicator_id: validIndicatorId,
      email_enabled: true,
      created_at: "2026-01-08T00:00:00Z",
      updated_at: "2026-01-08T00:00:00Z",
    };
    const updatedPreference = {
      ...existingPreference,
      email_enabled: false,
      updated_at: "2026-01-08T01:00:00Z",
    };

    // First call: select (returns existing preference with email_enabled: true)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: existingPreference, error: null });
    const mockEqIndicator = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });

    // Second call: update
    const mockSingle = vi.fn().mockResolvedValue({ data: updatedPreference, error: null });
    const mockUpdateSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqId = vi.fn().mockReturnValue({ select: mockUpdateSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: updatedPreference,
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        email_enabled: false,
      })
    );
  });

  it("toggles existing preference from disabled to enabled", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const existingPreference = {
      id: mockPreferenceId,
      user_id: mockUserId,
      indicator_id: validIndicatorId,
      email_enabled: false,
      created_at: "2026-01-08T00:00:00Z",
      updated_at: "2026-01-08T00:00:00Z",
    };
    const updatedPreference = {
      ...existingPreference,
      email_enabled: true,
      updated_at: "2026-01-08T01:00:00Z",
    };

    // First call: select (returns existing preference with email_enabled: false)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: existingPreference, error: null });
    const mockEqIndicator = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });

    // Second call: update
    const mockSingle = vi.fn().mockResolvedValue({ data: updatedPreference, error: null });
    const mockUpdateSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqId = vi.fn().mockReturnValue({ select: mockUpdateSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: updatedPreference,
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        email_enabled: true,
      })
    );
  });

  it("returns error when select fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Select failed" },
    });
    const mockEqIndicator = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to check alert preference",
    });
  });

  it("returns error when update fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const existingPreference = {
      id: mockPreferenceId,
      user_id: mockUserId,
      indicator_id: validIndicatorId,
      email_enabled: true,
      created_at: "2026-01-08T00:00:00Z",
      updated_at: "2026-01-08T00:00:00Z",
    };

    // First call: select (returns existing preference)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: existingPreference, error: null });
    const mockEqIndicator = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });

    // Second call: update fails
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Update failed" },
    });
    const mockUpdateSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqId = vi.fn().mockReturnValue({ select: mockUpdateSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to toggle alert preference",
    });
  });

  it("returns error when indicator not found during insert", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (not existing)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqIndicator = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });

    // Second call: insert fails with FK violation
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23503", message: "FK violation" },
    });
    const mockInsertSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Indicator not found",
    });
  });

  it("returns error on generic insert failure", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (not existing)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqIndicator = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });

    // Second call: insert fails with generic error
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "50000", message: "Insert failed" },
    });
    const mockInsertSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to create alert preference",
    });
  });
});
