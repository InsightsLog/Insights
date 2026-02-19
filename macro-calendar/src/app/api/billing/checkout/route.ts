/**
 * POST /api/billing/checkout - Create a Stripe Checkout session for the Pro plan
 *
 * Creates a Stripe Checkout session for upgrading to the Pro tier and returns
 * the redirect URL. Requires a valid user session.
 *
 * Request body (optional JSON):
 * - billing_interval: "monthly" | "yearly" (default: "monthly")
 *
 * Response:
 * - 200: { url: string } - Stripe Checkout redirect URL
 * - 401: { error: string } - Not authenticated
 * - 404: { error: string } - Pro plan not found or no price configured
 * - 500: { error: string } - Stripe not configured or error
 *
 * Task: T452 - Add Stripe billing integration
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { getStripeEnv, getStripePriceEnv } from "@/lib/env";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify Stripe is configured
  const stripeEnv = getStripeEnv();
  if (!stripeEnv) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  // Verify the user is authenticated
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Parse optional billing interval from request body
  let billingInterval: "monthly" | "yearly" = "monthly";
  try {
    const body = await request.json().catch(() => ({}));
    if (body.billing_interval === "yearly") {
      billingInterval = "yearly";
    }
  } catch {
    // Default to monthly if body parsing fails
  }

  // Resolve the Pro plan price ID
  // 1. Try STRIPE_PRO_PRICE_ID (simple single price ID)
  // 2. Fall back to STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_PRO_YEARLY
  // 3. Fall back to price ID stored in the plans table features column
  let priceId: string | undefined = stripeEnv.proPriceId;

  if (!priceId) {
    const priceConfig = getStripePriceEnv();
    priceId =
      billingInterval === "yearly"
        ? priceConfig.pro?.yearly
        : priceConfig.pro?.monthly;
  }

  if (!priceId) {
    // Try the plans table as a last resort
    const serviceClient = createSupabaseServiceClient();
    const { data: proPlan } = await serviceClient
      .from("plans")
      .select("features")
      .eq("name", "Pro")
      .single();

    if (proPlan) {
      const features = proPlan.features as Record<string, unknown>;
      priceId =
        billingInterval === "yearly"
          ? (features.stripe_price_id_yearly as string | undefined)
          : (features.stripe_price_id_monthly as string | undefined);
    }
  }

  if (!priceId) {
    return NextResponse.json(
      {
        error:
          "No Stripe price configured for Pro plan. Set STRIPE_PRO_PRICE_ID environment variable.",
      },
      { status: 404 }
    );
  }

  const stripe = new Stripe(stripeEnv.secretKey, {
    apiVersion: "2025-12-15.clover",
  });

  // Determine base URL for redirect
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  // Check if the user already has a Stripe customer ID via an existing subscription
  let customerId: string | undefined;
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .single();

  if (existingSub?.stripe_subscription_id) {
    try {
      const existing = await stripe.subscriptions.retrieve(
        existingSub.stripe_subscription_id
      );
      customerId =
        typeof existing.customer === "string"
          ? existing.customer
          : existing.customer?.id;
    } catch {
      // Subscription may have been deleted; proceed without customer ID
    }
  }

  // Create Stripe Checkout session
  try {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/settings/billing?success=true`,
      cancel_url: `${baseUrl}/settings/billing?canceled=true`,
      metadata: { user_id: user.id },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Stripe error: ${message}` },
      { status: 500 }
    );
  }
}
