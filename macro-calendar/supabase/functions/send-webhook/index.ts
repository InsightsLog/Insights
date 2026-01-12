/**
 * Edge Function: send-webhook
 * Task: T303
 *
 * Triggered alongside email alerts when releases are published or revised.
 * Queries users with webhook endpoints subscribed to the event type.
 * Signs payload with HMAC-SHA256 and delivers with retry logic.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

// Type definitions for webhook payload from database trigger
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
  revision_history?: RevisionEntry[];
}

interface RevisionEntry {
  previous_actual: string | null;
  new_actual: string;
  revised_at: string;
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

// Type for webhook endpoint from database
interface WebhookEndpoint {
  id: string;
  user_id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
}

// Webhook event types
type WebhookEventType = "release.published" | "release.revised";

// Create Supabase client with service role key for admin access
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const APP_URL = Deno.env.get("APP_URL") || "https://macrocalendar.com";

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second
const REQUEST_TIMEOUT_MS = 10000; // 10 seconds

// Discord embed color (blue) - 0x58C7FF in decimal
const DISCORD_EMBED_COLOR = 5818367;

/**
 * Check if a URL is a Discord webhook.
 * Discord webhooks have the format: https://discord.com/api/webhooks/... or https://discordapp.com/api/webhooks/...
 */
function isDiscordWebhook(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      (hostname === "discord.com" || hostname === "discordapp.com") &&
      parsed.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

/**
 * Create HMAC-SHA256 signature for webhook payload.
 */
async function createSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, payloadData);
  const signatureArray = new Uint8Array(signature);

  // Convert to hex string
  return Array.from(signatureArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create standard webhook payload for release events.
 */
function createStandardPayload(
  eventType: WebhookEventType,
  indicator: Indicator,
  release: Release
): object {
  return {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: {
      indicator: {
        id: indicator.id,
        name: indicator.name,
        country: indicator.country_code,
        category: indicator.category,
        source: indicator.source_name,
      },
      release: {
        id: release.id,
        scheduled_at: release.release_at,
        period: release.period,
        actual: release.actual,
        forecast: release.forecast,
        previous: release.previous,
        revised: release.revised,
        unit: release.unit,
        notes: release.notes,
      },
    },
  };
}

/**
 * Create Discord-formatted payload for release events.
 */
function createDiscordPayload(
  eventType: WebhookEventType,
  indicator: Indicator,
  release: Release
): object {
  const eventTitle =
    eventType === "release.published"
      ? "📊 New Release Published"
      : "📝 Release Revised";

  const actualValue = release.actual
    ? `${release.actual}${release.unit ? ` ${release.unit}` : ""}`
    : "Pending";
  const forecastValue = release.forecast
    ? `${release.forecast}${release.unit ? ` ${release.unit}` : ""}`
    : "N/A";
  const previousValue = release.previous
    ? `${release.previous}${release.unit ? ` ${release.unit}` : ""}`
    : "N/A";

  return {
    content: `🔔 **${eventTitle}**`,
    embeds: [
      {
        title: indicator.name,
        description: `${indicator.country_code} • ${indicator.category}`,
        url: `${APP_URL}/indicator/${indicator.id}`,
        color: DISCORD_EMBED_COLOR,
        fields: [
          {
            name: "📅 Period",
            value: release.period,
            inline: true,
          },
          {
            name: "📈 Actual",
            value: actualValue,
            inline: true,
          },
          {
            name: "🎯 Forecast",
            value: forecastValue,
            inline: true,
          },
          {
            name: "📉 Previous",
            value: previousValue,
            inline: true,
          },
        ],
        footer: {
          text: "Macro Calendar",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Deliver webhook to a single endpoint with retry logic.
 * Returns delivery result with status and attempt count.
 */
async function deliverWebhook(
  endpoint: WebhookEndpoint,
  eventType: WebhookEventType,
  indicator: Indicator,
  release: Release
): Promise<{
  endpoint_id: string;
  success: boolean;
  status_code: number | null;
  attempts: number;
  error?: string;
}> {
  const isDiscord = isDiscordWebhook(endpoint.url);

  // Create appropriate payload based on webhook type
  const payload = isDiscord
    ? createDiscordPayload(eventType, indicator, release)
    : createStandardPayload(eventType, indicator, release);

  const payloadString = JSON.stringify(payload);

  // Build headers - Discord doesn't use custom webhook headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!isDiscord) {
    const signature = await createSignature(payloadString, endpoint.secret);
    headers["X-Webhook-Signature"] = `sha256=${signature}`;
    headers["X-Webhook-Event"] = eventType;
    headers["X-Webhook-Id"] = endpoint.id;
    headers["User-Agent"] = "MacroCalendar-Webhook/1.0";
  }

  let lastError: string | undefined;
  let lastStatusCode: number | null = null;

  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

      const response = await fetch(endpoint.url, {
        method: "POST",
        headers,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      lastStatusCode = response.status;

      // Success: 2xx response
      if (response.ok) {
        // Update last_triggered_at timestamp
        await supabase
          .from("webhook_endpoints")
          .update({ last_triggered_at: new Date().toISOString() })
          .eq("id", endpoint.id);

        return {
          endpoint_id: endpoint.id,
          success: true,
          status_code: response.status,
          attempts: attempt,
        };
      }

      // Don't retry on client errors (4xx) except for 429 (rate limited)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        lastError = `HTTP ${response.status}`;
        break;
      }

      // Retry on server errors (5xx) and rate limiting (429)
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          lastError = "Request timeout";
        } else {
          lastError = error.message;
        }
      } else {
        lastError = String(error);
      }
    }

    // Wait before next retry (exponential backoff)
    if (attempt < MAX_RETRIES) {
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.log(
        `Webhook delivery attempt ${attempt} failed for endpoint ${endpoint.id}, retrying in ${backoffMs}ms...`
      );
      await sleep(backoffMs);
    }
  }

  // All retries failed
  return {
    endpoint_id: endpoint.id,
    success: false,
    status_code: lastStatusCode,
    attempts: MAX_RETRIES,
    error: lastError,
  };
}

/**
 * Get all enabled webhook endpoints subscribed to the given event type.
 * Uses service role to bypass RLS (we need to query across all users).
 */
async function getWebhookEndpoints(
  eventType: WebhookEventType
): Promise<WebhookEndpoint[]> {
  // Query enabled webhook endpoints that include this event type
  // PostgreSQL array contains operator: events @> ARRAY['release.published']
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .select("id, user_id, url, secret, events, enabled")
    .eq("enabled", true)
    .contains("events", [eventType]);

  if (error) {
    console.error("Failed to fetch webhook endpoints:", error);
    return [];
  }

  return (data as WebhookEndpoint[]) ?? [];
}

/**
 * Determine the event type based on the database operation.
 * INSERT = release.published
 * UPDATE with actual value change = release.revised
 */
function determineEventType(
  payload: WebhookPayload
): WebhookEventType | null {
  if (payload.type === "INSERT") {
    return "release.published";
  }

  if (payload.type === "UPDATE") {
    // Check if actual value was updated (revision)
    const oldActual = payload.old_record?.actual;
    const newActual = payload.record.actual;

    // If actual value changed from something to something else, it's a revision
    // Note: Initial actual value being set (null -> value) is handled by INSERT
    if (oldActual !== null && newActual !== oldActual) {
      return "release.revised";
    }
  }

  return null;
}

Deno.serve(async (req) => {
  // Only allow POST requests (webhook calls from database triggers)
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload: WebhookPayload = await req.json();

    // Determine event type
    const eventType = determineEventType(payload);
    if (!eventType) {
      return new Response(
        JSON.stringify({
          message: "Ignored: not a webhook-triggering event",
          type: payload.type,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const release = payload.record;
    console.log(
      `Processing webhook delivery for ${eventType}, indicator_id: ${release.indicator_id}`
    );

    // Fetch indicator details
    const { data: indicator, error: indicatorError } = await supabase
      .from("indicators")
      .select("id, name, country_code, category, source_name")
      .eq("id", release.indicator_id)
      .single();

    if (indicatorError || !indicator) {
      console.error("Failed to fetch indicator:", indicatorError);
      return new Response(JSON.stringify({ error: "Indicator not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get all webhook endpoints subscribed to this event type
    const endpoints = await getWebhookEndpoints(eventType);

    if (endpoints.length === 0) {
      console.log(`No webhook endpoints found for event type: ${eventType}`);
      return new Response(
        JSON.stringify({
          message: "No webhook endpoints to notify",
          event_type: eventType,
          delivered: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `Found ${endpoints.length} webhook endpoint(s) for ${eventType}`
    );

    // Deliver webhooks to all endpoints in parallel
    const results = await Promise.all(
      endpoints.map((endpoint) =>
        deliverWebhook(endpoint, eventType, indicator as Indicator, release)
      )
    );

    const delivered = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Webhooks delivered: ${delivered}, failed: ${failed}`);

    return new Response(
      JSON.stringify({
        message: "Webhook delivery processed",
        event_type: eventType,
        indicator_id: release.indicator_id,
        release_id: release.id,
        delivered,
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
