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
 */
export function Header({ initialUser }: HeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="hover:opacity-80">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Macro Calendar
            </h1>
          </Link>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upcoming economic releases — next 7 days
          </p>
        </div>
        <UserMenu initialUser={initialUser} />
      </div>
    </header>
  );
}
