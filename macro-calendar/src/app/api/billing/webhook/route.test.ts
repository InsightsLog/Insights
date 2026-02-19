import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Mock Stripe using vi.hoisted
const { MockStripeClass, mockWebhooks, mockSubs } = vi.hoisted(() => {
  const mockWebhooks = {
    constructEvent: vi.fn(),
  };
  const mockSubs = {
    retrieve: vi.fn(),
  };
  class MockStripeClass {
    webhooks = mockWebhooks;
    subscriptions = mockSubs;
  }
  return { MockStripeClass, mockWebhooks, mockSubs };
});

vi.mock("stripe", () => ({ default: MockStripeClass }));

vi.mock("@/lib/env", () => ({
  getStripeEnv: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

import { getStripeEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";

const mockGetStripeEnv = vi.mocked(getStripeEnv);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

function makeRequest(body: object, signature?: string): NextRequest {
  return new NextRequest("http://localhost/api/billing/webhook", {
    method: "POST",
    body: JSON.stringify(body),
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("configuration errors", () => {
    it("returns 500 when Stripe is not configured", async () => {
      mockGetStripeEnv.mockReturnValue(null);

      const response = await POST(makeRequest({}, "sig"));

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Stripe not configured");
    });

    it("returns 400 when stripe-signature header is missing", async () => {
      mockGetStripeEnv.mockReturnValue({
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      });

      const response = await POST(makeRequest({}));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Missing stripe-signature header");
    });
  });

  describe("signature verification", () => {
    it("returns 400 when signature is invalid", async () => {
      mockGetStripeEnv.mockReturnValue({
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      });
      mockWebhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const response = await POST(makeRequest({}, "bad_sig"));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Invalid signature");
    });
  });

  describe("checkout.session.completed", () => {
    it("creates subscription on successful checkout", async () => {
      mockGetStripeEnv.mockReturnValue({
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      });

      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_123",
            metadata: { user_id: "user-uuid-123" },
          },
        },
      };

      const mockSubscription = {
        id: "sub_123",
        status: "active",
        items: {
          data: [
            {
              price: { id: "price_123" },
              current_period_end: 1735689600,
            },
          ],
        },
        start_date: 1704067200,
        ended_at: null,
      };

      mockWebhooks.constructEvent.mockReturnValue(mockEvent);
      mockSubs.retrieve.mockResolvedValue(mockSubscription);

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockSelectPlans = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "plan-uuid-1",
              name: "Pro",
              features: { stripe_price_id_monthly: "price_123" },
            },
          ],
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "plans") return { select: mockSelectPlans };
          return { upsert: mockUpsert };
        }),
      } as never);

      const response = await POST(makeRequest(mockEvent, "valid_sig"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received).toBe(true);
      expect(body.warning).toBeUndefined();
    });

    it("returns warning when user_id is missing from session metadata", async () => {
      mockGetStripeEnv.mockReturnValue({
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      });

      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_123",
            metadata: {}, // Missing user_id
          },
        },
      };

      mockWebhooks.constructEvent.mockReturnValue(mockEvent);

      const response = await POST(makeRequest(mockEvent, "valid_sig"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received).toBe(true);
      expect(body.warning).toBe("Missing user_id in session metadata");
    });
  });

  describe("customer.subscription.deleted", () => {
    it("marks subscription as canceled", async () => {
      mockGetStripeEnv.mockReturnValue({
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      });

      const mockEvent = {
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_123",
            status: "canceled",
            items: {
              data: [
                {
                  price: { id: "price_123" },
                  current_period_end: 1735689600,
                },
              ],
            },
            start_date: 1704067200,
            ended_at: 1735689600,
          },
        },
      };

      mockWebhooks.constructEvent.mockReturnValue(mockEvent);

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({ update: mockUpdate }),
      } as never);

      const response = await POST(makeRequest(mockEvent, "valid_sig"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received).toBe(true);
    });
  });

  describe("unhandled events", () => {
    it("returns 200 for unhandled event types", async () => {
      mockGetStripeEnv.mockReturnValue({
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      });

      const mockEvent = {
        type: "payment_intent.succeeded",
        data: { object: {} },
      };

      mockWebhooks.constructEvent.mockReturnValue(mockEvent);

      const response = await POST(makeRequest(mockEvent, "valid_sig"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received).toBe(true);
    });
  });
});
