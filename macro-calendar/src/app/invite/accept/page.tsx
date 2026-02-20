import { Suspense } from "react";
import { AcceptInviteClient } from "./AcceptInviteClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept Invitation",
  description: "Accept your organization invitation",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Accept organization invite page.
 * Reads the token from the URL query param and processes the invitation.
 */
export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <AcceptInviteClient />
    </Suspense>
  );
}
