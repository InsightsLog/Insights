"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { env } from "@/lib/env";
import {
  subscribePush,
  unsubscribePush,
  getPushSubscriptionStatus,
} from "@/app/actions/push-subscriptions";

/**
 * Push notifications management client component.
 * Handles browser permission requests and subscribe/unsubscribe actions.
 * Task: T420
 */
export function PushNotificationsClient() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check push API support and current subscription status
  useEffect(() => {
    let cancelled = false;

    async function checkSupportAndStatus() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled && isMountedRef.current) {
          setSupported(false);
          setLoading(false);
        }
        return;
      }

      const result = await getPushSubscriptionStatus();
      if (cancelled || !isMountedRef.current) return;
      if (result.success) {
        setSubscribed(result.data.subscribed);
      }
      setLoading(false);
    }

    checkSupportAndStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubscribe = async () => {
    setError(null);
    setMessage(null);
    setActionLoading(true);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (isMountedRef.current) {
          setError("Notification permission denied. Please allow notifications in your browser settings.");
          setActionLoading(false);
        }
        return;
      }

      const vapidPublicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        if (isMountedRef.current) {
          setError("Push notifications are not configured on this server.");
          setActionLoading(false);
        }
        return;
      }

      // Register / retrieve the service worker
      const registration = await navigator.serviceWorker.ready;

      // Convert VAPID public key from base64url to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push
      const pushSub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const json = pushSub.toJSON() as {
        endpoint: string;
        keys?: { p256dh?: string; auth?: string };
      };

      if (!json.keys?.p256dh || !json.keys?.auth) {
        if (isMountedRef.current) {
          setError("Browser push subscription is missing required keys.");
          setActionLoading(false);
        }
        return;
      }

      const result = await subscribePush({
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      });

      if (isMountedRef.current) {
        if (result.success) {
          setSubscribed(true);
          setMessage("You are now subscribed to push notifications.");
        } else {
          setError(result.error);
        }
        setActionLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to subscribe to push notifications.");
        setActionLoading(false);
      }
    }
  };

  const handleUnsubscribe = async () => {
    setError(null);
    setMessage(null);
    setActionLoading(true);

    try {
      // Also unsubscribe from the browser's PushManager if possible
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const pushSub = await registration.pushManager.getSubscription();
        if (pushSub) {
          await pushSub.unsubscribe();
        }
      }

      const result = await unsubscribePush();

      if (isMountedRef.current) {
        if (result.success) {
          setSubscribed(false);
          setMessage("Push notifications disabled.");
        } else {
          setError(result.error);
        }
        setActionLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to unsubscribe.");
        setActionLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to Calendar
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Push Notifications
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Receive browser notifications when watched indicators release.
          </p>
        </div>

        {/* Unsupported banner */}
        {!supported && !loading && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-900/20">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
              Push notifications are not supported in this browser.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              {error}
            </p>
          </div>
        )}

        {/* Success message */}
        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-900/20">
            <p className="text-sm font-medium text-green-800 dark:text-green-400">
              {message}
            </p>
          </div>
        )}

        {/* Status card */}
        {supported && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Browser Notifications
                </h2>
                {loading ? (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Checking status…
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {subscribed
                      ? "You will receive push notifications when watched indicators release."
                      : "Subscribe to get notified in this browser when releases occur."}
                  </p>
                )}
              </div>

              <div className="ml-4 flex-shrink-0">
                {loading ? (
                  <div className="h-9 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
                ) : subscribed ? (
                  <button
                    onClick={handleUnsubscribe}
                    disabled={actionLoading}
                    className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    {actionLoading ? "Unsubscribing…" : "Unsubscribe"}
                  </button>
                ) : (
                  <button
                    onClick={handleSubscribe}
                    disabled={actionLoading}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {actionLoading ? "Subscribing…" : "Subscribe"}
                  </button>
                )}
              </div>
            </div>

            {subscribed && (
              <div className="mt-4 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Active on this browser
              </div>
            )}
          </div>
        )}

        {/* Info card */}
        {supported && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              How it works
            </h2>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>• Notifications are sent when a release you are watching is published.</li>
              <li>• Each browser/device is subscribed independently.</li>
              <li>• Notifications require your browser to be open (or installed as a PWA).</li>
              <li>• You can revoke permission at any time in your browser settings.</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Convert a base64url string to a Uint8Array for use as the
 * applicationServerKey in pushManager.subscribe().
 */
function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    output[i] = binary.charCodeAt(i);
  }
  return output;
}
