import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OrgBillingClient } from "./OrgBillingClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organization Billing",
  description: "Manage your organization subscription and billing",
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Organization billing page.
 * Shows current team plan, seat count, usage, and billing options.
 * Requires authentication and organization membership.
 * Task: T334 - Organization billing
 */
export default async function OrgBillingPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  // Check if user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Redirect to home if not authenticated
  if (authError || !user) {
    redirect("/");
  }

  // Verify user has access to this organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug, owner_id")
    .eq("slug", slug)
    .single();

  // Redirect to home if org not found or user doesn't have access (RLS)
  if (orgError || !org) {
    redirect("/");
  }

  // Get user's role in the organization
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .single();

  // Redirect if not a member
  if (!membership) {
    redirect("/");
  }

  // Check if user is a billing admin
  const billingRoles = ["owner", "admin", "billing_admin"];
  const isBillingAdmin = billingRoles.includes(membership.role);

  return (
    <OrgBillingClient
      orgId={org.id}
      orgName={org.name}
      orgSlug={org.slug}
      currentUserRole={membership.role as "owner" | "admin" | "billing_admin" | "member"}
      isBillingAdmin={isBillingAdmin}
    />
  );
}
