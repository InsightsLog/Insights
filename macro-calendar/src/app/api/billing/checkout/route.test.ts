import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Mock Stripe using vi.hoisted
const { MockStripeClass, mockCheckout, mockSubscriptions } = vi.hoisted(() => {
  const mockCheckout = {
    sessions: {
      create: vi.fn(),
    },
  };
  const mockSubscriptions = {
    retrieve: vi.fn(),
  };
  class MockStripeClass {
    checkout = mockCheckout;
    subscriptions = mockSubscriptions;
  }
  return { MockStripeClass, mockCheckout, mockSubscriptions };
});

vi.mock("stripe", () => ({ default: MockStripeClass }));

vi.mock("@/lib/env", () => ({
  getStripeEnv: vi.fn(),
  getStripePriceEnv: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

import { getStripeEnv, getStripePriceEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";

const mockGetStripeEnv = vi.mocked(getStripeEnv);
const mockGetStripePriceEnv = vi.mocked(getStripePriceEnv);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

const mockUser = { id: "user-uuid-123", email: "user@example.com" };

function makeRequest(body?: object): NextRequest {
  return new NextRequest("http://localhost/api/billing/checkout", {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 when Stripe is not configured", async () => {
    mockGetStripeEnv.mockReturnValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Stripe not configured");
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetStripeEnv.mockReturnValue({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
    });
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("Not authenticated"),
        }),
      },
    } as never);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 404 when no price is configured for Pro plan", async () => {
    mockGetStripeEnv.mockReturnValue({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
      // proPriceId is undefined
    });
    mockGetStripePriceEnv.mockReturnValue({
      pro: { monthly: undefined, yearly: undefined },
    });
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    } as never);
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    } as never);

    const response = await POST(makeRequest());

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("No Stripe price configured for Pro plan");
  });

  it("returns 200 with checkout URL when STRIPE_PRO_PRICE_ID is set", async () => {
    mockGetStripeEnv.mockReturnValue({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
      proPriceId: "price_pro_monthly",
    });
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    } as never);

    mockCheckout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.url).toBe("https://checkout.stripe.com/session_123");
  });

  it("returns 200 with checkout URL using STRIPE_PRICE_PRO_MONTHLY fallback", async () => {
    mockGetStripeEnv.mockReturnValue({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
      // proPriceId not set
    });
    mockGetStripePriceEnv.mockReturnValue({
      pro: { monthly: "price_pro_monthly_fallback" },
    });
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    } as never);

    mockCheckout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_456",
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.url).toBe("https://checkout.stripe.com/session_456");
  });

  it("returns 500 when Stripe throws an error", async () => {
    mockGetStripeEnv.mockReturnValue({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
      proPriceId: "price_pro_monthly",
    });
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    } as never);

    mockCheckout.sessions.create.mockRejectedValue(
      new Error("Card declined")
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain("Card declined");
  });

  it("passes existing customer ID when user has a subscription", async () => {
    mockGetStripeEnv.mockReturnValue({
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
      proPriceId: "price_pro_monthly",
    });
    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { stripe_subscription_id: "sub_existing" },
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    mockSubscriptions.retrieve.mockResolvedValue({
      customer: "cus_existing_123",
    });

    mockCheckout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/session_789",
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(mockCheckout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing_123" })
    );
  });
});
