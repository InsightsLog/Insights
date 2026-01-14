import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OrganizationSettingsClient } from "./OrganizationSettingsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organization Settings",
  description: "Manage your organization members and settings",
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Organization settings page.
 * Requires authentication and organization membership.
 * Redirects to home if not logged in or not a member.
 */
export default async function OrganizationSettingsPage({ params }: PageProps) {
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

  return (
    <OrganizationSettingsClient
      orgId={org.id}
      orgName={org.name}
      orgSlug={org.slug}
      currentUserRole={membership.role as "owner" | "admin" | "member"}
      currentUserId={user.id}
    />
  );
}
