/**
 * Edge Function: send-release-alert
 * Task: T203
 * 
 * Triggered by database webhook on releases table INSERT.
 * Queries users with matching indicator in alert_preferences (email_enabled=true).
 * Sends email alerts via Resend API.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

// Type definitions for webhook payload from database
interface Release {
  id: string;
  indicator_id: string;
  release_at: string;
  period: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  revised: string | null;
  unit: string | null;
  notes: string | null;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Release;
  old_record: Release | null;
}

// Type for indicator data
interface Indicator {
  id: string;
  name: string;
  country_code: string;
  category: string;
  source_name: string;
}

// Type for user with alert preference
interface AlertSubscriber {
  user_id: string;
  profiles: {
    email: string;
  };
}

// Create Supabase client with service role key for admin access
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("EMAIL_FROM") || "alerts@macrocalendar.com";
const APP_URL = Deno.env.get("APP_URL") || "https://macrocalendar.com";

/**
 * Format a release for email display
 */
function formatReleaseForEmail(
  indicator: Indicator,
  release: Release
): { subject: string; html: string; text: string } {
  const releaseDate = new Date(release.release_at).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const actualValue = release.actual
    ? `${release.actual}${release.unit ? ` ${release.unit}` : ""}`
    : "Pending";
  const forecastValue = release.forecast
    ? `${release.forecast}${release.unit ? ` ${release.unit}` : ""}`
    : "N/A";
  const previousValue = release.previous
    ? `${release.previous}${release.unit ? ` ${release.unit}` : ""}`
    : "N/A";

  const subject = `📊 New Release: ${indicator.name} (${indicator.country_code})`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Economic Release</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">📊 New Economic Release</h1>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <h2 style="color: #333; margin-top: 0;">${indicator.name}</h2>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; color: #6c757d;">Country</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: 600;">${indicator.country_code}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; color: #6c757d;">Category</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: 600;">${indicator.category}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; color: #6c757d;">Period</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: 600;">${release.period}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; color: #6c757d;">Release Date</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: 600;">${releaseDate}</td>
      </tr>
    </table>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #495057;">Release Values</h3>
      <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
        <div style="text-align: center; padding: 10px; flex: 1; min-width: 100px;">
          <div style="color: #6c757d; font-size: 12px; text-transform: uppercase;">Actual</div>
          <div style="font-size: 24px; font-weight: 700; color: ${release.actual ? "#28a745" : "#6c757d"};">${actualValue}</div>
        </div>
        <div style="text-align: center; padding: 10px; flex: 1; min-width: 100px;">
          <div style="color: #6c757d; font-size: 12px; text-transform: uppercase;">Forecast</div>
          <div style="font-size: 24px; font-weight: 700; color: #007bff;">${forecastValue}</div>
        </div>
        <div style="text-align: center; padding: 10px; flex: 1; min-width: 100px;">
          <div style="color: #6c757d; font-size: 12px; text-transform: uppercase;">Previous</div>
          <div style="font-size: 24px; font-weight: 700; color: #6c757d;">${previousValue}</div>
        </div>
      </div>
    </div>

    ${release.notes ? `<p style="color: #6c757d; font-style: italic; margin: 20px 0;">Note: ${release.notes}</p>` : ""}

    <div style="text-align: center; margin-top: 30px;">
      <a href="${APP_URL}/indicator/${indicator.id}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Indicator Details</a>
    </div>
  </div>

  <div style="background: #e9ecef; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 14px; color: #6c757d;">
    <p style="margin: 0 0 10px 0;">You're receiving this because you enabled email alerts for ${indicator.name}.</p>
    <a href="${APP_URL}/watchlist" style="color: #667eea;">Manage your alerts</a>
  </div>
</body>
</html>`;

  const text = `
New Economic Release: ${indicator.name}

Country: ${indicator.country_code}
Category: ${indicator.category}
Period: ${release.period}
Release Date: ${releaseDate}

Actual: ${actualValue}
Forecast: ${forecastValue}
Previous: ${previousValue}

${release.notes ? `Note: ${release.notes}\n` : ""}
View indicator details: ${APP_URL}/indicator/${indicator.id}

---
You're receiving this because you enabled email alerts for ${indicator.name}.
Manage your alerts: ${APP_URL}/watchlist
`;

  return { subject, html, text };
}

/**
 * Send email via Resend API
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
      return { success: false, error: data.message || "Failed to send email" };
    }

    return { success: true };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  // Only allow POST requests (webhook calls)
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload: WebhookPayload = await req.json();

    // Only process INSERT events
    if (payload.type !== "INSERT") {
      return new Response(
        JSON.stringify({ message: "Ignored: not an INSERT event" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const release = payload.record;
    console.log(
      `Processing release alert for indicator_id: ${release.indicator_id}`
    );

    // Fetch indicator details
    const { data: indicator, error: indicatorError } = await supabase
      .from("indicators")
      .select("id, name, country_code, category, source_name")
      .eq("id", release.indicator_id)
      .single();

    if (indicatorError || !indicator) {
      console.error("Failed to fetch indicator:", indicatorError);
      return new Response(
        JSON.stringify({ error: "Indicator not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Query users with email alerts enabled for this indicator
    // Uses the partial index idx_alert_preferences_email_enabled for efficient lookup
    const { data: subscribers, error: subscribersError } = await supabase
      .from("alert_preferences")
      .select("user_id, profiles!inner(email)")
      .eq("indicator_id", release.indicator_id)
      .eq("email_enabled", true);

    if (subscribersError) {
      console.error("Failed to fetch subscribers:", subscribersError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscribers" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!subscribers || subscribers.length === 0) {
      console.log("No subscribers found for this indicator");
      return new Response(
        JSON.stringify({ message: "No subscribers to notify", sent: 0 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${subscribers.length} subscriber(s) to notify`);

    // Format email content
    const { subject, html, text } = formatReleaseForEmail(
      indicator as Indicator,
      release
    );

    // Send emails to all subscribers
    const results = await Promise.all(
      (subscribers as unknown as AlertSubscriber[]).map(async (sub) => {
        const email = sub.profiles.email;
        if (!email) {
          console.warn(`No email found for user_id: ${sub.user_id}`);
          return { user_id: sub.user_id, success: false, error: "No email" };
        }

        const result = await sendEmail(email, subject, html, text);
        return { user_id: sub.user_id, email, ...result };
      })
    );

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Emails sent: ${sent}, failed: ${failed}`);

    return new Response(
      JSON.stringify({
        message: "Release alert processed",
        indicator_id: release.indicator_id,
        release_id: release.id,
        sent,
        failed,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
