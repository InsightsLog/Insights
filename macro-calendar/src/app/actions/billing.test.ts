import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPlans,
  getCurrentSubscription,
  getApiUsage,
  createCheckoutSession,
  cancelSubscription,
  reactivateSubscription,
} from "./billing";

// Mock the createSupabaseServerClient function
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// Mock the createSupabaseServiceClient function
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

// Mock the env module
vi.mock("@/lib/env", () => ({
  getStripeEnv: vi.fn(),
}));

// Mock Stripe using vi.hoisted
const { MockStripeClass, mockSubscriptions, mockCheckout } = vi.hoisted(() => {
  const mockSubscriptions = {
    retrieve: vi.fn(),
    update: vi.fn(),
  };
  const mockCheckout = {
    sessions: {
      create: vi.fn(),
    },
  };
  class MockStripeClass {
    subscriptions = mockSubscriptions;
    checkout = mockCheckout;
  }
  return { MockStripeClass, mockSubscriptions, mockCheckout };
});

vi.mock("stripe", () => ({
  default: MockStripeClass,
}));

// Import the mocked functions
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { getStripeEnv } from "@/lib/env";

const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);
const mockGetStripeEnv = vi.mocked(getStripeEnv);

// Valid UUID for testing
const mockUserId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const mockPlanId = "00000000-0000-0000-0000-000000000002";

// Helper to create a mock Supabase client
function createMockSupabase(options: {
  user?: { id: string; email?: string } | null;
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

describe("getPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns plans successfully", async () => {
    const mockPlans = [
      {
        id: "plan-1",
        name: "Free",
        price_monthly: 0,
        price_yearly: null,
        api_calls_limit: 100,
        webhook_limit: 1,
        features: {},
      },
      {
        id: "plan-2",
        name: "Plus",
        price_monthly: 999,
        price_yearly: 9990,
        api_calls_limit: 1000,
        webhook_limit: 5,
        features: {},
      },
    ];

    const mockSupabase = createMockSupabase({ user: null });
    const mockOrder = vi
      .fn()
      .mockResolvedValue({ data: mockPlans, error: null });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getPlans();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe("Free");
    }
    expect(mockSupabase.from).toHaveBeenCalledWith("plans");
  });

  it("returns error on database failure", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    const mockOrder = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "DB error" } });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getPlans();

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch plans",
    });
  });
});

describe("getCurrentSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentSubscription();

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns null when no subscription exists", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentSubscription();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it("returns subscription with plan details", async () => {
    const mockSubscription = {
      id: "sub-1",
      plan_id: mockPlanId,
      status: "active",
      current_period_end: "2026-02-01T00:00:00Z",
      stripe_subscription_id: "sub_123",
      plans: {
        id: mockPlanId,
        name: "Plus",
        price_monthly: 999,
        price_yearly: 9990,
        api_calls_limit: 1000,
        webhook_limit: 5,
        features: {},
      },
    };

    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockSubscription,
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getCurrentSubscription();

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.plan.name).toBe("Plus");
      expect(result.data.status).toBe("active");
    }
  });
});

describe("getApiUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getApiUsage();

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns usage count successfully", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockGte = vi.fn().mockResolvedValue({ count: 42, error: null });
    const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getApiUsage();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(42);
    }
  });

  it("returns 0 when api_usage table does not exist", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockGte = vi.fn().mockResolvedValue({
      count: null,
      error: { code: "42P01", message: "Table not found" },
    });
    const mockEq = vi.fn().mockReturnValue({ gte: mockGte });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getApiUsage();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(0);
    }
  });
});

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await createCheckoutSession(mockPlanId, "monthly");

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when Stripe is not configured", async () => {
    const mockSupabase = createMockSupabase({
      user: { id: mockUserId, email: "test@example.com" },
    });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);
    mockGetStripeEnv.mockReturnValue(null);

    const result = await createCheckoutSession(mockPlanId, "monthly");

    expect(result).toEqual({
      success: false,
      error: "Stripe is not configured",
    });
  });

  it("returns error when plan not found", async () => {
    const mockSupabase = createMockSupabase({
      user: { id: mockUserId, email: "test@example.com" },
    });

    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);
    mockGetStripeEnv.mockReturnValue({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
    });

    const result = await createCheckoutSession(mockPlanId, "monthly");

    expect(result).toEqual({
      success: false,
      error: "Plan not found",
    });
  });

  it("returns error when no Stripe price configured", async () => {
    const mockSupabase = createMockSupabase({
      user: { id: mockUserId, email: "test@example.com" },
    });

    // First call: plan lookup
    const mockPlanSingle = vi.fn().mockResolvedValue({
      data: {
        id: mockPlanId,
        name: "Plus",
        features: {}, // No Stripe price IDs
      },
      error: null,
    });
    const mockPlanEq = vi.fn().mockReturnValue({ single: mockPlanSingle });
    const mockPlanSelect = vi.fn().mockReturnValue({ eq: mockPlanEq });

    mockSupabase.from.mockReturnValueOnce({ select: mockPlanSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);
    mockGetStripeEnv.mockReturnValue({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
    });

    const result = await createCheckoutSession(mockPlanId, "monthly");

    expect(result).toEqual({
      success: false,
      error: "No Stripe price configured for Plus (monthly)",
    });
  });

  it("creates checkout session successfully", async () => {
    const mockSupabase = createMockSupabase({
      user: { id: mockUserId, email: "test@example.com" },
    });

    // First call: plan lookup
    const mockPlanSingle = vi.fn().mockResolvedValue({
      data: {
        id: mockPlanId,
        name: "Plus",
        features: {
          stripe_price_id_monthly: "price_monthly_123",
          stripe_price_id_yearly: "price_yearly_123",
        },
      },
      error: null,
    });
    const mockPlanEq = vi.fn().mockReturnValue({ single: mockPlanSingle });
    const mockPlanSelect = vi.fn().mockReturnValue({ eq: mockPlanEq });

    // Second call: subscription lookup
    const mockSubSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116" },
    });
    const mockSubEq = vi.fn().mockReturnValue({ single: mockSubSingle });
    const mockSubSelect = vi.fn().mockReturnValue({ eq: mockSubEq });

    mockSupabase.from.mockReturnValueOnce({ select: mockPlanSelect });
    mockSupabase.from.mockReturnValueOnce({ select: mockSubSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);
    mockGetStripeEnv.mockReturnValue({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
    });

    mockCheckout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session123",
    });

    const result = await createCheckoutSession(mockPlanId, "monthly");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe("https://checkout.stripe.com/session123");
    }
    expect(mockCheckout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_monthly_123", quantity: 1 }],
        customer_email: "test@example.com",
        metadata: { user_id: mockUserId },
      })
    );
  });
});

describe("cancelSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await cancelSubscription();

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when no subscription found", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116" },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await cancelSubscription();

    expect(result).toEqual({
      success: false,
      error: "No subscription found",
    });
  });

  it("returns error when subscription is already canceled", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        stripe_subscription_id: "sub_123",
        status: "canceled",
      },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await cancelSubscription();

    expect(result).toEqual({
      success: false,
      error: "Subscription is already canceled",
    });
  });

  it("returns error when Stripe is not configured", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        stripe_subscription_id: "sub_123",
        status: "active",
      },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);
    mockGetStripeEnv.mockReturnValue(null);

    const result = await cancelSubscription();

    expect(result).toEqual({
      success: false,
      error: "Stripe is not configured",
    });
  });

  it("cancels subscription successfully", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        stripe_subscription_id: "sub_123",
        status: "active",
      },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);
    mockGetStripeEnv.mockReturnValue({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
    });

    mockSubscriptions.update.mockResolvedValue({});

    // Mock service client for updating local subscription
    const mockServiceEq = vi.fn().mockResolvedValue({ error: null });
    const mockServiceUpdate = vi.fn().mockReturnValue({ eq: mockServiceEq });
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ update: mockServiceUpdate }),
    } as never);

    const result = await cancelSubscription();

    expect(result.success).toBe(true);
    expect(mockSubscriptions.update).toHaveBeenCalledWith("sub_123", {
      cancel_at_period_end: true,
    });
  });
});

describe("reactivateSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await reactivateSubscription();

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when subscription is not canceled", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        stripe_subscription_id: "sub_123",
        status: "active",
        current_period_end: "2026-02-01T00:00:00Z",
      },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await reactivateSubscription();

    expect(result).toEqual({
      success: false,
      error: "Subscription is not canceled",
    });
  });

  it("reactivates subscription successfully", async () => {
    // Set up a future date for current_period_end
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);

    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        stripe_subscription_id: "sub_123",
        status: "canceled",
        current_period_end: futureDate.toISOString(),
      },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);
    mockGetStripeEnv.mockReturnValue({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
    });

    mockSubscriptions.update.mockResolvedValue({});

    // Mock service client for updating local subscription
    const mockServiceEq = vi.fn().mockResolvedValue({ error: null });
    const mockServiceUpdate = vi.fn().mockReturnValue({ eq: mockServiceEq });
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ update: mockServiceUpdate }),
    } as never);

    const result = await reactivateSubscription();

    expect(result.success).toBe(true);
    expect(mockSubscriptions.update).toHaveBeenCalledWith("sub_123", {
      cancel_at_period_end: false,
    });
  });
});
