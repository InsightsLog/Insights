/**
 * GET /api/v1/calendar/[userId]/feed.ics
 *
 * Returns a valid iCal (.ics) feed of upcoming releases for a user's watchlist.
 * Authenticated via ?token= query parameter (API key value).
 * Only includes watchlisted indicators for the next 90 days.
 *
 * Task: T492 - Add release calendar iCal feed
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import {
  generateICalendar,
  releaseToCalendarEvent,
  type ReleaseWithIndicator,
} from "@/lib/ical";

/** Number of days ahead to include in the feed. */
const FEED_DAYS = 90;

/** Maximum releases to include (to keep the file manageable). */
const MAX_RELEASES = 500;

/**
 * Hash an API key using SHA-256.
 * Matches the hashing used when creating/authenticating API keys.
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  // Require token parameter
  if (!token) {
    return new NextResponse("Missing token", { status: 401 });
  }

  // Basic format check — token must be an API key
  if (!token.startsWith("mc_") || token.length < 10) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const keyHash = hashApiKey(token);

  // Look up API key by hash
  const { data: keyData, error: keyError } = await supabase
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", keyHash)
    .single();

  if (keyError || !keyData) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  if (keyData.revoked_at) {
    return new NextResponse("Token has been revoked", { status: 401 });
  }

  // Ensure the token belongs to the requested user
  if (keyData.user_id !== userId) {
    return new NextResponse("Unauthorized", { status: 403 });
  }

  try {
    // Fetch user's personal watchlist indicator IDs
    const { data: watchlistData, error: watchlistError } = await supabase
      .from("watchlist")
      .select("indicator_id")
      .eq("user_id", userId)
      .is("org_id", null);

    if (watchlistError) {
      console.error("[iCal feed] Failed to fetch watchlist:", watchlistError);
      return new NextResponse("Internal server error", { status: 500 });
    }

    if (!watchlistData || watchlistData.length === 0) {
      // Return an empty but valid calendar
      const content = generateICalendar([], {
        calendarName: "My Watchlist — Macro Calendar",
        productId: "-//Macro Calendar//Watchlist Feed//EN",
      });
      return new NextResponse(content, {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": 'attachment; filename="watchlist.ics"',
        },
      });
    }

    const indicatorIds = watchlistData.map((w) => w.indicator_id);

    // Calculate date range: now → now + 90 days
    const now = new Date();
    const cutoff = new Date(now.getTime() + FEED_DAYS * 24 * 60 * 60 * 1000);

    // Fetch upcoming releases with indicator details
    const { data: releasesData, error: releasesError } = await supabase
      .from("releases")
      .select(
        `
        id, indicator_id, release_at, period, forecast, previous,
        indicator:indicators!inner(id, name, country_code, category)
      `
      )
      .in("indicator_id", indicatorIds)
      .gte("release_at", now.toISOString())
      .lte("release_at", cutoff.toISOString())
      .order("release_at", { ascending: true })
      .limit(MAX_RELEASES);

    if (releasesError) {
      console.error("[iCal feed] Failed to fetch releases:", releasesError);
      return new NextResponse("Internal server error", { status: 500 });
    }

    // Transform to calendar events
    const events = (releasesData ?? []).map((r) => {
      const indicator = Array.isArray(r.indicator) ? r.indicator[0] : r.indicator;
      const release: ReleaseWithIndicator = {
        id: r.id,
        indicator_id: indicator?.id ?? r.indicator_id,
        release_at: r.release_at,
        period: r.period,
        forecast: r.forecast,
        previous: r.previous,
        indicator_name: indicator?.name ?? "",
        country_code: indicator?.country_code ?? "",
        category: indicator?.category ?? "",
      };
      return releaseToCalendarEvent(release);
    });

    const content = generateICalendar(events, {
      calendarName: "My Watchlist — Macro Calendar",
      productId: "-//Macro Calendar//Watchlist Feed//EN",
    });

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="watchlist.ics"',
      },
    });
  } catch (err) {
    console.error("[iCal feed] Unexpected error:", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
