import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Routes that should skip session refresh in middleware.
 * These routes either:
 * - Use alternative authentication mechanisms (e.g., signed tokens)
 * - Need to establish a session first (e.g., auth callback)
 * and should not trigger cookie manipulation that could interfere.
 */
const SKIP_SESSION_REFRESH_ROUTES = ["/unsubscribe", "/auth/callback"];

/**
 * Check if a route should skip session refresh.
 */
function shouldSkipSessionRefresh(pathname: string): boolean {
  return SKIP_SESSION_REFRESH_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
}

/**
 * Middleware that refreshes Supabase auth session on each request.
 * This ensures auth cookies are refreshed before they expire.
 * 
 * Note: This is lightweight middleware - it only refreshes session cookies.
 * Actual authentication/authorization checks should happen in server-side code.
 * 
 * See: https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function middleware(request: NextRequest) {
  // Create a response that we can modify
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Add pathname header for use in layouts that need to know the current route
  // This enables conditional auth checking based on the route
  supabaseResponse.headers.set("x-pathname", request.nextUrl.pathname);

  // Skip session refresh for routes that don't require it
  // This prevents cookie manipulation that could interfere with the user's session
  if (shouldSkipSessionRefresh(request.nextUrl.pathname)) {
    return supabaseResponse;
  }

  // Create Supabase client with cookie handling for middleware
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
          // Preserve the pathname header when recreating the response
          supabaseResponse.headers.set("x-pathname", request.nextUrl.pathname);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session by calling getUser()
  // IMPORTANT: Do not remove this call - it refreshes the session cookie
  // Do not run code between createServerClient and getUser() to avoid
  // hard-to-debug issues with users being randomly logged out.
  // 
  // NOTE: We use getUser() instead of getClaims() because:
  // - getUser() makes a request to Supabase Auth to refresh the token
  // - getClaims() only validates the JWT locally and does NOT refresh tokens
  // See: https://supabase.com/docs/guides/auth/server-side/creating-a-client
  await supabase.auth.getUser();

  return supabaseResponse;
}

/**
 * Configure which routes the middleware runs on.
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
