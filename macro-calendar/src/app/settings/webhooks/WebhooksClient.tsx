"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  type WebhookEndpoint,
} from "@/app/actions/webhooks";

/**
 * Valid webhook event types.
 */
const WEBHOOK_EVENT_TYPES = [
  { value: "release.published", label: "Release Published" },
  { value: "release.revised", label: "Release Revised" },
] as const;

type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]["value"];

/**
 * Formats a date string to a human-readable format.
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Webhook management client component.
 * Allows users to create, edit, delete, and test webhook endpoints.
 */
export function WebhooksClient() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<WebhookEventType[]>([
    "release.published",
  ]);
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  // Edit state
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editEvents, setEditEvents] = useState<WebhookEventType[]>([]);
  const [updating, setUpdating] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(
    null
  );

  // Test state
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    webhookId: string;
    success: boolean;
    statusCode: number;
    responseTimeMs: number;
  } | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const hasFetched = useRef(false);

  // Fetch webhooks on mount and when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger === 0 && hasFetched.current) {
      return;
    }
    hasFetched.current = true;

    let cancelled = false;

    async function fetchWebhooks() {
      setLoading(true);
      setError(null);
      const result = await listWebhooks();
      if (cancelled) return;
      if (result.success) {
        setWebhooks(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }

    fetchWebhooks();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const refreshWebhooks = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Handle creating a new webhook
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl.trim()) return;

    setCreating(true);
    setError(null);
    setCreatedSecret(null);

    const result = await createWebhook({
      url: newWebhookUrl.trim(),
      events: newWebhookEvents,
    });

    if (result.success) {
      setCreatedSecret(result.data.secret);
      setNewWebhookUrl("");
      setNewWebhookEvents(["release.published"]);
      refreshWebhooks();
    } else {
      setError(result.error);
    }
    setCreating(false);
  };

  // Handle updating a webhook
  const handleUpdate = async (webhookId: string) => {
    setUpdating(true);
    setError(null);

    const result = await updateWebhook(webhookId, {
      url: editUrl,
      events: editEvents,
    });

    if (result.success) {
      setEditingWebhookId(null);
      refreshWebhooks();
    } else {
      setError(result.error);
    }
    setUpdating(false);
  };

  // Handle toggling webhook enabled status
  const handleToggleEnabled = async (webhook: WebhookEndpoint) => {
    setError(null);
    const result = await updateWebhook(webhook.id, {
      enabled: !webhook.enabled,
    });

    if (result.success) {
      refreshWebhooks();
    } else {
      setError(result.error);
    }
  };

  // Handle deleting a webhook
  const handleDelete = async (webhookId: string) => {
    setDeletingWebhookId(webhookId);
    setError(null);
    setShowDeleteConfirm(null);

    const result = await deleteWebhook(webhookId);
    if (result.success) {
      refreshWebhooks();
    } else {
      setError(result.error);
    }
    setDeletingWebhookId(null);
  };

  // Handle testing a webhook
  const handleTest = async (webhookId: string) => {
    setTestingWebhookId(webhookId);
    setTestResult(null);
    setError(null);

    const result = await testWebhook(webhookId);
    if (result.success) {
      setTestResult({
        webhookId,
        success: result.data.success,
        statusCode: result.data.status_code,
        responseTimeMs: result.data.response_time_ms,
      });
    } else {
      setError(result.error);
    }
    setTestingWebhookId(null);
  };

  // Start editing a webhook
  const startEdit = (webhook: WebhookEndpoint) => {
    setEditingWebhookId(webhook.id);
    setEditUrl(webhook.url);
    setEditEvents(webhook.events as WebhookEventType[]);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingWebhookId(null);
    setEditUrl("");
    setEditEvents([]);
  };

  // Copy secret to clipboard
  const handleCopySecret = async () => {
    if (createdSecret) {
      await navigator.clipboard.writeText(createdSecret);
    }
  };

  // Dismiss the created secret banner
  const handleDismissSecret = () => {
    setCreatedSecret(null);
  };

  // Toggle event selection for create form
  const toggleNewEvent = (event: WebhookEventType) => {
    setNewWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  // Toggle event selection for edit form
  const toggleEditEvent = (event: WebhookEventType) => {
    setEditEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to Calendar
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Webhooks
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Receive HTTP POST notifications when releases are published or
            revised
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              {error}
            </p>
          </div>
        )}

        {/* Created secret banner */}
        {createdSecret && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-4 dark:border-green-900/50 dark:bg-green-900/20">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-green-800 dark:text-green-400">
                  Webhook Created Successfully
                </h3>
                <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                  Copy your webhook signing secret now. You won&apos;t be able
                  to see it again!
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="rounded bg-green-100 px-2 py-1 font-mono text-sm text-green-900 dark:bg-green-900/40 dark:text-green-200">
                    {createdSecret}
                  </code>
                  <button
                    onClick={handleCopySecret}
                    className="rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                  Use this secret to verify webhook signatures with HMAC-SHA256
                </p>
              </div>
              <button
                onClick={handleDismissSecret}
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                aria-label="Dismiss"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Test result banner */}
        {testResult && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 ${
              testResult.success
                ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20"
                : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3
                  className={`text-sm font-medium ${
                    testResult.success
                      ? "text-green-800 dark:text-green-400"
                      : "text-amber-800 dark:text-amber-400"
                  }`}
                >
                  {testResult.success ? "Test Successful" : "Test Failed"}
                </h3>
                <p
                  className={`mt-1 text-sm ${
                    testResult.success
                      ? "text-green-700 dark:text-green-300"
                      : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  Status: {testResult.statusCode || "Network Error"} •{" "}
                  Response time: {testResult.responseTimeMs}ms
                </p>
              </div>
              <button
                onClick={() => setTestResult(null)}
                className={`${
                  testResult.success
                    ? "text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                    : "text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                }`}
                aria-label="Dismiss"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Create new webhook form */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Create New Webhook
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label
                htmlFor="webhookUrl"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Endpoint URL
              </label>
              <input
                type="url"
                id="webhookUrl"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                disabled={creating}
                required
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Must use HTTPS. Localhost not allowed in production.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Event Types
              </label>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENT_TYPES.map((eventType) => (
                  <button
                    key={eventType.value}
                    type="button"
                    onClick={() => toggleNewEvent(eventType.value)}
                    disabled={creating}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      newWebhookEvents.includes(eventType.value)
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {eventType.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Select at least one event type
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={
                  creating ||
                  !newWebhookUrl.trim() ||
                  newWebhookEvents.length === 0
                }
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Webhook"}
              </button>
            </div>
          </form>
        </div>

        {/* Webhooks list */}
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Your Webhooks
            </h2>
          </div>

          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Loading...
            </div>
          ) : webhooks.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                No webhooks
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Create your first webhook endpoint to receive release
                notifications.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="p-4">
                  {editingWebhookId === webhook.id ? (
                    // Edit mode
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor={`edit-url-${webhook.id}`}
                          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          Endpoint URL
                        </label>
                        <input
                          type="url"
                          id={`edit-url-${webhook.id}`}
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          disabled={updating}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Event Types
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {WEBHOOK_EVENT_TYPES.map((eventType) => (
                            <button
                              key={eventType.value}
                              type="button"
                              onClick={() => toggleEditEvent(eventType.value)}
                              disabled={updating}
                              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                                editEvents.includes(eventType.value)
                                  ? "bg-blue-600 text-white"
                                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                              }`}
                            >
                              {eventType.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdate(webhook.id)}
                          disabled={updating || editEvents.length === 0}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updating ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={updating}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {webhook.url}
                          </code>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              webhook.enabled
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {webhook.enabled ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {webhook.events.map((event) => (
                            <span
                              key={event}
                              className="inline-flex rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            >
                              {event}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>Secret: {webhook.secret_preview}</span>
                          <span className="mx-2">•</span>
                          <span>Created: {formatDateTime(webhook.created_at)}</span>
                          {webhook.last_triggered_at && (
                            <>
                              <span className="mx-2">•</span>
                              <span>
                                Last triggered:{" "}
                                {formatDateTime(webhook.last_triggered_at)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="ml-4 flex items-center gap-2">
                        <button
                          onClick={() => handleTest(webhook.id)}
                          disabled={
                            testingWebhookId === webhook.id || !webhook.enabled
                          }
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          title={
                            !webhook.enabled
                              ? "Enable webhook to test"
                              : "Send test payload"
                          }
                        >
                          {testingWebhookId === webhook.id
                            ? "Testing..."
                            : "Test"}
                        </button>
                        <button
                          onClick={() => startEdit(webhook)}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleEnabled(webhook)}
                          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                            webhook.enabled
                              ? "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/20"
                              : "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/20"
                          }`}
                        >
                          {webhook.enabled ? "Disable" : "Enable"}
                        </button>
                        {showDeleteConfirm === webhook.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(webhook.id)}
                              disabled={deletingWebhookId === webhook.id}
                              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                            >
                              {deletingWebhookId === webhook.id
                                ? "Deleting..."
                                : "Confirm"}
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(webhook.id)}
                            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage info */}
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Using Webhooks
          </h2>
          <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              When a release is published or revised, we&apos;ll send an HTTP
              POST request to your endpoint with a JSON payload.
            </p>

            <div>
              <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">
                Verifying Signatures
              </h3>
              <p className="mb-2">
                Each request includes an{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                  X-Webhook-Signature
                </code>{" "}
                header with an HMAC-SHA256 signature of the payload:
              </p>
              <pre className="overflow-x-auto rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
                <code className="text-zinc-800 dark:text-zinc-200">
                  X-Webhook-Signature: sha256=&lt;signature&gt;
                </code>
              </pre>
              <p className="mt-2">
                Verify by computing HMAC-SHA256 of the raw request body using
                your webhook secret.
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">
                Sample Payload
              </h3>
              <p className="mb-2">
                Real notifications use event types like{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                  release.published
                </code>{" "}
                or{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                  release.revised
                </code>
                . Test payloads use{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                  test
                </code>{" "}
                as the event type.
              </p>
              <pre className="overflow-x-auto rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
                <code className="text-zinc-800 dark:text-zinc-200">
                  {JSON.stringify(
                    {
                      event: "release.published",
                      timestamp: "2026-01-12T00:00:00Z",
                      data: {
                        indicator: {
                          id: "uuid",
                          name: "CPI (YoY)",
                          country: "US",
                          category: "Inflation",
                        },
                        release: {
                          id: "uuid",
                          scheduled_at: "2026-01-12T08:30:00Z",
                          actual: "3.2%",
                          forecast: "3.1%",
                          previous: "3.0%",
                        },
                      },
                    },
                    null,
                    2
                  )}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
