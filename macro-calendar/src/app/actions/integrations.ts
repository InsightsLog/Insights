"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const SLACK_URL_PREFIX = "https://hooks.slack.com/";

// Schema for Slack webhook URL validation
const slackUrlSchema = z
  .string()
  .url("Invalid URL format")
  .max(2048, "URL must be 2048 characters or less")
  .refine(
    (url) => url.startsWith(SLACK_URL_PREFIX),
    `Slack webhook URL must start with ${SLACK_URL_PREFIX}`
  );

/**
 * Result type for integration actions.
 */
export type IntegrationActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Saved Slack webhook endpoint.
 */
export type SlackWebhook = {
  id: string;
  url: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_triggered_at: string | null;
};

/**
 * Get the current user's saved Slack webhook (if any).
 */
export async function getSlackWebhook(): Promise<
  IntegrationActionResult<SlackWebhook | null>
> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("webhook_endpoints")
    .select("id, url, enabled, created_at, updated_at, last_triggered_at")
    .eq("user_id", user.id)
    .eq("type", "slack")
    .maybeSingle();

  if (error) {
    return { success: false, error: "Failed to fetch Slack integration" };
  }

  return { success: true, data: data as SlackWebhook | null };
}

/**
 * Save (create or replace) the user's Slack webhook URL.
 * URL must start with https://hooks.slack.com/
 *
 * If the user already has a Slack webhook, the existing one is replaced.
 */
export async function saveSlackWebhook(
  url: string
): Promise<IntegrationActionResult<SlackWebhook>> {
  // Validate URL
  const parseResult = slackUrlSchema.safeParse(url);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return { success: false, error: firstError?.message ?? "Invalid URL" };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Check if a Slack webhook already exists for this user
  const { data: existing } = await supabase
    .from("webhook_endpoints")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "slack")
    .maybeSingle();

  let result;

  if (existing) {
    // Update existing Slack webhook URL
    const { data, error } = await supabase
      .from("webhook_endpoints")
      .update({ url: parseResult.data, enabled: true })
      .eq("id", existing.id)
      .select("id, url, enabled, created_at, updated_at, last_triggered_at")
      .single();

    if (error) {
      return { success: false, error: "Failed to save Slack integration" };
    }
    result = data;
  } else {
    // Insert new Slack webhook
    const { data, error } = await supabase
      .from("webhook_endpoints")
      .insert({
        user_id: user.id,
        url: parseResult.data,
        secret: "slack-no-secret",
        events: ["release.published", "release.revised"],
        type: "slack",
      })
      .select("id, url, enabled, created_at, updated_at, last_triggered_at")
      .single();

    if (error) {
      return { success: false, error: "Failed to save Slack integration" };
    }
    result = data;
  }

  return { success: true, data: result as SlackWebhook };
}

/**
 * Delete the user's saved Slack webhook.
 */
export async function deleteSlackWebhook(
  webhookId: string
): Promise<IntegrationActionResult<void>> {
  const idSchema = z.string().uuid("Invalid webhook ID");
  const parseResult = idSchema.safeParse(webhookId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid webhook ID" };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("webhook_endpoints")
    .delete()
    .eq("id", parseResult.data)
    .eq("user_id", user.id)
    .eq("type", "slack");

  if (error) {
    return { success: false, error: "Failed to delete Slack integration" };
  }

  return { success: true, data: undefined };
}

/**
 * Send a test message to the saved Slack webhook.
 *
 * @param webhookId - The ID of the Slack webhook to test
 */
export async function testSlackWebhook(webhookId: string): Promise<
  IntegrationActionResult<{
    status_code: number;
    response_time_ms: number;
    success: boolean;
  }>
> {
  const idSchema = z.string().uuid("Invalid webhook ID");
  const parseResult = idSchema.safeParse(webhookId);
  if (!parseResult.success) {
    return { success: false, error: "Invalid webhook ID" };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the Slack webhook details (RLS ensures user can only access their own)
  const { data: webhook, error: selectError } = await supabase
    .from("webhook_endpoints")
    .select("id, url, enabled")
    .eq("id", parseResult.data)
    .eq("user_id", user.id)
    .eq("type", "slack")
    .single();

  if (selectError || !webhook) {
    if (selectError?.code === "PGRST116") {
      return { success: false, error: "Slack integration not found" };
    }
    return { success: false, error: "Failed to find Slack integration" };
  }

  // Build a sample Slack message formatted with indicator name, value, and time
  const testPayload = {
    text: "🔔 *Macro Calendar — Test Notification*",
    attachments: [
      {
        color: "#36a64f",
        title: "US CPI (YoY) — Test Indicator",
        fields: [
          { title: "Actual", value: "3.2%", short: true },
          { title: "Forecast", value: "3.1%", short: true },
          { title: "Previous", value: "3.0%", short: true },
          {
            title: "Release time",
            value: new Date().toUTCString(),
            short: true,
          },
        ],
        footer: "Macro Calendar",
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  const startTime = Date.now();
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });

    const responseTimeMs = Date.now() - startTime;

    return {
      success: true,
      data: {
        status_code: response.status,
        response_time_ms: responseTimeMs,
        success: response.ok,
      },
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        return {
          success: true,
          data: { status_code: 0, response_time_ms: responseTimeMs, success: false },
        };
      }
    }

    return {
      success: true,
      data: { status_code: 0, response_time_ms: responseTimeMs, success: false },
    };
  }
}
