/**
 * GET /api/calendar/ical - Export watchlist releases as iCal/ICS file
 *
 * Requires authentication via session cookie.
 *
 * Task: T341 - Add calendar integrations
 */

import { NextResponse } from "next/server";
import { exportWatchlistToICal } from "@/app/actions/calendar";

export async function GET(): Promise<NextResponse> {
  // Call the export action
  const result = await exportWatchlistToICal();

  if (!result.success) {
    // Return appropriate status codes based on error
    if (result.error === "Not authenticated") {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    if (result.error === "No indicators in watchlist") {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Return the iCal file as a download
  return new NextResponse(result.data, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
