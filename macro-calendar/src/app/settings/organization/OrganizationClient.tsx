"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOrg, inviteMember, type Organization, type OrganizationInvite } from "@/app/actions/organizations";

type OrgWithRole = Organization & {
  currentUserRole: "owner" | "admin" | "billing_admin" | "member";
};

interface OrganizationClientProps {
  organizations: OrgWithRole[];
  currentUserId: string;
}

/**
 * Generates a slug from an organization name.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/**
 * Organization settings client component.
 * Allows users to create organizations and invite members.
 */
export function OrganizationClient({ organizations }: OrganizationClientProps) {
  const router = useRouter();

  // Create org form state
  const [showCreateForm, setShowCreateForm] = useState(organizations.length === 0);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [creating, setCreating] = useState(false);

  // Invite form state (keyed by org id)
  const [activeInviteOrgId, setActiveInviteOrgId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleNameChange = (value: string) => {
    setOrgName(value);
    setOrgSlug(slugify(value));
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const result = await createOrg({ name: orgName.trim(), slug: orgSlug.trim() });

    if (result.success) {
      showSuccess(`Organization "${result.data.name}" created successfully!`);
      setOrgName("");
      setOrgSlug("");
      setShowCreateForm(false);
      router.refresh();
    } else {
      setError(result.error);
    }
    setCreating(false);
  };

  const handleInvite = async (e: React.FormEvent, orgId: string) => {
    e.preventDefault();
    setInviting(true);
    setError(null);

    const result: { success: boolean; data?: OrganizationInvite; error?: string } = await inviteMember(orgId, {
      email: inviteEmail.trim(),
      role: inviteRole,
    });

    if (result.success) {
      showSuccess(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      setInviteRole("member");
      setActiveInviteOrgId(null);
    } else {
      setError(result.error ?? "Failed to send invite");
    }
    setInviting(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
            ← Back to Calendar
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Organization
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Create an organization and invite team members to share API quota and watchlists.
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 dark:text-red-400"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-900/20">
            <p className="text-sm font-medium text-green-800 dark:text-green-400">{successMessage}</p>
          </div>
        )}

        {/* Existing organizations */}
        {organizations.length > 0 && (
          <div className="mb-8 space-y-6">
            {organizations.map((org) => {
              const isAdmin = org.currentUserRole === "owner" || org.currentUserRole === "admin";
              const isInviting = activeInviteOrgId === org.id;

              return (
                <div
                  key={org.id}
                  className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* Org header */}
                  <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {org.name}
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">/{org.slug}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          org.currentUserRole === "owner"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                            : org.currentUserRole === "admin"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {org.currentUserRole}
                      </span>
                      <Link
                        href={`/org/${org.slug}/settings`}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Manage Members
                      </Link>
                    </div>
                  </div>

                  {/* Invite section */}
                  {isAdmin && (
                    <div className="px-5 py-4">
                      {isInviting ? (
                        <form
                          onSubmit={(e) => handleInvite(e, org.id)}
                          className="space-y-3"
                        >
                          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Invite by Email
                          </h3>
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="user@example.com"
                              required
                              disabled={inviting}
                              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                            <select
                              value={inviteRole}
                              onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                              disabled={inviting}
                              className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:w-32"
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={inviting || !inviteEmail.trim()}
                              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {inviting ? "Sending..." : "Send Invite"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveInviteOrgId(null);
                                setInviteEmail("");
                                setInviteRole("member");
                              }}
                              disabled={inviting}
                              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => setActiveInviteOrgId(org.id)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          + Invite member
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Create organization */}
        {showCreateForm ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Create Organization
            </h2>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label
                  htmlFor="orgName"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Organization Name
                </label>
                <input
                  id="orgName"
                  type="text"
                  value={orgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Acme Corp"
                  required
                  maxLength={100}
                  disabled={creating}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label
                  htmlFor="orgSlug"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Slug
                </label>
                <input
                  id="orgSlug"
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  placeholder="acme-corp"
                  required
                  maxLength={100}
                  pattern="[a-z0-9-]+"
                  title="Only lowercase letters, numbers, and hyphens"
                  disabled={creating}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Lowercase letters, numbers, and hyphens only.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={creating || !orgName.trim() || !orgSlug.trim()}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Organization"}
                </button>
                {organizations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded-md border border-dashed border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
          >
            + Create another organization
          </button>
        )}

        {/* Info box */}
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/10">
          <h3 className="mb-1 text-sm font-medium text-blue-900 dark:text-blue-300">
            About Organizations
          </h3>
          <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-400">
            <li>• Members share the organization&apos;s API key quota.</li>
            <li>• Invite members by email — they receive an accept link.</li>
            <li>• Owners and admins can manage members and roles.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
