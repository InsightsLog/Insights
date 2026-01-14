"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  generateICalendar,
  releaseToCalendarEvent,
  type ReleaseWithIndicator,
} from "@/lib/ical";

/**
 * Maximum number of releases to include in iCal feed.
 * Prevents oversized calendar files.
 */
const MAX_ICAL_RELEASES = 500;

/**
 * Result type for iCal export actions.
 */
export type ICalExportResult =
  | { success: true; data: string; filename: string; contentType: string }
  | { success: false; error: string };

/**
 * Export the current user's watchlist upcoming releases as an iCal/ICS file.
 * Fetches upcoming releases for all indicators in the user's watchlist.
 *
 * @returns iCal file content, filename, and content type
 *
 * Task: T341 - Add calendar integrations
 */
export async function exportWatchlistToICal(): Promise<ICalExportResult> {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch user's watchlist indicator IDs
  const { data: watchlistData, error: watchlistError } = await supabase
    .from("watchlist")
    .select("indicator_id")
    .eq("user_id", user.id)
    .is("org_id", null); // Only personal watchlist

  if (watchlistError) {
    return { success: false, error: "Failed to fetch watchlist" };
  }

  if (!watchlistData || watchlistData.length === 0) {
    return { success: false, error: "No indicators in watchlist" };
  }

  const indicatorIds = watchlistData.map((w) => w.indicator_id);

  // Fetch upcoming releases for all watchlist indicators with indicator details
  const { data: releasesData, error: releasesError } = await supabase
    .from("releases")
    .select(
      `
      id, indicator_id, release_at, period, forecast, previous,
      indicator:indicators!inner(id, name, country_code, category)
    `
    )
    .in("indicator_id", indicatorIds)
    .gte("release_at", new Date().toISOString())
    .order("release_at", { ascending: true })
    .limit(MAX_ICAL_RELEASES);

  if (releasesError) {
    return { success: false, error: "Failed to fetch releases" };
  }

  // Transform data to calendar events
  const releases: ReleaseWithIndicator[] = (releasesData ?? []).map((r) => {
    // Handle Supabase's embedded relation format (can be array or object)
    const indicator = Array.isArray(r.indicator) ? r.indicator[0] : r.indicator;
    return {
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
  });

  // Convert releases to calendar events
  const calendarEvents = releases.map((release) =>
    releaseToCalendarEvent(release)
  );

  // Generate iCal file
  const icalContent = generateICalendar(calendarEvents, {
    calendarName: "My Watchlist - Macro Calendar",
    productId: "-//Macro Calendar//Watchlist//EN",
  });

  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  return {
    success: true,
    data: icalContent,
    filename: `watchlist-calendar-${timestamp}.ics`,
    contentType: "text/calendar",
  };
}

/**
 * Get watchlist releases formatted for calendar integration UI.
 * Returns release data with Google Calendar URLs for each event.
 *
 * @returns Array of releases with Google Calendar URLs
 *
 * Task: T341 - Add calendar integrations
 */
export async function getWatchlistCalendarEvents(): Promise<
  | {
      success: true;
      data: Array<{
        id: string;
        title: string;
        startTime: string;
        googleCalendarUrl: string;
        indicator_name: string;
        country_code: string;
        period: string;
      }>;
    }
  | { success: false; error: string }
> {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch user's watchlist indicator IDs
  const { data: watchlistData, error: watchlistError } = await supabase
    .from("watchlist")
    .select("indicator_id")
    .eq("user_id", user.id)
    .is("org_id", null);

  if (watchlistError) {
    return { success: false, error: "Failed to fetch watchlist" };
  }

  if (!watchlistData || watchlistData.length === 0) {
    return { success: true, data: [] };
  }

  const indicatorIds = watchlistData.map((w) => w.indicator_id);

  // Fetch upcoming releases
  const { data: releasesData, error: releasesError } = await supabase
    .from("releases")
    .select(
      `
      id, indicator_id, release_at, period, forecast, previous,
      indicator:indicators!inner(id, name, country_code, category)
    `
    )
    .in("indicator_id", indicatorIds)
    .gte("release_at", new Date().toISOString())
    .order("release_at", { ascending: true })
    .limit(50); // Only show next 50 events in UI

  if (releasesError) {
    return { success: false, error: "Failed to fetch releases" };
  }

  // Import dynamically to avoid circular dependency
  const { generateGoogleCalendarUrl } = await import("@/lib/ical");

  // Transform to calendar event format with Google Calendar URLs
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

    const calendarEvent = releaseToCalendarEvent(release);

    return {
      id: r.id,
      title: calendarEvent.title,
      startTime: r.release_at,
      googleCalendarUrl: generateGoogleCalendarUrl(calendarEvent),
      indicator_name: indicator?.name ?? "",
      country_code: indicator?.country_code ?? "",
      period: r.period,
    };
  });

  return { success: true, data: events };
}
