import { createSupabaseServerClient } from "./server";

/**
 * User profile returned by auth helper functions.
 * Based on the profiles table schema from T100.
 */
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Gets the currently authenticated user's profile.
 * Returns null if no user is logged in.
 *
 * This helper:
 * 1. Gets the authenticated user from Supabase Auth
 * 2. Fetches their profile from the profiles table
 *
 * @returns UserProfile if logged in, null if logged out
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createSupabaseServerClient();

  // Get the authenticated user from Supabase Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // If no user or auth error, return null (not logged in)
  if (authError || !user) {
    return null;
  }

  // Fetch the user's profile from the profiles table
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, display_name, created_at, updated_at")
    .eq("id", user.id)
    .single();

  // If profile fetch fails or profile doesn't exist, return null
  if (profileError || !profile) {
    return null;
  }

  return profile as UserProfile;
}
