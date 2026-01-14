"use server";

/**
 * Billing server actions for subscription management.
 * Task: T323 - Add billing page
 *
 * These actions handle:
 * - Fetching current subscription and plan details
 * - Creating Stripe checkout sessions for upgrades
 * - Canceling subscriptions
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { getStripeEnv } from "@/lib/env";
import Stripe from "stripe";

/**
 * Plan information for display.
 */
export type Plan = {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number | null;
  api_calls_limit: number;
  webhook_limit: number;
  features: Record<string, unknown>;
};

/**
 * Subscription information for display.
 */
export type Subscription = {
  id: string;
  plan_id: string;
  plan: Plan;
  status: "active" | "canceled" | "past_due" | "trialing";
  current_period_end: string | null;
  stripe_subscription_id: string | null;
};

/**
 * Billing action result type.
 */
export type BillingActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Initialize Stripe client.
 * Returns null if Stripe is not configured.
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
 * Get all available plans.
 */
export async function getPlans(): Promise<BillingActionResult<Plan[]>> {
  const supabase = await createSupabaseServerClient();

  const { data: plans, error } = await supabase
    .from("plans")
    .select("*")
    .order("price_monthly", { ascending: true });

  if (error) {
    return { success: false, error: "Failed to fetch plans" };
  }

  return { success: true, data: plans ?? [] };
}

/**
 * Get the current user's subscription with plan details.
 * Returns null if no subscription exists (user is on free tier by default).
 */
export async function getCurrentSubscription(): Promise<
  BillingActionResult<Subscription | null>
> {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch subscription with plan details
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      plan_id,
      status,
      current_period_end,
      stripe_subscription_id,
      plans (
        id,
        name,
        price_monthly,
        price_yearly,
        api_calls_limit,
        webhook_limit,
        features
      )
    `
    )
    .eq("user_id", user.id)
    .single();

  if (subError) {
    // PGRST116 means no rows returned - user has no subscription
    if (subError.code === "PGRST116") {
      return { success: true, data: null };
    }
    return { success: false, error: "Failed to fetch subscription" };
  }

  // Transform the response to match our type
  const plan = subscription.plans as unknown as Plan;
  const result: Subscription = {
    id: subscription.id,
    plan_id: subscription.plan_id,
    plan,
    status: subscription.status as Subscription["status"],
    current_period_end: subscription.current_period_end,
    stripe_subscription_id: subscription.stripe_subscription_id,
  };

  return { success: true, data: result };
}

/**
 * Get API usage for the current billing period.
 * Returns the count of API calls made this month.
 */
export async function getApiUsage(): Promise<BillingActionResult<number>> {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Calculate the start of the current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count API calls for this month from api_usage table
  const { count, error } = await supabase
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("timestamp", startOfMonth.toISOString());

  if (error) {
    // If api_usage table doesn't exist yet, return 0
    if (error.code === "42P01") {
      return { success: true, data: 0 };
    }
    return { success: false, error: "Failed to fetch API usage" };
  }

  return { success: true, data: count ?? 0 };
}

/**
 * Create a Stripe Checkout session for plan upgrade.
 *
 * @param planId - The plan ID to upgrade to
 * @param billingInterval - Monthly or yearly billing
 * @returns Checkout session URL
 */
export async function createCheckoutSession(
  planId: string,
  billingInterval: "monthly" | "yearly"
): Promise<BillingActionResult<{ url: string }>> {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Initialize Stripe
  const stripe = getStripeClient();
  if (!stripe) {
    return { success: false, error: "Stripe is not configured" };
  }

  // Get the plan details
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (planError || !plan) {
    return { success: false, error: "Plan not found" };
  }

  // Get the Stripe price ID from plan features
  const features = plan.features as Record<string, unknown>;
  const priceId =
    billingInterval === "yearly"
      ? (features.stripe_price_id_yearly as string)
      : (features.stripe_price_id_monthly as string);

  if (!priceId) {
    return {
      success: false,
      error: `No Stripe price configured for ${plan.name} (${billingInterval})`,
    };
  }

  // Get or create Stripe customer
  let customerId: string | undefined;

  // Check if user already has a subscription with a Stripe customer
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .single();

  if (existingSub?.stripe_subscription_id) {
    // Retrieve the existing subscription to get customer ID
    try {
      const existingStripeSubscription = await stripe.subscriptions.retrieve(
        existingSub.stripe_subscription_id
      );
      customerId =
        typeof existingStripeSubscription.customer === "string"
          ? existingStripeSubscription.customer
          : existingStripeSubscription.customer?.id;
    } catch {
      // Subscription may be deleted, proceed without customer ID
    }
  }

  // Determine base URL for redirect
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  // Create checkout session
  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/settings/billing?success=true`,
      cancel_url: `${baseUrl}/settings/billing?canceled=true`,
      metadata: {
        user_id: user.id,
      },
    };

    // Add customer if we have one
    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      // Prefill email for new customers
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session" };
    }

    return { success: true, data: { url: session.url } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: `Stripe error: ${message}` };
  }
}

/**
 * Cancel the current subscription.
 * The subscription will remain active until the current period ends.
 */
export async function cancelSubscription(): Promise<BillingActionResult<void>> {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get current subscription
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", user.id)
    .single();

  if (subError || !subscription) {
    return { success: false, error: "No subscription found" };
  }

  if (subscription.status === "canceled") {
    return { success: false, error: "Subscription is already canceled" };
  }

  if (!subscription.stripe_subscription_id) {
    return { success: false, error: "No Stripe subscription to cancel" };
  }

  // Initialize Stripe
  const stripe = getStripeClient();
  if (!stripe) {
    return { success: false, error: "Stripe is not configured" };
  }

  // Cancel at period end (not immediately)
  try {
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Update local subscription status
    // Note: The webhook will also update this, but we do it immediately for UI responsiveness
    const serviceClient = createSupabaseServiceClient();
    await serviceClient
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", user.id);

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: `Failed to cancel subscription: ${message}` };
  }
}

/**
 * Reactivate a canceled subscription (if still within current period).
 */
export async function reactivateSubscription(): Promise<
  BillingActionResult<void>
> {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get current subscription
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, status, current_period_end")
    .eq("user_id", user.id)
    .single();

  if (subError || !subscription) {
    return { success: false, error: "No subscription found" };
  }

  if (subscription.status !== "canceled") {
    return { success: false, error: "Subscription is not canceled" };
  }

  if (!subscription.stripe_subscription_id) {
    return { success: false, error: "No Stripe subscription to reactivate" };
  }

  // Check if still within period
  if (subscription.current_period_end) {
    const periodEnd = new Date(subscription.current_period_end);
    if (periodEnd < new Date()) {
      return {
        success: false,
        error: "Subscription period has ended. Please create a new subscription.",
      };
    }
  }

  // Initialize Stripe
  const stripe = getStripeClient();
  if (!stripe) {
    return { success: false, error: "Stripe is not configured" };
  }

  // Reactivate subscription (remove cancel_at_period_end)
  try {
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    // Update local subscription status
    const serviceClient = createSupabaseServiceClient();
    await serviceClient
      .from("subscriptions")
      .update({ status: "active" })
      .eq("user_id", user.id);

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: `Failed to reactivate subscription: ${message}` };
  }
}
