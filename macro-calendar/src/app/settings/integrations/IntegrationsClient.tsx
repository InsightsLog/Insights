"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  getSlackWebhook,
  saveSlackWebhook,
  deleteSlackWebhook,
  testSlackWebhook,
  type SlackWebhook,
} from "@/app/actions/integrations";

/**
 * Integrations settings client component.
 * Allows users to connect a Slack incoming webhook for release alerts.
 */
export function IntegrationsClient() {
  const [slackWebhook, setSlackWebhook] = useState<SlackWebhook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [slackUrl, setSlackUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    statusCode: number;
    responseTimeMs: number;
  } | null>(null);

  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    let cancelled = false;

    async function fetchWebhook() {
      setLoading(true);
      setError(null);
      const result = await getSlackWebhook();
      if (cancelled) return;
      if (result.success) {
        setSlackWebhook(result.data);
        if (result.data) {
          setSlackUrl(result.data.url);
        }
      } else {
        setError(result.error);
      }
      setLoading(false);
    }

    fetchWebhook();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slackUrl.trim()) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    setTestResult(null);

    const result = await saveSlackWebhook(slackUrl.trim());

    if (result.success) {
      setSlackWebhook(result.data);
      setSuccessMessage("Slack integration saved successfully.");
    } else {
      setError(result.error);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!slackWebhook) return;

    setDeleting(true);
    setError(null);
    setSuccessMessage(null);
    setTestResult(null);

    const result = await deleteSlackWebhook(slackWebhook.id);

    if (result.success) {
      setSlackWebhook(null);
      setSlackUrl("");
      setSuccessMessage("Slack integration removed.");
    } else {
      setError(result.error);
    }
    setDeleting(false);
  };

  const handleTest = async () => {
    if (!slackWebhook) return;

    setTesting(true);
    setError(null);
    setTestResult(null);

    const result = await testSlackWebhook(slackWebhook.id);

    if (result.success) {
      setTestResult({
        success: result.data.success,
        statusCode: result.data.status_code,
        responseTimeMs: result.data.response_time_ms,
      });
    } else {
      setError(result.error);
    }
    setTesting(false);
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
            Integrations
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Connect external services to receive release alerts
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

        {/* Success message */}
        {successMessage && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-900/50 dark:bg-green-900/20">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-green-800 dark:text-green-400">
                {successMessage}
              </p>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                aria-label="Dismiss"
              >
                <svg
                  className="h-4 w-4"
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
                  {testResult.success ? "Test message sent!" : "Test failed"}
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

        {/* Slack integration card */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center gap-3">
            {/* Slack logo mark (simplified SVG) */}
            <svg
              className="h-8 w-8 shrink-0"
              viewBox="0 0 54 54"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <g fill="none" fillRule="evenodd">
                <path
                  d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386"
                  fill="#36C5F0"
                />
                <path
                  d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387"
                  fill="#2EB67D"
                />
                <path
                  d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386"
                  fill="#ECB22E"
                />
                <path
                  d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.25a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387"
                  fill="#E01E5A"
                />
              </g>
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Slack
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Post release alerts to a Slack channel via an incoming webhook
              </p>
            </div>
            {slackWebhook && (
              <span className="ml-auto inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Connected
              </span>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading...
            </p>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label
                  htmlFor="slackUrl"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Incoming Webhook URL
                </label>
                <input
                  type="url"
                  id="slackUrl"
                  value={slackUrl}
                  onChange={(e) => setSlackUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  disabled={saving}
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Create an incoming webhook in your Slack workspace and paste
                  the URL here. Must start with{" "}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                    https://hooks.slack.com/
                  </code>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || !slackUrl.trim()}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : slackWebhook ? "Update" : "Save"}
                </button>

                {slackWebhook && (
                  <>
                    <button
                      type="button"
                      onClick={handleTest}
                      disabled={testing}
                      className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {testing ? "Sending..." : "Send Test Message"}
                    </button>

                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      {deleting ? "Removing..." : "Remove"}
                    </button>
                  </>
                )}
              </div>
            </form>
          )}

          <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                How to create a Slack incoming webhook →
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
