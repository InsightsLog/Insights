import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Mock the stripe module using vi.hoisted to allow references in vi.mock factory
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

// Mock the env module
vi.mock("@/lib/env", () => ({
  getStripeEnv: vi.fn(),
}));

// Mock the supabase service client
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: MockStripeClass,
}));

// Import the mocked modules
import { getStripeEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";

const mockGetStripeEnv = vi.mocked(getStripeEnv);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("configuration errors", () => {
    it("returns 500 when Stripe is not configured", async () => {
      mockGetStripeEnv.mockReturnValue(null);

      const request = new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Stripe not configured");
    });

    it("returns 400 when stripe-signature header is missing", async () => {
      mockGetStripeEnv.mockReturnValue({
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      });

      const request = new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      });

      const response = await POST(request);

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

      const request = new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "invalid_sig",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Invalid signature");
    });
  });

  describe("checkout.session.completed", () => {
    it("returns 200 and creates subscription on successful checkout", async () => {
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
              current_period_end: 1735689600, // 2025-01-01
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
            { id: "plan-uuid-1", name: "Pro", features: { stripe_price_id_monthly: "price_123" } },
          ],
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "plans") {
            return { select: mockSelectPlans };
          }
          return { upsert: mockUpsert };
        }),
      } as never);

      const request = new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify(mockEvent),
        headers: {
          "stripe-signature": "valid_sig",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received).toBe(true);
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

      const request = new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify(mockEvent),
        headers: {
          "stripe-signature": "valid_sig",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received).toBe(true);
      expect(body.warning).toBe("Missing user_id in session metadata");
    });
  });

  describe("customer.subscription.updated", () => {
    it("returns 200 and updates subscription status", async () => {
      mockGetStripeEnv.mockReturnValue({
        secretKey: "sk_test_123",
        webhookSecret: "whsec_123",
      });

      const mockEvent = {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            status: "past_due",
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
          },
        },
      };

      mockWebhooks.constructEvent.mockReturnValue(mockEvent);

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockSelectPlans = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { id: "plan-uuid-1", name: "Pro", features: { stripe_price_id_monthly: "price_123" } },
          ],
        }),
      });
      mockCreateSupabaseServiceClient.mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "plans") {
            return { select: mockSelectPlans };
          }
          return { update: mockUpdate };
        }),
      } as never);

      const request = new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify(mockEvent),
        headers: {
          "stripe-signature": "valid_sig",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received).toBe(true);
    });
  });

  describe("customer.subscription.deleted", () => {
    it("returns 200 and marks subscription as canceled", async () => {
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

      const request = new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify(mockEvent),
        headers: {
          "stripe-signature": "valid_sig",
        },
      });

      const response = await POST(request);

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
        data: {
          object: {},
        },
      };

      mockWebhooks.constructEvent.mockReturnValue(mockEvent);

      const request = new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify(mockEvent),
        headers: {
          "stripe-signature": "valid_sig",
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received).toBe(true);
    });
  });
});
