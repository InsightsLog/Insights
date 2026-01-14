"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getPlans,
  getCurrentSubscription,
  getApiUsage,
  createCheckoutSession,
  cancelSubscription,
  reactivateSubscription,
  type Plan,
  type Subscription,
} from "@/app/actions/billing";

/**
 * Format price in cents to display format.
 */
function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format date to human-readable format.
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Plan feature descriptions for display.
 */
const PLAN_FEATURES: Record<string, string[]> = {
  Free: [
    "100 API calls/month",
    "1 webhook endpoint",
    "Email alerts",
    "Community support",
  ],
  Plus: [
    "1,000 API calls/month",
    "5 webhook endpoints",
    "Email alerts",
    "Priority email support",
  ],
  Pro: [
    "10,000 API calls/month",
    "20 webhook endpoints",
    "Email alerts",
    "Data export (CSV/JSON)",
    "Priority support",
  ],
  Enterprise: [
    "100,000 API calls/month",
    "100 webhook endpoints",
    "Email alerts",
    "Data export (CSV/JSON)",
    "Dedicated support",
    "SLA guarantee",
  ],
};

/**
 * Billing client component.
 * Displays current plan, usage, and upgrade options.
 *
 * Task: T323 - Add billing page
 */
export function BillingClient() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [apiUsage, setApiUsage] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Upgrade state
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    "monthly"
  );

  // Cancel state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const hasFetched = useRef(false);

  // Handle success/cancel URL params from Stripe redirect
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setSuccessMessage(
        "Your subscription has been updated! It may take a moment to reflect."
      );
    }
  }, [searchParams]);

  // Fetch data on mount
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [plansResult, subscriptionResult, usageResult] = await Promise.all(
          [getPlans(), getCurrentSubscription(), getApiUsage()]
        );

        if (plansResult.success) {
          setPlans(plansResult.data);
        } else {
          setError(plansResult.error);
        }

        if (subscriptionResult.success) {
          setSubscription(subscriptionResult.data);
        }

        if (usageResult.success) {
          setApiUsage(usageResult.data);
        }
      } catch {
        setError("Failed to load billing information");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Handle plan upgrade
  const handleUpgrade = async (planId: string) => {
    setUpgradingPlanId(planId);
    setError(null);

    const result = await createCheckoutSession(planId, billingInterval);

    if (result.success) {
      // Redirect to Stripe Checkout
      window.location.href = result.data.url;
    } else {
      setError(result.error);
      setUpgradingPlanId(null);
    }
  };

  // Handle subscription cancellation
  const handleCancel = async () => {
    setCanceling(true);
    setError(null);

    const result = await cancelSubscription();

    if (result.success) {
      setSuccessMessage(
        "Your subscription has been canceled. You will retain access until the end of your billing period."
      );
      setShowCancelConfirm(false);
      // Refresh subscription data
      const subResult = await getCurrentSubscription();
      if (subResult.success) {
        setSubscription(subResult.data);
      }
    } else {
      setError(result.error);
    }

    setCanceling(false);
  };

  // Handle subscription reactivation
  const handleReactivate = async () => {
    setReactivating(true);
    setError(null);

    const result = await reactivateSubscription();

    if (result.success) {
      setSuccessMessage("Your subscription has been reactivated!");
      // Refresh subscription data
      const subResult = await getCurrentSubscription();
      if (subResult.success) {
        setSubscription(subResult.data);
      }
    } else {
      setError(result.error);
    }

    setReactivating(false);
  };

  // Determine current plan
  const currentPlan = subscription?.plan;
  const currentPlanName = currentPlan?.name ?? "Free";
  const apiLimit = currentPlan?.api_calls_limit ?? 100;
  const usagePercent = Math.min((apiUsage / apiLimit) * 100, 100);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <main className="mx-auto max-w-4xl px-4 py-6">
          <div className="mb-6">
            <Link
              href="/"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              ← Back to Calendar
            </Link>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to Calendar
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Billing
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your subscription and view usage
          </p>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-900/20">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-green-800 dark:text-green-400">
                {successMessage}
              </p>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-red-800 dark:text-red-400">
                {error}
              </p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Current Plan */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Current Plan
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {currentPlanName}
                </span>
                {subscription?.status === "canceled" && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    Canceling
                  </span>
                )}
                {subscription?.status === "past_due" && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Past Due
                  </span>
                )}
                {subscription?.status === "trialing" && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    Trial
                  </span>
                )}
              </div>
              {currentPlan && currentPlan.price_monthly > 0 && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {formatPrice(currentPlan.price_monthly)}/month
                </p>
              )}
              {subscription?.current_period_end && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {subscription.status === "canceled"
                    ? "Access until"
                    : "Renews"}{" "}
                  {formatDate(subscription.current_period_end)}
                </p>
              )}
            </div>

            {subscription?.status === "canceled" &&
            subscription.current_period_end &&
            new Date(subscription.current_period_end) > new Date() ? (
              <button
                onClick={handleReactivate}
                disabled={reactivating}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reactivating ? "Reactivating..." : "Reactivate"}
              </button>
            ) : subscription?.status === "active" &&
              subscription.stripe_subscription_id ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Cancel Subscription
              </button>
            ) : null}
          </div>

          {/* Cancel confirmation */}
          {showCancelConfirm && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
              <p className="text-sm text-amber-800 dark:text-amber-400">
                Are you sure you want to cancel your subscription? You will
                retain access until the end of your current billing period.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={canceling}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {canceling ? "Canceling..." : "Yes, Cancel"}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={canceling}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  No, Keep Plan
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Usage */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            API Usage This Month
          </h2>

          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {apiUsage.toLocaleString()}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              of {apiLimit.toLocaleString()} calls
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercent >= 90
                  ? "bg-red-500"
                  : usagePercent >= 75
                    ? "bg-amber-500"
                    : "bg-blue-500"
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>

          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {usagePercent >= 90
              ? "You're almost at your limit. Consider upgrading your plan."
              : usagePercent >= 75
                ? "You've used most of your monthly quota."
                : "Usage resets at the start of each month."}
          </p>
        </div>

        {/* Available Plans */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Available Plans
            </h2>

            {/* Billing interval toggle */}
            <div className="flex items-center gap-2 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
              <button
                onClick={() => setBillingInterval("monthly")}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  billingInterval === "monthly"
                    ? "bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval("yearly")}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  billingInterval === "yearly"
                    ? "bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Yearly
                <span className="ml-1 text-xs text-green-600 dark:text-green-400">
                  Save 17%
                </span>
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const isCurrentPlan = currentPlanName === plan.name;
              const price =
                billingInterval === "yearly" && plan.price_yearly
                  ? plan.price_yearly / 12
                  : plan.price_monthly;
              const features = PLAN_FEATURES[plan.name] ?? [];

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-lg border p-4 ${
                    isCurrentPlan
                      ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/20"
                      : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-2.5 left-3 rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                      Current
                    </div>
                  )}

                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {plan.name}
                  </h3>

                  <div className="mt-2">
                    <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {formatPrice(price)}
                    </span>
                    {price > 0 && (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        /month
                      </span>
                    )}
                    {billingInterval === "yearly" && plan.price_yearly && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Billed {formatPrice(plan.price_yearly)}/year
                      </p>
                    )}
                  </div>

                  <ul className="mt-4 space-y-2">
                    {features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
                      >
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-green-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4">
                    {isCurrentPlan ? (
                      <button
                        disabled
                        className="w-full rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        Current Plan
                      </button>
                    ) : plan.price_monthly === 0 ? (
                      <button
                        disabled
                        className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        Free Tier
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={upgradingPlanId !== null}
                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {upgradingPlanId === plan.id
                          ? "Redirecting..."
                          : currentPlanName !== "Free" &&
                              plan.price_monthly <
                                (currentPlan?.price_monthly ?? 0)
                            ? "Downgrade"
                            : "Upgrade"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Help section */}
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Need Help?
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Have questions about billing or need to make changes to your
            subscription? Contact our support team at{" "}
            <a
              href="mailto:support@macrocal.io"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              support@macrocal.io
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
