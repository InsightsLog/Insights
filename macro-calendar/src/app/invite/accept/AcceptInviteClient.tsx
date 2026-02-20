"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptInvite } from "@/app/actions/organizations";

/**
 * Accept invite client component.
 * Reads the token from the URL and calls acceptInvite.
 */
export function AcceptInviteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    token ? null : "No invite token provided."
  );
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    acceptInvite(token)
      .then((result) => {
        if (result.success) {
          setOrgName(result.data.name);
          setStatus("success");
          // Redirect to org settings after a short delay
          setTimeout(() => {
            router.push(`/org/${result.data.slug}/settings`);
          }, 2000);
        } else {
          setErrorMessage(result.error);
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMessage("An unexpected error occurred.");
        setStatus("error");
      });
  }, [token, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        {status === "loading" && (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Accepting invite…
            </h1>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Welcome to {orgName}!
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              You&apos;ve joined the organization. Redirecting you now…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Unable to accept invite
            </h1>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {errorMessage ?? "This invite link is invalid or has expired."}
            </p>
            <Link
              href="/"
              className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Go to Calendar
            </Link>
          </>
        )}

        {status === "idle" && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Processing…</p>
        )}
      </div>
    </div>
  );
}
