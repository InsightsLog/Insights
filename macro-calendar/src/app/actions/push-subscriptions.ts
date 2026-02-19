"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * Zod schema for a Web Push subscription's keys object.
 */
const pushKeysSchema = z.object({
  p256dh: z.string().min(1, "p256dh key is required"),
  auth: z.string().min(1, "auth key is required"),
});

/**
 * Zod schema for a Web Push subscription object from the browser.
 */
const pushSubscriptionSchema = z.object({
  endpoint: z.string().url("endpoint must be a valid URL"),
  keys: pushKeysSchema,
});

/**
 * Result type for push subscription actions.
 */
export type PushSubscriptionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Save a Web Push subscription for the current user.
 * Upserts by (user_id, endpoint) to avoid duplicates across page reloads.
 *
 * @param sub - The PushSubscription object serialised from the browser
 * @returns Success/failure result
 */
export async function subscribePush(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<PushSubscriptionResult<void>> {
  const parseResult = pushSubscriptionSchema.safeParse(sub);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return { success: false, error: firstError?.message ?? "Invalid subscription" };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error: upsertError } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: parseResult.data.endpoint,
        keys: parseResult.data.keys,
      },
      { onConflict: "user_id,endpoint" }
    );

  if (upsertError) {
    return { success: false, error: "Failed to save push subscription" };
  }

  return { success: true, data: undefined };
}

/**
 * Remove all Web Push subscriptions for the current user.
 * Called when the user clicks "Unsubscribe" in settings.
 *
 * @returns Success/failure result
 */
export async function unsubscribePush(): Promise<PushSubscriptionResult<void>> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error: deleteError } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    return { success: false, error: "Failed to remove push subscription" };
  }

  return { success: true, data: undefined };
}

/**
 * Check whether the current user has any active push subscriptions.
 *
 * @returns Success/failure result with subscribed boolean
 */
export async function getPushSubscriptionStatus(): Promise<
  PushSubscriptionResult<{ subscribed: boolean }>
> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data, error: selectError } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (selectError) {
    return { success: false, error: "Failed to check push subscription status" };
  }

  return { success: true, data: { subscribed: (data ?? []).length > 0 } };
}
