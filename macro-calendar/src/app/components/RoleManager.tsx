"use client";

import { useCallback, useState } from "react";
import { updateUserRole } from "@/app/actions/admin";

type RoleManagerProps = {
  userId: string;
  userEmail: string;
  initialRole: "admin" | "user" | null;
  currentAdminUserId: string;
};

/**
 * Client component that allows admins to grant/revoke admin role for a user.
 *
 * States:
 * - Loading: shows loading indicator during role update
 * - Success: shows updated role with success feedback
 * - Error: shows error message
 *
 * Prevents admins from demoting themselves.
 */
export function RoleManager({
  userId,
  userEmail,
  initialRole,
  currentAdminUserId,
}: RoleManagerProps) {
  const [role, setRole] = useState<"admin" | "user">(initialRole ?? "user");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check if this is the current admin user
  const isSelf = userId === currentAdminUserId;

  const handleRoleChange = useCallback(
    async (newRole: "admin" | "user") => {
      if (isUpdating || newRole === role) return;

      setIsUpdating(true);
      setError(null);
      setShowSuccess(false);

      try {
        const result = await updateUserRole(userId, newRole);

        if (result.success) {
          setRole(result.data.role);
          setShowSuccess(true);
          // Hide success message after 2 seconds
          setTimeout(() => setShowSuccess(false), 2000);
        } else {
          setError(result.error);
        }
      } catch (err) {
        console.error("Error updating user role:", err);
        setError("Failed to update role");
      } finally {
        setIsUpdating(false);
      }
    },
    [userId, role, isUpdating]
  );

  // Loading state
  if (isUpdating) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Updating...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={(e) =>
            handleRoleChange(e.target.value as "admin" | "user")
          }
          disabled={isSelf}
          className={`h-8 rounded-md border px-2 text-sm ${
            isSelf
              ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
              : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-500"
          }`}
          aria-label={`Role for ${userEmail}`}
          title={isSelf ? "Cannot change your own role" : `Change role for ${userEmail}`}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        {showSuccess && (
          <span
            className="text-xs font-medium text-green-600 dark:text-green-400"
            role="status"
          >
            ✓ Saved
          </span>
        )}
      </div>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      )}
      {isSelf && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          (Your account)
        </span>
      )}
    </div>
  );
}
