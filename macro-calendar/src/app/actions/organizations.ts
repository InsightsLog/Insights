"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { randomBytes } from "crypto";
import { z } from "zod";

// Valid roles for organization members
const VALID_ROLES = ["owner", "admin", "billing_admin", "member"] as const;
type OrgMemberRole = (typeof VALID_ROLES)[number];

// Schema for validating organization slug
const orgSlugSchema = z
  .string()
  .min(1, "Organization slug is required")
  .max(100, "Organization slug must be 100 characters or less")
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens");

// Schema for validating member ID (UUID)
const memberIdSchema = z.string().uuid("Invalid member ID");

// Schema for validating user ID (UUID)
const userIdSchema = z.string().uuid("Invalid user ID");

// Schema for validating role
const roleSchema = z.enum(VALID_ROLES);

// Schema for creating an organization
const createOrgSchema = z.object({
  name: z
    .string()
    .min(1, "Organization name is required")
    .max(100, "Organization name must be 100 characters or less"),
  slug: orgSlugSchema,
});

// Schema for inviting a member
const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member"]).optional().default("member"),
});

/**
 * Organization record from the database.
 */
export type Organization = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
};

/**
 * Organization member record from the database.
 */
export type OrganizationMember = {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgMemberRole;
  invited_at: string;
  joined_at: string | null;
  /** Profile information (joined from profiles table) */
  email?: string;
  display_name?: string;
};

/**
 * Organization invite record from the database.
 */
export type OrganizationInvite = {
  id: string;
  org_id: string;
  invited_email: string;
  role: "admin" | "member";
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

/**
 * Result type for organization actions.
 * Success returns data, failure returns error message.
 */
export type OrgActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Get an organization by its slug.
 * Verifies that the current user is a member of the organization.
 *
 * @param slug - The organization slug
 * @returns The organization or error
 */
export async function getOrganization(
  slug: string
): Promise<OrgActionResult<Organization>> {
  // Validate slug
  const parseResult = orgSlugSchema.safeParse(slug);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message ?? "Invalid slug" };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch organization by slug (RLS ensures user is a member)
  const { data, error: selectError } = await supabase
    .from("organizations")
    .select("id, name, slug, owner_id, created_at")
    .eq("slug", slug)
    .single();

  if (selectError) {
    if (selectError.code === "PGRST116") {
      return { success: false, error: "Organization not found" };
    }
    return { success: false, error: "Failed to fetch organization" };
  }

  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      slug: data.slug,
      owner_id: data.owner_id,
      created_at: data.created_at,
    },
  };
}

/**
 * Get the current user's role in an organization.
 *
 * @param orgId - The organization ID
 * @returns The user's role or null if not a member
 */
export async function getCurrentUserRole(
  orgId: string
): Promise<OrgActionResult<OrgMemberRole | null>> {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch member record
  const { data, error: selectError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (selectError) {
    if (selectError.code === "PGRST116") {
      return { success: true, data: null };
    }
    return { success: false, error: "Failed to fetch role" };
  }

  return { success: true, data: data.role as OrgMemberRole };
}

/**
 * List all members of an organization.
 * The current user must be a member of the organization to list members.
 *
 * @param orgId - The organization ID
 * @returns List of organization members or error
 */
export async function listOrganizationMembers(
  orgId: string
): Promise<OrgActionResult<OrganizationMember[]>> {
  // Validate org ID
  const parseResult = z.string().uuid("Invalid organization ID").safeParse(orgId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid organization ID" };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch organization members with profile info
  // RLS ensures user can only see members if they're also a member
  const { data, error: selectError } = await supabase
    .from("organization_members")
    .select(`
      id,
      org_id,
      user_id,
      role,
      invited_at,
      joined_at,
      profiles:user_id (
        email,
        display_name
      )
    `)
    .eq("org_id", orgId)
    .order("role", { ascending: true })
    .order("joined_at", { ascending: true });

  if (selectError) {
    return { success: false, error: "Failed to fetch members" };
  }

  // Transform data to flatten profile info
  const members: OrganizationMember[] = (data ?? []).map((member) => {
    // Type assertion for the joined profiles data
    const profiles = member.profiles as unknown as { email?: string; display_name?: string } | null;
    return {
      id: member.id,
      org_id: member.org_id,
      user_id: member.user_id,
      role: member.role as OrgMemberRole,
      invited_at: member.invited_at,
      joined_at: member.joined_at,
      email: profiles?.email,
      display_name: profiles?.display_name,
    };
  });

  return { success: true, data: members };
}

/**
 * Invite a new member to an organization via email.
 * Creates an invite record and sends an email with an accept link.
 * Requires admin or owner role.
 *
 * @param orgId - The organization ID
 * @param input - The invitation details (email, role)
 * @returns The created invite record or error
 */
export async function inviteMember(
  orgId: string,
  input: { email: string; role?: "admin" | "member" }
): Promise<OrgActionResult<OrganizationInvite>> {
  // Validate org ID
  const orgIdParseResult = z.string().uuid("Invalid organization ID").safeParse(orgId);
  if (!orgIdParseResult.success) {
    return { success: false, error: "Invalid organization ID" };
  }

  // Validate input
  const inputParseResult = inviteMemberSchema.safeParse(input);
  if (!inputParseResult.success) {
    return {
      success: false,
      error: inputParseResult.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Check if email is already a member
  const { data: existingMember } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", inputParseResult.data.email)
    .maybeSingle();

  if (existingMember) {
    const { data: alreadyMember } = await supabase
      .from("organization_members")
      .select("id")
      .eq("org_id", orgId)
      .eq("user_id", existingMember.id)
      .maybeSingle();

    if (alreadyMember) {
      return { success: false, error: "User is already a member of this organization" };
    }
  }

  // Check for an existing pending invite for this email
  const { data: existingInvite } = await supabase
    .from("organization_invites")
    .select("id")
    .eq("org_id", orgId)
    .eq("invited_email", inputParseResult.data.email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existingInvite) {
    return { success: false, error: "A pending invite already exists for this email" };
  }

  // Generate a secure random token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  // Insert invite record (RLS will check if current user is admin/owner)
  const { data: invite, error: insertError } = await supabase
    .from("organization_invites")
    .insert({
      org_id: orgId,
      invited_email: inputParseResult.data.email,
      role: inputParseResult.data.role,
      token,
      invited_by: user.id,
      expires_at: expiresAt,
    })
    .select("id, org_id, invited_email, role, token, invited_by, expires_at, accepted_at, created_at")
    .single();

  if (insertError) {
    if (insertError.code === "42501") {
      return { success: false, error: "Not authorized to invite members" };
    }
    return { success: false, error: "Failed to create invite" };
  }

  // Get organization name for the email
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  // Send invite email via Resend HTTP API
  const serverEnv = getServerEnv();
  if (serverEnv.RESEND_API_KEY) {
    const appUrl =
      serverEnv.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const acceptUrl = `${appUrl}/invite/accept?token=${token}`;
    const orgName = org?.name ?? "an organization";

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Insights <noreply@insightsecon.com>",
        to: inputParseResult.data.email,
        subject: `You've been invited to join ${orgName} on Insights`,
        html: `
          <p>You've been invited to join <strong>${orgName}</strong> on Insights as a <strong>${inputParseResult.data.role}</strong>.</p>
          <p><a href="${acceptUrl}">Accept Invitation</a></p>
          <p>This invite expires in 7 days.</p>
          <p>If you did not expect this invitation, you can safely ignore this email.</p>
        `.trim(),
      }),
    }).catch(() => {
      // Email sending failures are non-fatal — the invite record is already created
    });
  }

  return {
    success: true,
    data: {
      id: invite.id,
      org_id: invite.org_id,
      invited_email: invite.invited_email,
      role: invite.role as "admin" | "member",
      token: invite.token,
      invited_by: invite.invited_by,
      expires_at: invite.expires_at,
      accepted_at: invite.accepted_at,
      created_at: invite.created_at,
    },
  };
}

/**
 * Update a member's role in an organization.
 * Requires admin or owner role.
 * Cannot change own role or owner's role (except owner transferring ownership).
 *
 * @param memberId - The member record ID
 * @param newRole - The new role to assign
 * @returns The updated member record or error
 */
export async function updateMemberRole(
  memberId: string,
  newRole: OrgMemberRole
): Promise<OrgActionResult<OrganizationMember>> {
  // Validate member ID
  const memberIdParseResult = memberIdSchema.safeParse(memberId);
  if (!memberIdParseResult.success) {
    return { success: false, error: "Invalid member ID" };
  }

  // Validate role
  const roleParseResult = roleSchema.safeParse(newRole);
  if (!roleParseResult.success) {
    return { success: false, error: "Invalid role" };
  }

  // Cannot set role to owner - use transfer ownership instead
  if (newRole === "owner") {
    return { success: false, error: "Cannot assign owner role. Use transfer ownership instead." };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the member record to check constraints
  const { data: member, error: selectError } = await supabase
    .from("organization_members")
    .select("id, org_id, user_id, role")
    .eq("id", memberId)
    .single();

  if (selectError) {
    if (selectError.code === "PGRST116") {
      return { success: false, error: "Member not found" };
    }
    return { success: false, error: "Failed to fetch member" };
  }

  // Cannot change own role
  if (member.user_id === user.id) {
    return { success: false, error: "Cannot change your own role" };
  }

  // Cannot change owner's role
  if (member.role === "owner") {
    return { success: false, error: "Cannot change owner's role. Use transfer ownership instead." };
  }

  // Update the role (RLS will check if current user is admin/owner)
  const { data: updated, error: updateError } = await supabase
    .from("organization_members")
    .update({ role: newRole })
    .eq("id", memberId)
    .select(`
      id,
      org_id,
      user_id,
      role,
      invited_at,
      joined_at,
      profiles:user_id (
        email,
        display_name
      )
    `)
    .single();

  if (updateError) {
    if (updateError.code === "42501") {
      return { success: false, error: "Not authorized to update member roles" };
    }
    return { success: false, error: "Failed to update role" };
  }

  // Type assertion for the joined profiles data
  const profiles = updated.profiles as unknown as { email?: string; display_name?: string } | null;

  return {
    success: true,
    data: {
      id: updated.id,
      org_id: updated.org_id,
      user_id: updated.user_id,
      role: updated.role as OrgMemberRole,
      invited_at: updated.invited_at,
      joined_at: updated.joined_at,
      email: profiles?.email,
      display_name: profiles?.display_name,
    },
  };
}

/**
 * Remove a member from an organization.
 * Requires admin or owner role.
 * Cannot remove the owner or yourself.
 *
 * @param memberId - The member record ID to remove
 * @returns Success/failure result
 */
export async function removeMember(memberId: string): Promise<OrgActionResult<void>> {
  // Validate member ID
  const parseResult = memberIdSchema.safeParse(memberId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid member ID" };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the member record to check constraints
  const { data: member, error: selectError } = await supabase
    .from("organization_members")
    .select("id, org_id, user_id, role")
    .eq("id", memberId)
    .single();

  if (selectError) {
    if (selectError.code === "PGRST116") {
      return { success: false, error: "Member not found" };
    }
    return { success: false, error: "Failed to fetch member" };
  }

  // Cannot remove yourself
  if (member.user_id === user.id) {
    return { success: false, error: "Cannot remove yourself from the organization" };
  }

  // Cannot remove the owner
  if (member.role === "owner") {
    return { success: false, error: "Cannot remove the organization owner" };
  }

  // Delete the member (RLS will check if current user is admin/owner)
  const { error: deleteError } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId);

  if (deleteError) {
    if (deleteError.code === "42501") {
      return { success: false, error: "Not authorized to remove members" };
    }
    return { success: false, error: "Failed to remove member" };
  }

  return { success: true, data: undefined };
}

/**
 * Transfer organization ownership to another member.
 * Only the current owner can transfer ownership.
 * The new owner must be an existing member (admin or member role).
 *
 * @param orgId - The organization ID
 * @param newOwnerUserId - The user ID of the new owner
 * @returns Success/failure result
 */
export async function transferOwnership(
  orgId: string,
  newOwnerUserId: string
): Promise<OrgActionResult<void>> {
  // Validate org ID
  const orgIdParseResult = z.string().uuid("Invalid organization ID").safeParse(orgId);
  if (!orgIdParseResult.success) {
    return { success: false, error: "Invalid organization ID" };
  }

  // Validate new owner user ID
  const userIdParseResult = userIdSchema.safeParse(newOwnerUserId);
  if (!userIdParseResult.success) {
    return { success: false, error: "Invalid user ID" };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Cannot transfer to yourself
  if (newOwnerUserId === user.id) {
    return { success: false, error: "Cannot transfer ownership to yourself" };
  }

  // Get the organization to verify current user is the owner
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, owner_id")
    .eq("id", orgId)
    .single();

  if (orgError) {
    if (orgError.code === "PGRST116") {
      return { success: false, error: "Organization not found" };
    }
    return { success: false, error: "Failed to fetch organization" };
  }

  // Only the current owner can transfer ownership
  if (org.owner_id !== user.id) {
    return { success: false, error: "Only the current owner can transfer ownership" };
  }

  // Verify the new owner is an existing member
  const { data: newOwnerMember, error: memberError } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("org_id", orgId)
    .eq("user_id", newOwnerUserId)
    .single();

  if (memberError) {
    if (memberError.code === "PGRST116") {
      return { success: false, error: "New owner must be an existing member of the organization" };
    }
    return { success: false, error: "Failed to verify new owner membership" };
  }

  // Get current owner's member record
  const { data: currentOwnerMember, error: currentOwnerError } = await supabase
    .from("organization_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (currentOwnerError) {
    return { success: false, error: "Failed to fetch current owner membership" };
  }

  // Perform the transfer in steps:
  // 1. Update the organizations table to set the new owner
  const { error: updateOrgError } = await supabase
    .from("organizations")
    .update({ owner_id: newOwnerUserId })
    .eq("id", orgId);

  if (updateOrgError) {
    return { success: false, error: "Failed to transfer ownership" };
  }

  // 2. Update the new owner's role to 'owner' in organization_members
  const { error: updateNewOwnerError } = await supabase
    .from("organization_members")
    .update({ role: "owner" })
    .eq("id", newOwnerMember.id);

  if (updateNewOwnerError) {
    // Try to rollback the org update
    await supabase.from("organizations").update({ owner_id: user.id }).eq("id", orgId);
    return { success: false, error: "Failed to update new owner role" };
  }

  // 3. Demote the current owner to admin
  const { error: updateCurrentOwnerError } = await supabase
    .from("organization_members")
    .update({ role: "admin" })
    .eq("id", currentOwnerMember.id);

  if (updateCurrentOwnerError) {
    // Try to rollback both previous updates (best effort, log failures)
    const { error: rollbackCurrentOwner } = await supabase.from("organization_members").update({ role: "owner" }).eq("id", currentOwnerMember.id);
    const { error: rollbackNewOwner } = await supabase.from("organization_members").update({ role: newOwnerMember.role }).eq("id", newOwnerMember.id);
    const { error: rollbackOrg } = await supabase.from("organizations").update({ owner_id: user.id }).eq("id", orgId);
    
    // Log rollback failures for debugging (they don't change the error returned to user)
    if (rollbackCurrentOwner || rollbackNewOwner || rollbackOrg) {
      console.error("Rollback failures during ownership transfer:", {
        rollbackCurrentOwner: rollbackCurrentOwner?.message,
        rollbackNewOwner: rollbackNewOwner?.message,
        rollbackOrg: rollbackOrg?.message,
      });
    }
    return { success: false, error: "Failed to update previous owner role" };
  }

  return { success: true, data: undefined };
}

/**
 * Leave an organization voluntarily.
 * Owners cannot leave - they must transfer ownership first.
 *
 * @param orgId - The organization ID to leave
 * @returns Success/failure result
 */
export async function leaveOrganization(orgId: string): Promise<OrgActionResult<void>> {
  // Validate org ID
  const parseResult = z.string().uuid("Invalid organization ID").safeParse(orgId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid organization ID" };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the user's membership
  const { data: member, error: selectError } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (selectError) {
    if (selectError.code === "PGRST116") {
      return { success: false, error: "You are not a member of this organization" };
    }
    return { success: false, error: "Failed to fetch membership" };
  }

  // Owner cannot leave - must transfer ownership first
  if (member.role === "owner") {
    return { success: false, error: "Owners cannot leave. Transfer ownership first." };
  }

  // Delete the membership
  const { error: deleteError } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", member.id);

  if (deleteError) {
    return { success: false, error: "Failed to leave organization" };
  }

  return { success: true, data: undefined };
}

/**
 * Create a new organization and add the creator as the owner.
 *
 * @param input - The organization details (name, slug)
 * @returns The created organization or error
 */
export async function createOrg(input: {
  name: string;
  slug: string;
}): Promise<OrgActionResult<Organization>> {
  // Validate input
  const parseResult = createOrgSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Insert the organization (owner_id = current user)
  const { data: org, error: insertOrgError } = await supabase
    .from("organizations")
    .insert({
      name: parseResult.data.name,
      slug: parseResult.data.slug,
      owner_id: user.id,
    })
    .select("id, name, slug, owner_id, created_at")
    .single();

  if (insertOrgError) {
    if (insertOrgError.code === "23505") {
      return { success: false, error: "An organization with that slug already exists" };
    }
    return { success: false, error: "Failed to create organization" };
  }

  // Add the creator as owner in organization_members
  const { error: insertMemberError } = await supabase
    .from("organization_members")
    .insert({
      org_id: org.id,
      user_id: user.id,
      role: "owner",
      joined_at: new Date().toISOString(),
    });

  if (insertMemberError) {
    // Best-effort cleanup of the org if member insert fails
    await supabase.from("organizations").delete().eq("id", org.id);
    return { success: false, error: "Failed to create organization membership" };
  }

  return {
    success: true,
    data: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      owner_id: org.owner_id,
      created_at: org.created_at,
    },
  };
}

/**
 * Accept an organization invite by token.
 * Adds the current user as a member of the organization.
 *
 * @param token - The invite token from the accept link
 * @returns The organization the user joined, or error
 */
export async function acceptInvite(token: string): Promise<OrgActionResult<Organization>> {
  // Basic validation
  if (!token || typeof token !== "string" || token.length < 32) {
    return { success: false, error: "Invalid invite token" };
  }

  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Use service client to read the invite regardless of RLS
  const serviceClient = createSupabaseServiceClient();

  // Find the invite by token
  const { data: invite, error: inviteError } = await serviceClient
    .from("organization_invites")
    .select("id, org_id, invited_email, role, expires_at, accepted_at")
    .eq("token", token)
    .single();

  if (inviteError || !invite) {
    return { success: false, error: "Invite not found or invalid" };
  }

  // Check invite has not already been accepted
  if (invite.accepted_at) {
    return { success: false, error: "This invite has already been accepted" };
  }

  // Check invite has not expired
  if (new Date(invite.expires_at) < new Date()) {
    return { success: false, error: "This invite has expired" };
  }

  // Get the user's email to validate against invited_email
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  if (!profile?.email) {
    return { success: false, error: "Could not verify your email address" };
  }

  if (profile.email.toLowerCase() !== invite.invited_email.toLowerCase()) {
    return { success: false, error: "This invite was sent to a different email address" };
  }

  // Check if already a member
  const { data: existingMembership } = await serviceClient
    .from("organization_members")
    .select("id")
    .eq("org_id", invite.org_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMembership) {
    return { success: false, error: "You are already a member of this organization" };
  }

  // Add as organization member (using service client to bypass RLS)
  const { error: memberInsertError } = await serviceClient
    .from("organization_members")
    .insert({
      org_id: invite.org_id,
      user_id: user.id,
      role: invite.role,
      joined_at: new Date().toISOString(),
    });

  if (memberInsertError) {
    return { success: false, error: "Failed to join organization" };
  }

  // Mark invite as accepted
  await serviceClient
    .from("organization_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  // Fetch and return the organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug, owner_id, created_at")
    .eq("id", invite.org_id)
    .single();

  if (orgError || !org) {
    return { success: false, error: "Joined organization but failed to fetch details" };
  }

  return {
    success: true,
    data: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      owner_id: org.owner_id,
      created_at: org.created_at,
    },
  };
}

/**
 * Get all organizations the current user is a member of.
 *
 * @returns List of organizations the user belongs to
 */
export async function listUserOrganizations(): Promise<OrgActionResult<Organization[]>> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("organizations:org_id (id, name, slug, owner_id, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: "Failed to fetch organizations" };
  }

  const orgs: Organization[] = (data ?? [])
    .map((row) => {
      const org = row.organizations as unknown as Organization | null;
      return org;
    })
    .filter((org): org is Organization => org !== null);

  return { success: true, data: orgs };
}
