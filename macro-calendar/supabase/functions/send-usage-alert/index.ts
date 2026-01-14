/**
 * Edge Function: send-usage-alert
 * Task: T325
 *
 * Sends email alerts when users approach their API usage quota.
 * Called by server action when usage reaches 80%, 90%, or 100% thresholds.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

// Type definitions for the request payload
interface UsageAlertPayload {
  userId: string;
  email: string;
  threshold: 80 | 90 | 100;
  currentUsage: number;
  limit: number;
  planName: string;
  resetAt: string;
}

// Create Supabase client with service role key for admin access
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("EMAIL_FROM");
const APP_URL = Deno.env.get("APP_URL") || "https://macrocalendar.com";

/**
 * Format usage alert email content
 */
function formatUsageAlertEmail(payload: UsageAlertPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const resetDate = new Date(payload.resetAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const usagePercent = Math.round((payload.currentUsage / payload.limit) * 100);

  const urgencyColor =
    payload.threshold >= 100
      ? "#dc2626" // red
      : payload.threshold >= 90
        ? "#ea580c" // orange
        : "#d97706"; // amber

  const urgencyText =
    payload.threshold >= 100
      ? "You've reached your API usage limit"
      : payload.threshold >= 90
        ? "You've almost reached your API usage limit"
        : "You're approaching your API usage limit";

  const subject = `⚠️ API Usage Alert: ${payload.threshold}% of your quota used`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Usage Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${urgencyColor}; padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ API Usage Alert</h1>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <h2 style="color: ${urgencyColor}; margin-top: 0;">${urgencyText}</h2>
    
    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <div style="text-align: center;">
        <div style="font-size: 48px; font-weight: 700; color: ${urgencyColor};">${usagePercent}%</div>
        <div style="color: #6c757d; font-size: 14px; margin-top: 8px;">of your monthly quota used</div>
      </div>
      
      <div style="background: #e9ecef; border-radius: 9999px; height: 12px; margin: 20px 0; overflow: hidden;">
        <div style="background: ${urgencyColor}; height: 100%; width: ${usagePercent}%; border-radius: 9999px;"></div>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; color: #6c757d;">Current Plan</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: 600;">${payload.planName}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; color: #6c757d;">API Calls Used</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: 600;">${payload.currentUsage.toLocaleString()} / ${payload.limit.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; color: #6c757d;">Quota Resets</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #dee2e6; text-align: right; font-weight: 600;">${resetDate}</td>
      </tr>
    </table>

    ${
      payload.threshold >= 100
        ? `
    <div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="color: #991b1b; margin: 0; font-weight: 600;">
        Your API access has been temporarily limited. Upgrade your plan to continue making API calls without interruption.
      </p>
    </div>
    `
        : ""
    }

    <div style="text-align: center; margin-top: 30px;">
      <a href="${APP_URL}/settings/billing" style="background: ${urgencyColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Upgrade Your Plan</a>
    </div>

    <p style="color: #6c757d; font-size: 14px; margin-top: 20px; text-align: center;">
      Need higher limits? Consider upgrading to a plan with more API calls.
    </p>
  </div>

  <div style="background: #e9ecef; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 14px; color: #6c757d;">
    <p style="margin: 0 0 10px 0;">You're receiving this because you have an active API subscription.</p>
    <a href="${APP_URL}/settings/billing" style="color: #667eea;">Manage your subscription</a>
  </div>
</body>
</html>`;

  const text = `
API Usage Alert: ${payload.threshold}% of your quota used

${urgencyText}

Current Plan: ${payload.planName}
API Calls Used: ${payload.currentUsage.toLocaleString()} / ${payload.limit.toLocaleString()}
Usage: ${usagePercent}%
Quota Resets: ${resetDate}

${payload.threshold >= 100 ? "Your API access has been temporarily limited. Upgrade your plan to continue making API calls without interruption.\n" : ""}
Upgrade your plan: ${APP_URL}/settings/billing

---
You're receiving this because you have an active API subscription.
Manage your subscription: ${APP_URL}/settings/billing
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

  if (!FROM_EMAIL) {
    console.error("EMAIL_FROM not configured");
    return { success: false, error: "Email sender not configured" };
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

/**
 * Get the start of the current billing period (first day of current month at 00:00:00 UTC).
 */
function getBillingPeriodStart(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  );
}

Deno.serve(async (req) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload: UsageAlertPayload = await req.json();

    // Validate required fields
    if (
      !payload.userId ||
      !payload.email ||
      !payload.threshold ||
      payload.currentUsage === undefined ||
      !payload.limit ||
      !payload.planName ||
      !payload.resetAt
    ) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate threshold value
    if (![80, 90, 100].includes(payload.threshold)) {
      return new Response(
        JSON.stringify({ error: "Invalid threshold. Must be 80, 90, or 100" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `Processing usage alert for user ${payload.userId}: ${payload.threshold}% threshold`
    );

    // Check if alert already sent for this threshold in this billing period
    const billingPeriodStart = getBillingPeriodStart();
    const { data: existingAlert, error: checkError } = await supabase
      .from("usage_alerts_sent")
      .select("id")
      .eq("user_id", payload.userId)
      .eq("threshold", payload.threshold)
      .eq("billing_period_start", billingPeriodStart.toISOString())
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing alert:", checkError);
      return new Response(
        JSON.stringify({
          error: "Database error checking existing alerts",
          details: checkError.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (existingAlert) {
      console.log(
        `Alert already sent for user ${payload.userId} at ${payload.threshold}% threshold`
      );
      return new Response(
        JSON.stringify({
          message: "Alert already sent for this threshold",
          alreadySent: true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Format and send the email
    const { subject, html, text } = formatUsageAlertEmail(payload);
    const emailResult = await sendEmail(payload.email, subject, html, text);

    if (!emailResult.success) {
      return new Response(
        JSON.stringify({
          error: "Failed to send email",
          details: emailResult.error,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Record that we sent this alert
    const { error: insertError } = await supabase
      .from("usage_alerts_sent")
      .insert({
        user_id: payload.userId,
        threshold: payload.threshold,
        billing_period_start: billingPeriodStart.toISOString(),
      });

    if (insertError) {
      // If it's a unique constraint violation, the alert was already sent
      if (insertError.code === "23505") {
        console.log("Alert already recorded (concurrent send)");
      } else {
        console.error("Error recording alert:", insertError);
        // Don't fail - email was sent successfully
      }
    }

    console.log(
      `Usage alert sent successfully to ${payload.email} for ${payload.threshold}% threshold`
    );

    return new Response(
      JSON.stringify({
        message: "Usage alert sent successfully",
        threshold: payload.threshold,
        email: payload.email,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
