import { redirect } from "next/navigation";
import Link from "next/link";
import { checkAdminRole } from "@/lib/supabase/auth";
import { getReleasesForAdmin } from "@/app/actions/admin";
import { ReleasesClient } from "./ReleasesClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin – Manage Releases",
  description: "Edit consensus forecast values for economic releases",
  robots: { index: false, follow: false },
};

export default async function AdminReleasesPage() {
  const adminCheck = await checkAdminRole();

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const result = await getReleasesForAdmin(100);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Admin Dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Manage Releases
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Edit consensus forecast values for upcoming and recent releases.
          </p>
        </div>

        {!result.success ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              {result.error}
            </p>
          </div>
        ) : (
          <ReleasesClient initialReleases={result.data} />
        )}
      </main>
    </div>
  );
}
