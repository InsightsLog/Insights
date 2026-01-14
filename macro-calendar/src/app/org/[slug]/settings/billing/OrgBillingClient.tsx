"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getTeamPlans,
  getOrgSubscription,
  getOrgSeatCount,
  createOrgCheckoutSession,
  cancelOrgSubscription,
  updateOrgSeats,
  type Plan,
  type OrgSubscription,
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
 * Plan feature descriptions for team plans.
 */
const TEAM_PLAN_FEATURES: Record<string, string[]> = {
  "Team Plus": [
    "5,000 API calls/month",
    "10 webhook endpoints",
    "Shared watchlists",
    "Team collaboration",
    "Priority email support",
  ],
  "Team Pro": [
    "50,000 API calls/month",
    "50 webhook endpoints",
    "Shared watchlists",
    "Team collaboration",
    "Data export (CSV/JSON)",
    "Priority support",
    "Advanced analytics",
  ],
  "Team Enterprise": [
    "500,000 API calls/month",
    "200 webhook endpoints",
    "Shared watchlists",
    "Team collaboration",
    "Data export (CSV/JSON)",
    "Dedicated support",
    "SLA guarantee",
    "SSO integration",
    "Audit logs",
  ],
};

interface OrgBillingClientProps {
  orgId: string;
  orgName: string;
  orgSlug: string;
  currentUserRole: "owner" | "admin" | "billing_admin" | "member";
  isBillingAdmin: boolean;
}

/**
 * Organization billing client component.
 * Displays team plan, seat count, and billing options.
 * Task: T334 - Organization billing
 */
export function OrgBillingClient({
  orgId,
  orgName,
  orgSlug,
  isBillingAdmin,
}: OrgBillingClientProps) {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [seatData, setSeatData] = useState<{ seats: number; members: number }>({ seats: 0, members: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Upgrade state
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [selectedSeatCount, setSelectedSeatCount] = useState<number>(2);

  // Cancel state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);

  // Seat update state
  const [showSeatUpdate, setShowSeatUpdate] = useState(false);
  const [newSeatCount, setNewSeatCount] = useState<number>(2);
  const [updatingSeats, setUpdatingSeats] = useState(false);

  const hasFetched = useRef(false);

  // Handle success/cancel URL params from Stripe redirect
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setSuccessMessage(
        "Your organization subscription has been updated! It may take a moment to reflect."
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
        const [plansResult, subscriptionResult, seatResult] = await Promise.all([
          getTeamPlans(),
          getOrgSubscription(orgId),
          getOrgSeatCount(orgId),
        ]);

        if (plansResult.success) {
          setPlans(plansResult.data);
        } else {
          setError(plansResult.error);
        }

        if (subscriptionResult.success) {
          setSubscription(subscriptionResult.data);
          if (subscriptionResult.data) {
            setNewSeatCount(subscriptionResult.data.seat_count);
          }
        }

        if (seatResult.success) {
          setSeatData(seatResult.data);
          if (seatResult.data.members > 0) {
            setSelectedSeatCount(Math.max(2, seatResult.data.members));
          }
        }
      } catch {
        setError("Failed to load billing information");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [orgId]);

  // Handle plan subscription
  const handleSubscribe = async (planId: string) => {
    setUpgradingPlanId(planId);
    setError(null);

    const result = await createOrgCheckoutSession(
      orgId,
      planId,
      selectedSeatCount,
      billingInterval
    );

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

    const result = await cancelOrgSubscription(orgId);

    if (result.success) {
      setSuccessMessage(
        "Your organization subscription has been canceled. You will retain access until the end of your billing period."
      );
      setShowCancelConfirm(false);
      // Refresh subscription data
      const subResult = await getOrgSubscription(orgId);
      if (subResult.success) {
        setSubscription(subResult.data);
      }
    } else {
      setError(result.error);
    }

    setCanceling(false);
  };

  // Handle seat count update
  const handleUpdateSeats = async () => {
    setUpdatingSeats(true);
    setError(null);

    const result = await updateOrgSeats(orgId, newSeatCount);

    if (result.success) {
      setSuccessMessage("Seat count updated successfully!");
      setShowSeatUpdate(false);
      // Refresh data
      const [subResult, seatResult] = await Promise.all([
        getOrgSubscription(orgId),
        getOrgSeatCount(orgId),
      ]);
      if (subResult.success) {
        setSubscription(subResult.data);
      }
      if (seatResult.success) {
        setSeatData(seatResult.data);
      }
    } else {
      setError(result.error);
    }

    setUpdatingSeats(false);
  };

  // Calculate total price for a plan
  const calculateTotalPrice = (plan: Plan, seats: number): number => {
    const basePrice = billingInterval === "yearly" && plan.price_yearly
      ? plan.price_yearly / 12
      : plan.price_monthly;
    
    const seatPrice = billingInterval === "yearly" && plan.seat_price_yearly
      ? (plan.seat_price_yearly ?? 0) / 12
      : (plan.seat_price_monthly ?? 0);
    
    return basePrice + (seatPrice * (seats - 1)); // First seat included in base price
  };

  // Determine current plan
  const currentPlan = subscription?.plan;
  const currentPlanName = currentPlan?.name ?? "No subscription";

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <main className="mx-auto max-w-4xl px-4 py-6">
          <div className="mb-6">
            <Link
              href={`/org/${orgSlug}/settings`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              ← Back to Organization Settings
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
            href={`/org/${orgSlug}/settings`}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to Organization Settings
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {orgName} - Billing
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your organization&apos;s subscription and team seats
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
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Current Plan & Seats */}
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
              </div>
              {currentPlan && currentPlan.price_monthly > 0 && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {formatPrice(currentPlan.price_monthly)}/month base + {formatPrice(currentPlan.seat_price_monthly ?? 0)}/seat
                </p>
              )}
              {subscription?.current_period_end && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {subscription.status === "canceled" ? "Access until" : "Renews"}{" "}
                  {formatDate(subscription.current_period_end)}
                </p>
              )}
            </div>

            {isBillingAdmin && subscription?.status === "active" && subscription.stripe_subscription_id && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Cancel Subscription
              </button>
            )}
          </div>

          {/* Cancel confirmation */}
          {showCancelConfirm && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
              <p className="text-sm text-amber-800 dark:text-amber-400">
                Are you sure you want to cancel your organization&apos;s subscription? All team members
                will lose access at the end of the current billing period.
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

        {/* Team Seats */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Team Seats
            </h2>
            {isBillingAdmin && subscription?.status === "active" && !showSeatUpdate && (
              <button
                onClick={() => {
                  setNewSeatCount(subscription.seat_count);
                  setShowSeatUpdate(true);
                }}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Manage Seats
              </button>
            )}
          </div>

          <div className="mt-4 flex items-baseline gap-4">
            <div>
              <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                {seatData.members}
              </span>
              <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                / {subscription?.seat_count ?? seatData.seats} seats used
              </span>
            </div>
          </div>

          {/* Seat usage bar */}
          {(subscription?.seat_count ?? 0) > 0 && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className={`h-full rounded-full transition-all ${
                    (seatData.members / (subscription?.seat_count ?? 1)) >= 0.9
                      ? "bg-red-500"
                      : (seatData.members / (subscription?.seat_count ?? 1)) >= 0.75
                        ? "bg-amber-500"
                        : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.min((seatData.members / (subscription?.seat_count ?? 1)) * 100, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {seatData.members >= (subscription?.seat_count ?? 0)
                  ? "All seats are in use. Add more seats to invite new members."
                  : `${(subscription?.seat_count ?? 0) - seatData.members} seats available`}
              </p>
            </div>
          )}

          {/* Seat update form */}
          {showSeatUpdate && subscription && (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Number of Seats
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="number"
                  min={Math.max(currentPlan?.min_seats ?? 1, seatData.members)}
                  max={currentPlan?.max_seats ?? 100}
                  value={newSeatCount}
                  onChange={(e) => setNewSeatCount(parseInt(e.target.value) || 1)}
                  className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  onClick={handleUpdateSeats}
                  disabled={updatingSeats || newSeatCount === subscription.seat_count}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updatingSeats ? "Updating..." : "Update Seats"}
                </button>
                <button
                  onClick={() => setShowSeatUpdate(false)}
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                >
                  Cancel
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Min: {currentPlan?.min_seats ?? 1} seats, Max: {currentPlan?.max_seats ?? 100} seats
                {seatData.members > 0 && ` (Cannot go below current member count: ${seatData.members})`}
              </p>
            </div>
          )}
        </div>

        {/* Available Team Plans */}
        {(!subscription || subscription.status === "canceled") && isBillingAdmin && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Team Plans
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

            {/* Seat selector */}
            <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Number of Team Seats
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={selectedSeatCount}
                  onChange={(e) => setSelectedSeatCount(parseInt(e.target.value) || 2)}
                  className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  seats (includes you + {selectedSeatCount - 1} team members)
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const totalPrice = calculateTotalPrice(plan, selectedSeatCount);
                const features = TEAM_PLAN_FEATURES[plan.name] ?? [];

                return (
                  <div
                    key={plan.id}
                    className="relative rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
                  >
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {plan.name}
                    </h3>

                    <div className="mt-2">
                      <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        {formatPrice(totalPrice)}
                      </span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        /month
                      </span>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        for {selectedSeatCount} seats
                      </p>
                      {billingInterval === "yearly" && plan.price_yearly && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Billed {formatPrice(totalPrice * 12)}/year
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
                      <button
                        onClick={() => handleSubscribe(plan.id)}
                        disabled={upgradingPlanId !== null || selectedSeatCount < (plan.min_seats ?? 1)}
                        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {upgradingPlanId === plan.id ? "Redirecting..." : "Subscribe"}
                      </button>
                      {selectedSeatCount < (plan.min_seats ?? 1) && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          Minimum {plan.min_seats} seats required
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Not a billing admin message */}
        {!isBillingAdmin && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Only organization owners, admins, and billing admins can manage billing.
              Contact your organization administrator to make changes.
            </p>
          </div>
        )}

        {/* Help section */}
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Need Help?
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Have questions about organization billing or need to make changes to your
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
