import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OrganizationClient } from "./OrganizationClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organization",
  description: "Create or manage your organization and team members",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Organization settings page.
 * Allows users to create a new organization or view/manage their existing ones.
 * Requires authentication.
 */
export default async function OrganizationPage() {
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

  // Fetch organizations the user belongs to
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations:org_id (id, name, slug, owner_id, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const organizations = (memberships ?? [])
    .map((m) => {
      const org = m.organizations as unknown as {
        id: string;
        name: string;
        slug: string;
        owner_id: string;
        created_at: string;
      } | null;
      if (!org) return null;
      return { ...org, currentUserRole: m.role as "owner" | "admin" | "billing_admin" | "member" };
    })
    .filter(Boolean) as Array<{
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    created_at: string;
    currentUserRole: "owner" | "admin" | "billing_admin" | "member";
  }>;

  return <OrganizationClient organizations={organizations} currentUserId={user.id} />;
}
