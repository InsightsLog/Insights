import Link from "next/link";
import { UserMenu } from "./UserMenu";
import type { UserProfile } from "@/lib/supabase/auth";

type HeaderProps = {
  initialUser: UserProfile | null;
};

/**
 * Global header component for the Macro Calendar app.
 * 
 * Displays:
 * - App title (linked to home)
 * - Subtitle
 * - UserMenu (sign in/out controls)
 * 
 * This component should be included in the root layout to appear on all pages.
 * Receives initial auth state from server to prevent layout shift.
 * 
 * Mobile responsive: stacks vertically on small screens, reduces padding.
 */
export function Header({ initialUser }: HeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6 sm:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <Link href="/" className="hover:opacity-80">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 sm:text-xl">
              Macro Calendar
            </h1>
          </Link>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
            Upcoming economic releases — next 7 days
          </p>
        </div>
        <div className="flex-shrink-0">
          <UserMenu initialUser={initialUser} />
        </div>
      </div>
    </header>
  );
}
