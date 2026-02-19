import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  subscribePush,
  unsubscribePush,
  getPushSubscriptionStatus,
} from "./push-subscriptions";

// Mock the createSupabaseServerClient function
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

const mockUserId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

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

describe("subscribePush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await subscribePush({
      endpoint: "https://push.example.com/sub",
      keys: { p256dh: "key", auth: "auth" },
    });

    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns validation error for invalid endpoint", async () => {
    const result = await subscribePush({
      endpoint: "not-a-url",
      keys: { p256dh: "key", auth: "auth" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("URL");
    }
  });

  it("returns validation error for missing keys", async () => {
    const result = await subscribePush({
      endpoint: "https://push.example.com/sub",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      keys: { p256dh: "", auth: "auth" } as any,
    });

    expect(result.success).toBe(false);
  });

  it("returns error when upsert fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockUpsert = vi.fn().mockResolvedValue({
      error: new Error("db error"),
    });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await subscribePush({
      endpoint: "https://push.example.com/sub",
      keys: { p256dh: "validkey", auth: "validauth" },
    });

    expect(result).toEqual({ success: false, error: "Failed to save push subscription" });
  });

  it("successfully upserts a subscription", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ upsert: mockUpsert });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await subscribePush({
      endpoint: "https://push.example.com/sub",
      keys: { p256dh: "validkey", auth: "validauth" },
    });

    expect(result).toEqual({ success: true, data: undefined });
    expect(mockSupabase.from).toHaveBeenCalledWith("push_subscriptions");
  });
});

describe("unsubscribePush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await unsubscribePush();

    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when delete fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEq = vi.fn().mockResolvedValue({ error: new Error("db error") });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await unsubscribePush();

    expect(result).toEqual({ success: false, error: "Failed to remove push subscription" });
  });

  it("successfully deletes all subscriptions for the user", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ delete: mockDelete });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await unsubscribePush();

    expect(result).toEqual({ success: true, data: undefined });
    expect(mockEq).toHaveBeenCalledWith("user_id", mockUserId);
  });
});

describe("getPushSubscriptionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getPushSubscriptionStatus();

    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns subscribed false when no rows found", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getPushSubscriptionStatus();

    expect(result).toEqual({ success: true, data: { subscribed: false } });
  });

  it("returns subscribed true when rows found", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockLimit = vi.fn().mockResolvedValue({
      data: [{ id: "some-id" }],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getPushSubscriptionStatus();

    expect(result).toEqual({ success: true, data: { subscribed: true } });
  });

  it("returns error when select fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockLimit = vi.fn().mockResolvedValue({ data: null, error: new Error("db error") });
    const mockEq = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getPushSubscriptionStatus();

    expect(result).toEqual({
      success: false,
      error: "Failed to check push subscription status",
    });
  });
});
