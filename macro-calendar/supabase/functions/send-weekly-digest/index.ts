/**
 * Edge Function: send-weekly-digest
 * Task: T421
 *
 * Sends a weekly email digest to opted-in users listing upcoming high-impact
 * releases for the next 7 days.  Designed to be invoked every Monday at
 * 06:00 UTC via pg_cron + pg_net (see migration 023_add_digest_opt_in.sql).
 *
 * Env vars required (set in Supabase project secrets):
 *   SUPABASE_URL            – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – Supabase service-role key
 *   RESEND_API_KEY          – Resend API key for sending emails
 *   EMAIL_FROM              – Sender address (e.g. digest@macrocalendar.com)
 *   APP_URL                 – Public app URL (e.g. https://macrocalendar.com)
 */

import { createClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReleaseRow {
  id: string;
  release_at: string;
  period: string;
  forecast: string | null;
  unit: string | null;
  indicators: {
    id: string;
    name: string;
    country_code: string;
    category: string;
  };
}

interface DigestUser {
  user_id: string;
  profiles: {
    email: string;
  };
}

// ---------------------------------------------------------------------------
// Supabase client (service-role, bypasses RLS)
// ---------------------------------------------------------------------------

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL =
  Deno.env.get("EMAIL_FROM") || "digest@macrocalendar.com";
const APP_URL = Deno.env.get("APP_URL") || "https://macrocalendar.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a 2-letter ISO country code to its flag emoji.
 * e.g. "US" → 🇺🇸
 */
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

/**
 * Format a date key (YYYY-MM-DD) as a human-readable day heading.
 * e.g. "2026-02-23" → "Monday, 23 February 2026"
 */
function formatDayHeading(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// Email helpers
// ---------------------------------------------------------------------------

/**
 * Send an email via the Resend API.
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", data);
      return {
        success: false,
        error: data.message || "Failed to send email",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: String(error) };
  }
}

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------

/**
 * Build the HTML + plain-text digest email for a single user.
 *
 * @param releasesByDay  Map of "YYYY-MM-DD" → releases for that day (sorted chronologically)
 * @param weekStart      ISO string of the digest start date (today / Monday)
 * @param weekEnd        ISO string of the digest end date (today + 7 days)
 */
function buildDigestEmail(
  releasesByDay: Map<string, ReleaseRow[]>,
  weekStart: string,
  weekEnd: string
): { subject: string; html: string; text: string } {
  const startFmt = new Date(weekStart).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const endFmt = new Date(weekEnd).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const subject = `📅 Weekly Macro Digest – ${startFmt} to ${endFmt}`;

  // ── HTML ────────────────────────────────────────────────────────────────

  const dayBlocksHtml = [...releasesByDay.entries()]
    .map(([dateKey, releases]) => {
      const rowsHtml = releases
        .map((r) => {
          const flag = countryFlag(r.indicators.country_code);
          const time = new Date(r.release_at).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          });
          const forecast = r.forecast
            ? `${r.forecast}${r.unit ? ` ${r.unit}` : ""}`
            : "—";

          return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;font-size:14px;">
          ${flag}&nbsp;${r.indicators.name}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;font-size:13px;color:#6c757d;white-space:nowrap;">
          ${r.indicators.country_code} · ${r.indicators.category}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;font-size:13px;color:#495057;white-space:nowrap;">
          ${time} UTC
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;font-size:13px;text-align:right;color:#007bff;">
          ${forecast}
        </td>
      </tr>`;
        })
        .join("");

      return `
    <div style="margin-bottom:28px;">
      <h3 style="margin:0 0 10px;font-size:15px;color:#343a40;border-left:4px solid #667eea;padding-left:10px;">
        ${formatDayHeading(dateKey)}
      </h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e9ecef;">
        <thead>
          <tr style="background:#f8f9fa;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6c757d;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Indicator</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6c757d;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Country / Category</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6c757d;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Time</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6c757d;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Forecast</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}
        </tbody>
      </table>
    </div>`;
    })
    .join("");

  const totalReleases = [...releasesByDay.values()].reduce(
    (n, rs) => n + rs.length,
    0
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Weekly Macro Digest</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333;max-width:660px;margin:0 auto;padding:20px;background:#f4f6f9;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px 30px;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0 0 6px;font-size:24px;">📅 Weekly Macro Digest</h1>
    <p style="color:rgba(255,255,255,.85);margin:0;font-size:15px;">
      Upcoming high-impact releases &middot; ${startFmt} – ${endFmt}
    </p>
  </div>

  <!-- Body -->
  <div style="background:#f8f9fa;padding:30px;border:1px solid #e9ecef;border-top:none;">

    <p style="margin:0 0 24px;color:#495057;">
      Here are the <strong>${totalReleases} high-impact economic release${totalReleases !== 1 ? "s" : ""}</strong>
      scheduled for the coming week.
    </p>

    ${
      releasesByDay.size > 0
        ? dayBlocksHtml
        : `<p style="color:#6c757d;text-align:center;padding:30px 0;">No high-impact releases are scheduled for this week.</p>`
    }

    <div style="text-align:center;margin-top:30px;">
      <a href="${APP_URL}" style="background:#667eea;color:#fff;padding:12px 30px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
        Open Calendar
      </a>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#e9ecef;padding:20px;border-radius:0 0 12px 12px;text-align:center;font-size:13px;color:#6c757d;">
    <p style="margin:0 0 8px;">You're receiving this weekly digest because you opted in.</p>
    <a href="${APP_URL}/settings" style="color:#667eea;">Manage digest preferences</a>
  </div>

</body>
</html>`;

  // ── Plain text ───────────────────────────────────────────────────────────

  const dayBlocksText = [...releasesByDay.entries()]
    .map(([dateKey, releases]) => {
      const heading = formatDayHeading(dateKey);
      const rows = releases
        .map((r) => {
          const time = new Date(r.release_at).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          });
          const forecast = r.forecast
            ? `${r.forecast}${r.unit ? ` ${r.unit}` : ""}`
            : "—";
          return `  • ${r.indicators.name} (${r.indicators.country_code}) · ${time} UTC · Forecast: ${forecast}`;
        })
        .join("\n");
      return `${heading}\n${"─".repeat(heading.length)}\n${rows}`;
    })
    .join("\n\n");

  const text = `Weekly Macro Digest – ${startFmt} to ${endFmt}
${"=".repeat(50)}

Upcoming high-impact economic releases for the coming week:

${dayBlocksText || "No high-impact releases scheduled this week."}

Open the calendar: ${APP_URL}

---
You're receiving this weekly digest because you opted in.
Manage preferences: ${APP_URL}/settings
`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Allow GET (pg_cron via pg_net uses POST, but support both for manual testing)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // ------------------------------------------------------------------
    // 1. Determine the 7-day window (now → now + 7 days)
    // ------------------------------------------------------------------
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const windowStart = now.toISOString();
    const windowEnd = weekLater.toISOString();

    console.log(`Weekly digest: fetching releases ${windowStart} → ${windowEnd}`);

    // ------------------------------------------------------------------
    // 2. Fetch high-importance releases within the window
    // ------------------------------------------------------------------
    const { data: releases, error: releasesError } = await supabase
      .from("releases")
      .select(
        "id, release_at, period, forecast, unit, indicators!inner(id, name, country_code, category, importance)"
      )
      .gte("release_at", windowStart)
      .lt("release_at", windowEnd)
      .eq("indicators.importance", "high")
      .order("release_at", { ascending: true });

    if (releasesError) {
      console.error("Failed to fetch releases:", releasesError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch releases",
          details: releasesError.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const releaseRows = (releases ?? []) as unknown as ReleaseRow[];
    console.log(`Found ${releaseRows.length} high-impact release(s) this week`);

    // ------------------------------------------------------------------
    // 3. Group releases by calendar day (UTC)
    // ------------------------------------------------------------------
    const releasesByDay = new Map<string, ReleaseRow[]>();
    for (const r of releaseRows) {
      const dayKey = r.release_at.slice(0, 10); // "YYYY-MM-DD"
      if (!releasesByDay.has(dayKey)) releasesByDay.set(dayKey, []);
      releasesByDay.get(dayKey)!.push(r);
    }

    // ------------------------------------------------------------------
    // 4. Find distinct users opted into the weekly digest
    // ------------------------------------------------------------------
    const { data: digestSubscribers, error: subscribersError } = await supabase
      .from("alert_preferences")
      .select("user_id, profiles!inner(email)")
      .eq("digest_weekly", true);

    if (subscribersError) {
      console.error("Failed to fetch digest subscribers:", subscribersError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch digest subscribers",
          details: subscribersError.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Deduplicate: a user may have digest_weekly=true on multiple indicators
    const seenUserIds = new Set<string>();
    const uniqueUsers: DigestUser[] = [];
    for (const row of (digestSubscribers ?? []) as unknown as DigestUser[]) {
      if (!seenUserIds.has(row.user_id)) {
        seenUserIds.add(row.user_id);
        uniqueUsers.push(row);
      }
    }

    console.log(`Found ${uniqueUsers.length} opted-in digest recipient(s)`);

    if (uniqueUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No digest subscribers", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------
    // 5. Build the email (same content for all users)
    // ------------------------------------------------------------------
    const { subject, html, text } = buildDigestEmail(
      releasesByDay,
      windowStart,
      windowEnd
    );

    // ------------------------------------------------------------------
    // 6. Send to each opted-in user
    // ------------------------------------------------------------------
    const results = await Promise.all(
      uniqueUsers.map(async (user) => {
        const email = user.profiles?.email;
        if (!email) {
          console.warn(`No email for user_id: ${user.user_id}`);
          return { user_id: user.user_id, success: false, error: "No email" };
        }
        const result = await sendEmail(email, subject, html, text);
        return { user_id: user.user_id, email, ...result };
      })
    );

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Weekly digest sent: ${sent}, failed: ${failed}`);

    return new Response(
      JSON.stringify({
        message: "Weekly digest processed",
        releases: releaseRows.length,
        recipients: uniqueUsers.length,
        sent,
        failed,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
