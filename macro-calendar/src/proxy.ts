import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Proxy function that refreshes Supabase auth session on each request.
 * This ensures auth cookies are refreshed before they expire.
 * 
 * Note: This is a lightweight proxy - it only refreshes session cookies.
 * Actual authentication/authorization checks should happen in server-side code.
 * 
 * See: https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function proxy(request: NextRequest) {
  // Create a response that we can modify
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Create Supabase client with cookie handling for proxy
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream handlers)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Set cookies on the response (to be sent to browser)
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session by calling getUser()
  // IMPORTANT: Do not remove this call - it refreshes the session cookie
  // The return value is intentionally unused; the side effect is cookie refresh
  await supabase.auth.getUser();

  return supabaseResponse;
}

/**
 * Configure which routes the proxy runs on.
 * Excludes static files and Next.js internals.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
