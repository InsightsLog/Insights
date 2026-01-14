"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  listOrganizationMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  transferOwnership,
  leaveOrganization,
  type OrganizationMember,
} from "@/app/actions/organizations";

/**
 * Valid roles for organization members.
 */
const ROLES = [
  { value: "owner", label: "Owner", description: "Full control, can transfer ownership" },
  { value: "admin", label: "Admin", description: "Can manage members and settings" },
  { value: "billing_admin", label: "Billing Admin", description: "Can manage billing and subscriptions" },
  { value: "member", label: "Member", description: "Can view organization resources" },
] as const;

type OrgMemberRole = "owner" | "admin" | "billing_admin" | "member";

/**
 * Formats a date string to a human-readable format.
 */
function formatDate(isoString: string | null): string {
  if (!isoString) return "Pending";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface OrganizationSettingsClientProps {
  orgId: string;
  orgName: string;
  orgSlug: string;
  currentUserRole: OrgMemberRole;
  currentUserId: string;
}

/**
 * Organization settings client component.
 * Allows managing organization members, roles, and ownership.
 */
export function OrganizationSettingsClient({
  orgId,
  orgName,
  orgSlug,
  currentUserRole,
  currentUserId,
}: OrganizationSettingsClientProps) {
  const router = useRouter();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgMemberRole>("member");
  const [inviting, setInviting] = useState(false);

  // Role edit state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<OrgMemberRole>("member");
  const [updatingRole, setUpdatingRole] = useState(false);

  // Remove member state
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Transfer ownership state
  const [showTransferConfirm, setShowTransferConfirm] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  // Leave organization state
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const hasFetched = useRef(false);

  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";
  const isOwner = currentUserRole === "owner";

  // Fetch members on mount and when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger === 0 && hasFetched.current) {
      return;
    }
    hasFetched.current = true;

    let cancelled = false;

    async function fetchMembers() {
      setLoading(true);
      setError(null);
      const result = await listOrganizationMembers(orgId);
      if (cancelled) return;
      if (result.success) {
        setMembers(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }

    fetchMembers();

    return () => {
      cancelled = true;
    };
  }, [orgId, refreshTrigger]);

  const refreshMembers = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Show success message temporarily
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Handle inviting a new member
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setError(null);

    const result = await inviteMember(orgId, {
      email: inviteEmail.trim(),
      role: inviteRole,
    });

    if (result.success) {
      setInviteEmail("");
      setInviteRole("member");
      showSuccess(`Successfully invited ${result.data.email || "member"}`);
      refreshMembers();
    } else {
      setError(result.error);
    }
    setInviting(false);
  };

  // Handle updating a member's role
  const handleUpdateRole = async (memberId: string) => {
    setUpdatingRole(true);
    setError(null);

    const result = await updateMemberRole(memberId, editRole);

    if (result.success) {
      setEditingMemberId(null);
      showSuccess("Role updated successfully");
      refreshMembers();
    } else {
      setError(result.error);
    }
    setUpdatingRole(false);
  };

  // Handle removing a member
  const handleRemove = async (memberId: string) => {
    setRemovingMemberId(memberId);
    setError(null);
    setShowRemoveConfirm(null);

    const result = await removeMember(memberId);
    if (result.success) {
      showSuccess("Member removed successfully");
      refreshMembers();
    } else {
      setError(result.error);
    }
    setRemovingMemberId(null);
  };

  // Handle transferring ownership
  const handleTransferOwnership = async (newOwnerUserId: string) => {
    setTransferring(true);
    setError(null);
    setShowTransferConfirm(null);

    const result = await transferOwnership(orgId, newOwnerUserId);
    if (result.success) {
      showSuccess("Ownership transferred successfully");
      // Refresh the page to update the current user's role
      router.refresh();
      refreshMembers();
    } else {
      setError(result.error);
    }
    setTransferring(false);
  };

  // Handle leaving the organization
  const handleLeave = async () => {
    setLeaving(true);
    setError(null);
    setShowLeaveConfirm(false);

    const result = await leaveOrganization(orgId);
    if (result.success) {
      // Redirect to home after leaving
      router.push("/");
    } else {
      setError(result.error);
      setLeaving(false);
    }
  };

  // Start editing a member's role
  const startEditRole = (member: OrganizationMember) => {
    setEditingMemberId(member.id);
    setEditRole(member.role);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingMemberId(null);
    setEditRole("member");
  };

  // Get display name for a member (with defensive null handling)
  const getMemberDisplayName = (member: OrganizationMember | null | undefined): string => {
    if (!member) return "Unknown User";
    if (member.display_name) return member.display_name;
    if (member.email) return member.email;
    return "Unknown User";
  };

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
            {orgName}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Organization Settings • {orgSlug}
          </p>
        </div>

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
                aria-label="Dismiss"
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

        {/* Success message */}
        {successMessage && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-900/20">
            <p className="text-sm font-medium text-green-800 dark:text-green-400">
              {successMessage}
            </p>
          </div>
        )}

        {/* Invite member form - only for admins and owners */}
        {isAdmin && (
          <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Invite Member
            </h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1">
                  <label
                    htmlFor="inviteEmail"
                    className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="inviteEmail"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    disabled={inviting}
                    required
                  />
                </div>
                <div className="sm:w-40">
                  <label
                    htmlFor="inviteRole"
                    className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Role
                  </label>
                  <select
                    id="inviteRole"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrgMemberRole)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    disabled={inviting}
                  >
                    <option value="member">Member</option>
                    <option value="billing_admin">Billing Admin</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {inviting ? "Inviting..." : "Invite Member"}
              </button>
            </form>
          </div>
        )}

        {/* Members list */}
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Members ({members.length})
            </h2>
          </div>

          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Loading...
            </div>
          ) : members.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                No members
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Invite members to collaborate in this organization.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {members.map((member) => (
                <div key={member.id} className="p-4">
                  {editingMemberId === member.id ? (
                    // Edit mode
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {getMemberDisplayName(member)}
                          </span>
                          {member.user_id === currentUserId && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              You
                            </span>
                          )}
                        </div>
                        {member.email && member.display_name && (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {member.email}
                          </p>
                        )}
                      </div>
                      <div className="ml-4 flex items-center gap-2">
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as OrgMemberRole)}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          disabled={updatingRole}
                        >
                          <option value="member">Member</option>
                          <option value="billing_admin">Billing Admin</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => handleUpdateRole(member.id)}
                          disabled={updatingRole}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updatingRole ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={updatingRole}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {getMemberDisplayName(member)}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              member.role === "owner"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                                : member.role === "admin"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                : member.role === "billing_admin"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {member.role === "billing_admin" ? "Billing Admin" : member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                          </span>
                          {member.user_id === currentUserId && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              You
                            </span>
                          )}
                        </div>
                        {member.email && member.display_name && (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {member.email}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Joined: {formatDate(member.joined_at)}
                        </p>
                      </div>

                      <div className="ml-4 flex items-center gap-2">
                        {/* Actions - different based on member's role and current user's permissions */}
                        {isAdmin && member.role !== "owner" && member.user_id !== currentUserId && (
                          <>
                            <button
                              onClick={() => startEditRole(member)}
                              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              Change Role
                            </button>
                            {showRemoveConfirm === member.id ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleRemove(member.id)}
                                  disabled={removingMemberId === member.id}
                                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                                >
                                  {removingMemberId === member.id ? "Removing..." : "Confirm"}
                                </button>
                                <button
                                  onClick={() => setShowRemoveConfirm(null)}
                                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowRemoveConfirm(member.id)}
                                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                              >
                                Remove
                              </button>
                            )}
                          </>
                        )}
                        
                        {/* Transfer ownership button - only shown to owner for other members */}
                        {isOwner && member.user_id !== currentUserId && (
                          <>
                            {showTransferConfirm === member.user_id ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleTransferOwnership(member.user_id)}
                                  disabled={transferring}
                                  className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
                                >
                                  {transferring ? "Transferring..." : "Confirm Transfer"}
                                </button>
                                <button
                                  onClick={() => setShowTransferConfirm(null)}
                                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowTransferConfirm(member.user_id)}
                                className="rounded-md border border-purple-300 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-400 dark:hover:bg-purple-900/20"
                                title="Transfer ownership to this member"
                              >
                                Make Owner
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leave organization section - for non-owners */}
        {!isOwner && (
          <div className="mt-8 rounded-lg border border-red-200 bg-white p-6 dark:border-red-900/50 dark:bg-zinc-900">
            <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Leave Organization
            </h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              You will lose access to all organization resources. This action cannot be undone.
            </p>
            {showLeaveConfirm ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleLeave}
                  disabled={leaving}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  {leaving ? "Leaving..." : "Confirm Leave"}
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Leave Organization
              </button>
            )}
          </div>
        )}

        {/* Role descriptions */}
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Role Permissions
          </h2>
          <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            {ROLES.map((role) => (
              <div key={role.value} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    role.value === "owner"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                      : role.value === "admin"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                      : role.value === "billing_admin"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {role.label}
                </span>
                <span>{role.description}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
