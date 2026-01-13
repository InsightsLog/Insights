/**
 * POST /api/stripe/webhook - Handle Stripe webhook events
 *
 * This endpoint receives webhook events from Stripe and updates subscription
 * records in the database accordingly.
 *
 * Handled events:
 * - checkout.session.completed: Create/update subscription when checkout completes
 * - customer.subscription.updated: Update subscription status and period
 * - customer.subscription.deleted: Mark subscription as canceled
 *
 * Security:
 * - Validates webhook signature using STRIPE_WEBHOOK_SECRET
 * - Uses service role client to bypass RLS for subscription updates
 *
 * Task: T322 - Integrate Stripe for payments
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";

/**
 * Initialize Stripe client with the secret key.
 * Returns null if Stripe environment variables are not configured.
 */
function getStripeClient(): Stripe | null {
  const stripeEnv = getStripeEnv();
  if (!stripeEnv) {
    return null;
  }
  return new Stripe(stripeEnv.secretKey, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * Map Stripe subscription status to our database status.
 * Stripe has more statuses than we track, so we normalize them.
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
 * Get plan ID from Stripe price ID.
 * Looks up the plan by checking if features JSONB contains the Stripe price ID.
 * Falls back to the Free plan if no matching plan is found.
 */
async function getPlanIdFromPriceId(priceId: string): Promise<string> {
  const supabase = createSupabaseServiceClient();

  // Try to find a plan that matches this price ID in its features
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
 * Get the current period end timestamp from a subscription.
 * In newer Stripe API versions, period info is on subscription items.
 */
function getCurrentPeriodEnd(subscription: Stripe.Subscription): number {
  // Get period end from the first subscription item
  const firstItem = subscription.items.data[0];
  if (firstItem?.current_period_end) {
    return firstItem.current_period_end;
  }
  // Fallback to ended_at or start_date + 30 days if no period info
  if (subscription.ended_at) {
    return subscription.ended_at;
  }
  // Default to 30 days from start if no other info available
  return subscription.start_date + 30 * 24 * 60 * 60;
}

/**
 * Handle checkout.session.completed event.
 * Creates or updates a subscription when a user completes checkout.
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; error?: string }> {
  // Must have customer and subscription
  if (!session.customer || !session.subscription) {
    return { success: false, error: "Missing customer or subscription in session" };
  }

  // Get user ID from session metadata
  const userId = session.metadata?.user_id;
  if (!userId) {
    return { success: false, error: "Missing user_id in session metadata" };
  }

  const supabase = createSupabaseServiceClient();
  const stripe = getStripeClient();

  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  // Retrieve the full subscription to get status and period
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Get plan ID from the subscription's price
  const priceId = subscription.items.data[0]?.price.id;
  const planId = priceId ? await getPlanIdFromPriceId(priceId) : null;

  if (!planId) {
    return { success: false, error: "Could not determine plan from price" };
  }

  // Get current period end from subscription items
  const currentPeriodEnd = getCurrentPeriodEnd(subscription);

  // Upsert subscription record
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: planId,
      stripe_subscription_id: subscriptionId,
      status: mapStripeStatus(subscription.status),
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    console.error("Failed to upsert subscription:", error);
    return { success: false, error: "Database error" };
  }

  return { success: true };
}

/**
 * Handle customer.subscription.updated event.
 * Updates subscription status and period when Stripe subscription changes.
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServiceClient();

  // Get plan ID from the subscription's price
  const priceId = subscription.items.data[0]?.price.id;
  const planId = priceId ? await getPlanIdFromPriceId(priceId) : null;

  // Get current period end from subscription items
  const currentPeriodEnd = getCurrentPeriodEnd(subscription);

  const updateData: {
    status: "active" | "canceled" | "past_due" | "trialing";
    current_period_end: string;
    plan_id?: string;
  } = {
    status: mapStripeStatus(subscription.status),
    current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
  };

  if (planId) {
    updateData.plan_id = planId;
  }

  const { error } = await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Failed to update subscription:", error);
    return { success: false, error: "Database error" };
  }

  return { success: true };
}

/**
 * Handle customer.subscription.deleted event.
 * Marks subscription as canceled when user cancels or subscription ends.
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServiceClient();

  // Get current period end from subscription items
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

  // Get the raw body for signature verification
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
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      stripeEnv.webhookSecret
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // Handle the event
  let result: { success: boolean; error?: string };

  switch (event.type) {
    case "checkout.session.completed":
      result = await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session
      );
      break;

    case "customer.subscription.updated":
      result = await handleSubscriptionUpdated(
        event.data.object as Stripe.Subscription
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
    // Return 200 anyway to acknowledge receipt (Stripe will retry on 4xx/5xx)
    // Logging the error for debugging while not causing unnecessary retries
    return NextResponse.json({ received: true, warning: result.error });
  }

  return NextResponse.json({ received: true });
}
