import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAlertPreferences,
  updateAlertPreference,
  toggleEmailAlert,
  getUnsubscribeToken,
  unsubscribeWithToken,
} from "./alerts";

// Mock the createSupabaseServerClient function
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// Mock the createSupabaseServiceClient function
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

// Import the mocked function to control its behavior
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

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

  it("successfully returns empty array when no preferences", async () => {
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
    expect(mockSupabase.from).toHaveBeenCalledWith("alert_preferences");
    expect(mockSelect).toHaveBeenCalledWith(
      "id, indicator_id, email_enabled, created_at, updated_at"
    );
    expect(mockEq).toHaveBeenCalledWith("user_id", mockUserId);
  });

  it("successfully returns user alert preferences", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockPreferences = [
      {
        id: mockPreferenceId,
        indicator_id: validIndicatorId,
        email_enabled: true,
        created_at: "2026-01-10T00:00:00Z",
        updated_at: "2026-01-10T00:00:00Z",
      },
    ];
    const mockEq = vi
      .fn()
      .mockResolvedValue({ data: mockPreferences, error: null });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getAlertPreferences();

    expect(result).toEqual({
      success: true,
      data: mockPreferences,
    });
  });

  it("returns error on database failure", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEq = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "DB error" } });
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
      indicator_id: validIndicatorId,
      email_enabled: true,
      created_at: "2026-01-10T00:00:00Z",
      updated_at: "2026-01-10T00:00:00Z",
    };
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: mockPreference, error: null });
    const mockSelectReturn = vi.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelectReturn });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreference(validIndicatorId, true);

    expect(result).toEqual({
      success: true,
      data: mockPreference,
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("alert_preferences");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: mockUserId,
        indicator_id: validIndicatorId,
        email_enabled: true,
      },
      { onConflict: "user_id,indicator_id" }
    );
  });

  it("successfully updates existing alert preference", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockPreference = {
      id: mockPreferenceId,
      indicator_id: validIndicatorId,
      email_enabled: false,
      created_at: "2026-01-10T00:00:00Z",
      updated_at: "2026-01-10T01:00:00Z",
    };
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: mockPreference, error: null });
    const mockSelectReturn = vi.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelectReturn });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreference(validIndicatorId, false);

    expect(result).toEqual({
      success: true,
      data: mockPreference,
    });
  });

  it("returns error when indicator not found", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "23503", message: "FK violation" } });
    const mockSelectReturn = vi.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelectReturn });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await updateAlertPreference(validIndicatorId, true);

    expect(result).toEqual({
      success: false,
      error: "Indicator not found",
    });
  });

  it("returns error on database failure", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "50000", message: "DB error" } });
    const mockSelectReturn = vi.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = vi.fn().mockReturnValue({ select: mockSelectReturn });
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
    const result = await toggleEmailAlert("not-a-uuid");

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

  it("creates new preference with email_enabled=true when none exists", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (returns null = no preference)
    const mockMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: null });
    const mockEqIndicatorSelect = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi
      .fn()
      .mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });

    // Second call: insert
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { email_enabled: true },
    });
    expect(mockSelect).toHaveBeenCalledWith("id, email_enabled");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: mockUserId,
      indicator_id: validIndicatorId,
      email_enabled: true,
    });
  });

  it("toggles email_enabled from true to false", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (returns existing preference with email_enabled=true)
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: mockPreferenceId, email_enabled: true },
      error: null,
    });
    const mockEqIndicatorSelect = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi
      .fn()
      .mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });

    // Second call: update
    const mockEqId = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { email_enabled: false },
    });
    expect(mockUpdate).toHaveBeenCalledWith({ email_enabled: false });
    expect(mockEqId).toHaveBeenCalledWith("id", mockPreferenceId);
  });

  it("toggles email_enabled from false to true", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (returns existing preference with email_enabled=false)
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: mockPreferenceId, email_enabled: false },
      error: null,
    });
    const mockEqIndicatorSelect = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi
      .fn()
      .mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });

    // Second call: update
    const mockEqId = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { email_enabled: true },
    });
    expect(mockUpdate).toHaveBeenCalledWith({ email_enabled: true });
  });

  it("returns error when select fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Select failed" } });
    const mockEqIndicatorSelect = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi
      .fn()
      .mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });
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

    // First call: select (returns existing preference)
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: mockPreferenceId, email_enabled: true },
      error: null,
    });
    const mockEqIndicatorSelect = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi
      .fn()
      .mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });

    // Second call: update fails
    const mockEqId = vi
      .fn()
      .mockResolvedValue({ error: { message: "Update failed" } });
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

  it("returns error when insert fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (returns null = no preference)
    const mockMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: null });
    const mockEqIndicatorSelect = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi
      .fn()
      .mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });

    // Second call: insert fails
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "50000", message: "Insert failed" } });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to create alert preference",
    });
  });

  it("returns error when indicator not found during insert", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // First call: select (returns null = no preference)
    const mockMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: null });
    const mockEqIndicatorSelect = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUserSelect = vi
      .fn()
      .mockReturnValue({ eq: mockEqIndicatorSelect });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserSelect });

    // Second call: insert fails with FK violation
    const mockInsert = vi
      .fn()
      .mockResolvedValue({ error: { code: "23503", message: "FK violation" } });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await toggleEmailAlert(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Indicator not found",
    });
  });
});

// Mock the unsubscribe token utilities
vi.mock("@/lib/unsubscribe-token", () => ({
  generateUnsubscribeToken: vi.fn(),
  validateUnsubscribeToken: vi.fn(),
}));

import {
  generateUnsubscribeToken,
  validateUnsubscribeToken,
} from "@/lib/unsubscribe-token";
const mockGenerateUnsubscribeToken = vi.mocked(generateUnsubscribeToken);
const mockValidateUnsubscribeToken = vi.mocked(validateUnsubscribeToken);

describe("getUnsubscribeToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid indicator ID format", async () => {
    const result = await getUnsubscribeToken("invalid-id");

    expect(result).toEqual({
      success: false,
      error: "Invalid indicator ID format",
    });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getUnsubscribeToken(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("successfully generates unsubscribe token", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);
    const mockToken = "mock.token.value";
    mockGenerateUnsubscribeToken.mockReturnValue(mockToken);

    const result = await getUnsubscribeToken(validIndicatorId);

    expect(result).toEqual({
      success: true,
      data: { token: mockToken },
    });
    expect(mockGenerateUnsubscribeToken).toHaveBeenCalledWith(
      mockUserId,
      validIndicatorId
    );
  });

  it("returns error when token generation fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);
    mockGenerateUnsubscribeToken.mockImplementation(() => {
      throw new Error("Token generation failed");
    });

    const result = await getUnsubscribeToken(validIndicatorId);

    expect(result).toEqual({
      success: false,
      error: "Failed to generate unsubscribe token",
    });
  });
});

describe("unsubscribeWithToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid token format", async () => {
    const result = await unsubscribeWithToken("");

    expect(result).toEqual({
      success: false,
      error: "Invalid token",
    });
  });

  it("returns error for invalid token", async () => {
    mockValidateUnsubscribeToken.mockReturnValue(null);

    const result = await unsubscribeWithToken("invalid.token");

    expect(result).toEqual({
      success: false,
      error: "Invalid or expired token",
    });
  });

  it("successfully unsubscribes when preference exists and is enabled", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    const mockPayload = {
      userId: mockUserId,
      indicatorId: validIndicatorId,
      exp: Date.now() + 100000,
    };
    mockValidateUnsubscribeToken.mockReturnValue(mockPayload);

    // First call: select (returns existing preference with email_enabled=true)
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: mockPreferenceId, email_enabled: true },
      error: null,
    });
    const mockEqIndicator = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });

    // Second call: update
    const mockEqId = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdate });
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await unsubscribeWithToken("valid.token");

    expect(result).toEqual({
      success: true,
      data: { indicator_id: validIndicatorId },
    });
    expect(mockUpdate).toHaveBeenCalledWith({ email_enabled: false });
    expect(mockEqId).toHaveBeenCalledWith("id", mockPreferenceId);
  });

  it("returns success when no preference exists", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    const mockPayload = {
      userId: mockUserId,
      indicatorId: validIndicatorId,
      exp: Date.now() + 100000,
    };
    mockValidateUnsubscribeToken.mockReturnValue(mockPayload);

    // Select returns null (no preference)
    const mockMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: null });
    const mockEqIndicator = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });

    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await unsubscribeWithToken("valid.token");

    expect(result).toEqual({
      success: true,
      data: { indicator_id: validIndicatorId },
    });
  });

  it("returns success when already unsubscribed", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    const mockPayload = {
      userId: mockUserId,
      indicatorId: validIndicatorId,
      exp: Date.now() + 100000,
    };
    mockValidateUnsubscribeToken.mockReturnValue(mockPayload);

    // Select returns preference with email_enabled=false
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: mockPreferenceId, email_enabled: false },
      error: null,
    });
    const mockEqIndicator = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });

    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await unsubscribeWithToken("valid.token");

    expect(result).toEqual({
      success: true,
      data: { indicator_id: validIndicatorId },
    });
  });

  it("returns error when select fails", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    const mockPayload = {
      userId: mockUserId,
      indicatorId: validIndicatorId,
      exp: Date.now() + 100000,
    };
    mockValidateUnsubscribeToken.mockReturnValue(mockPayload);

    // Select fails
    const mockMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "DB error" } });
    const mockEqIndicator = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });

    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await unsubscribeWithToken("valid.token");

    expect(result).toEqual({
      success: false,
      error: "Failed to process unsubscribe request",
    });
  });

  it("returns error when update fails", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    const mockPayload = {
      userId: mockUserId,
      indicatorId: validIndicatorId,
      exp: Date.now() + 100000,
    };
    mockValidateUnsubscribeToken.mockReturnValue(mockPayload);

    // First call: select (returns existing preference)
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: mockPreferenceId, email_enabled: true },
      error: null,
    });
    const mockEqIndicator = vi
      .fn()
      .mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqIndicator });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });

    // Second call: update fails
    const mockEqId = vi
      .fn()
      .mockResolvedValue({ error: { message: "Update failed" } });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });

    mockSupabase.from.mockReturnValueOnce({ select: mockSelect });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdate });
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await unsubscribeWithToken("valid.token");

    expect(result).toEqual({
      success: false,
      error: "Failed to process unsubscribe request",
    });
  });
});
