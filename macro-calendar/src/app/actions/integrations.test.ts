import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSlackWebhook,
  saveSlackWebhook,
  deleteSlackWebhook,
  testSlackWebhook,
} from "./integrations";

// Mock the createSupabaseServerClient function
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

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

const mockUserId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const mockWebhookId = "b2c3d4e5-f6a7-8901-bcde-f23456789012";
const VALID_SLACK_URL = "https://hooks.slack.com/test-webhook-placeholder";

describe("getSlackWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getSlackWebhook();

    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns null when no Slack webhook saved", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqType = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqType });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getSlackWebhook();

    expect(result).toEqual({ success: true, data: null });
  });

  it("returns existing Slack webhook", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockWebhook = {
      id: mockWebhookId,
      url: VALID_SLACK_URL,
      enabled: true,
      created_at: "2026-01-11T00:00:00Z",
      updated_at: "2026-01-11T00:00:00Z",
      last_triggered_at: null,
    };
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockWebhook, error: null });
    const mockEqType = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqType });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUser });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getSlackWebhook();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.url).toBe(VALID_SLACK_URL);
    }
  });
});

describe("saveSlackWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid URL", async () => {
    const result = await saveSlackWebhook("not-a-url");
    expect(result.success).toBe(false);
  });

  it("rejects non-Slack URL", async () => {
    const result = await saveSlackWebhook("https://example.com/webhook");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("hooks.slack.com");
    }
  });

  it("rejects http Slack URL", async () => {
    const result = await saveSlackWebhook(
      "http://hooks.slack.com/services/T00000000/B00000000/XXX"
    );
    expect(result.success).toBe(false);
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await saveSlackWebhook(VALID_SLACK_URL);

    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("creates new Slack webhook when none exists", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockWebhook = {
      id: mockWebhookId,
      url: VALID_SLACK_URL,
      enabled: true,
      created_at: "2026-01-11T00:00:00Z",
      updated_at: "2026-01-11T00:00:00Z",
      last_triggered_at: null,
    };

    // First call: check existing (none)
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEqType = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqType });
    const mockSelectExisting = vi.fn().mockReturnValue({ eq: mockEqUser });

    // Second call: insert
    const mockSingle = vi.fn().mockResolvedValue({ data: mockWebhook, error: null });
    const mockSelectInsert = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelectInsert });

    mockSupabase.from
      .mockReturnValueOnce({ select: mockSelectExisting })
      .mockReturnValueOnce({ insert: mockInsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await saveSlackWebhook(VALID_SLACK_URL);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe(VALID_SLACK_URL);
    }
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: mockUserId,
        url: VALID_SLACK_URL,
        type: "slack",
      })
    );
  });

  it("updates existing Slack webhook URL", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const updatedWebhook = {
      id: mockWebhookId,
      url: VALID_SLACK_URL,
      enabled: true,
      created_at: "2026-01-11T00:00:00Z",
      updated_at: "2026-01-11T01:00:00Z",
      last_triggered_at: null,
    };

    // First call: check existing (found)
    const mockMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: mockWebhookId }, error: null });
    const mockEqType = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqType });
    const mockSelectExisting = vi.fn().mockReturnValue({ eq: mockEqUser });

    // Second call: update
    const mockSingle = vi.fn().mockResolvedValue({ data: updatedWebhook, error: null });
    const mockSelectUpdate = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqUpdate = vi.fn().mockReturnValue({ select: mockSelectUpdate });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate });

    mockSupabase.from
      .mockReturnValueOnce({ select: mockSelectExisting })
      .mockReturnValueOnce({ update: mockUpdate });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await saveSlackWebhook(VALID_SLACK_URL);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe(VALID_SLACK_URL);
    }
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ url: VALID_SLACK_URL })
    );
  });
});

describe("deleteSlackWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid webhook ID", async () => {
    const result = await deleteSlackWebhook("not-a-uuid");
    expect(result).toEqual({ success: false, error: "Invalid webhook ID" });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await deleteSlackWebhook(mockWebhookId);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("successfully deletes Slack webhook", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEqSlack = vi.fn().mockResolvedValue({ error: null });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqSlack });
    const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqId });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await deleteSlackWebhook(mockWebhookId);

    expect(result).toEqual({ success: true, data: undefined });
  });
});

describe("testSlackWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("returns error for invalid webhook ID", async () => {
    const result = await testSlackWebhook("invalid-id");
    expect(result).toEqual({ success: false, error: "Invalid webhook ID" });
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await testSlackWebhook(mockWebhookId);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when webhook not found", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const mockEqType = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqType });
    const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqId });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await testSlackWebhook(mockWebhookId);
    expect(result).toEqual({
      success: false,
      error: "Slack integration not found",
    });
  });

  it("sends Slack-formatted test payload on success", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockWebhook = {
      id: mockWebhookId,
      url: VALID_SLACK_URL,
      enabled: true,
    };
    const mockSingle = vi.fn().mockResolvedValue({ data: mockWebhook, error: null });
    const mockEqType = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqType });
    const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqId });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    vi.mocked(global.fetch).mockResolvedValue({ status: 200, ok: true } as Response);

    const result = await testSlackWebhook(mockWebhookId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status_code).toBe(200);
      expect(result.data.success).toBe(true);
    }

    // Verify Slack payload format
    const callArgs = vi.mocked(global.fetch).mock.calls[0];
    expect(callArgs[0]).toBe(VALID_SLACK_URL);
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body).toHaveProperty("text");
    expect(body).toHaveProperty("attachments");
    expect(body.attachments[0]).toHaveProperty("fields");
  });

  it("handles network error gracefully", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockWebhook = { id: mockWebhookId, url: VALID_SLACK_URL, enabled: true };
    const mockSingle = vi.fn().mockResolvedValue({ data: mockWebhook, error: null });
    const mockEqType = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqType });
    const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqId });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    const result = await testSlackWebhook(mockWebhookId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status_code).toBe(0);
      expect(result.data.success).toBe(false);
    }
  });
});

describe("Slack URL validation", () => {
  it("accepts valid Slack webhook URL", async () => {
    // The URL check itself rejects auth (not authenticated), confirming URL was valid
    // We test via saveSlackWebhook reaching the auth check
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await saveSlackWebhook(VALID_SLACK_URL);
    // Should fail at auth, not URL validation
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("rejects Discord URL as Slack webhook", async () => {
    const result = await saveSlackWebhook(
      "https://discord.com/api/webhooks/1234/abcd"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("hooks.slack.com");
    }
  });
});
