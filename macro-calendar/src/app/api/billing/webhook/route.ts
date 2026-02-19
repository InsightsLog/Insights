/**
 * POST /api/billing/webhook - Handle Stripe webhook events
 *
 * Receives and processes Stripe webhook events to keep subscription records
 * in sync with Stripe. Validates the webhook signature before processing.
 *
 * Handled events:
 * - checkout.session.completed: Creates/updates subscription when checkout completes
 * - customer.subscription.deleted: Marks subscription as canceled
 *
 * Security:
 * - Validates webhook signature using STRIPE_WEBHOOK_SECRET
 * - Uses service role client to bypass RLS for subscription updates
 *
 * Task: T452 - Add Stripe billing integration
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";

/**
 * Map Stripe subscription status to our database status.
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): "active" | "canceled" | "past_due" | "trialing" {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "canceled":
      return "canceled";
    case "past_due":
      return "past_due";
    case "trialing":
      return "trialing";
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
      return "past_due";
    case "paused":
      return "canceled";
    default:
      return "active";
  }
}

/**
 * Get the current period end timestamp from a subscription.
 * In newer Stripe API versions, period info is on subscription items.
 */
function getCurrentPeriodEnd(subscription: Stripe.Subscription): number {
  const firstItem = subscription.items.data[0];
  if (firstItem?.current_period_end) {
    return firstItem.current_period_end;
  }
  if (subscription.ended_at) {
    return subscription.ended_at;
  }
  return subscription.start_date + 30 * 24 * 60 * 60;
}

/**
 * Get plan ID from Stripe price ID by looking it up in the plans table.
 * Falls back to Free plan if no matching plan is found.
 */
async function getPlanIdFromPriceId(priceId: string): Promise<string> {
  const supabase = createSupabaseServiceClient();

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, features")
    .order("price_monthly", { ascending: false });

  if (plans) {
    for (const plan of plans) {
      const features = plan.features as Record<string, unknown>;
      if (
        features?.stripe_price_id_monthly === priceId ||
        features?.stripe_price_id_yearly === priceId
      ) {
        return plan.id;
      }
    }
  }

  // Fallback to Free plan
  const { data: freePlan } = await supabase
    .from("plans")
    .select("id")
    .eq("name", "Free")
    .single();

  return freePlan?.id ?? "00000000-0000-0000-0000-000000000001";
}

/**
 * Handle checkout.session.completed event.
 * Creates or updates a subscription when a user completes checkout.
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<{ success: boolean; error?: string }> {
  if (!session.customer || !session.subscription) {
    return { success: false, error: "Missing customer or subscription in session" };
  }

  const userId = session.metadata?.user_id;
  if (!userId) {
    return { success: false, error: "Missing user_id in session metadata" };
  }

  const supabase = createSupabaseServiceClient();

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const priceId = subscription.items.data[0]?.price.id;
  const planId = priceId ? await getPlanIdFromPriceId(priceId) : null;

  if (!planId) {
    return { success: false, error: "Could not determine plan from price" };
  }

  const currentPeriodEnd = getCurrentPeriodEnd(subscription);

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: planId,
      stripe_subscription_id: subscriptionId,
      status: mapStripeStatus(subscription.status),
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Failed to upsert subscription:", error);
    return { success: false, error: "Database error" };
  }

  return { success: true };
}

/**
 * Handle customer.subscription.deleted event.
 * Marks the subscription as canceled when a Stripe subscription is deleted.
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServiceClient();
  const currentPeriodEnd = getCurrentPeriodEnd(subscription);

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Failed to mark subscription as canceled:", error);
    return { success: false, error: "Database error" };
  }

  return { success: true };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const stripeEnv = getStripeEnv();

  if (!stripeEnv) {
    console.error("Stripe environment variables not configured");
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeEnv.secretKey, {
    apiVersion: "2025-12-15.clover",
  });

  // Get raw body for signature verification
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeEnv.webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let result: { success: boolean; error?: string };

  switch (event.type) {
    case "checkout.session.completed":
      result = await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        stripe
      );
      break;

    case "customer.subscription.deleted":
      result = await handleSubscriptionDeleted(
        event.data.object as Stripe.Subscription
      );
      break;

    default:
      // Acknowledge receipt of unhandled events
      return NextResponse.json({ received: true });
  }

  if (!result.success) {
    console.error(`Failed to handle ${event.type}:`, result.error);
    // Return 200 to acknowledge receipt (Stripe retries on 4xx/5xx)
    return NextResponse.json({ received: true, warning: result.error });
  }

  return NextResponse.json({ received: true });
}
