"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { unsubscribeWithToken } from "@/app/actions/alerts";

type UnsubscribeState = "loading" | "success" | "error" | "invalid";

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<UnsubscribeState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => setState("invalid"), 0);
      return;
    }

    // Perform unsubscribe
    unsubscribeWithToken(token)
      .then((result) => {
        if (result.success) {
          setState("success");
        } else {
          setState("error");
          setErrorMessage(result.error);
        }
      })
      .catch((error) => {
        setState("error");
        setErrorMessage("An unexpected error occurred");
        console.error("Unsubscribe error:", error);
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {state === "loading" && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Processing...
            </h1>
            <p className="text-gray-600">
              Unsubscribing you from email alerts
            </p>
          </div>
        )}

        {state === "success" && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Successfully Unsubscribed
              </h1>
              <p className="text-gray-600 mb-6">
                You have been unsubscribed from email alerts for this indicator.
                You will no longer receive notifications when new releases are
                published.
              </p>
              <div className="space-y-3">
                <a
                  href="/watchlist"
                  className="block w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  Manage My Watchlist
                </a>
                <Link
                  href="/"
                  className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Back to Calendar
                </Link>
              </div>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Unsubscribe Failed
              </h1>
              <p className="text-gray-600 mb-2">
                We couldn&apos;t process your unsubscribe request.
              </p>
              {errorMessage && (
                <p className="text-sm text-red-600 mb-6">
                  Error: {errorMessage}
                </p>
              )}
              <div className="space-y-3">
                <a
                  href="/watchlist"
                  className="block w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  Try Managing in Watchlist
                </a>
                <Link
                  href="/"
                  className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Back to Calendar
                </Link>
              </div>
            </div>
          </div>
        )}

        {state === "invalid" && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Invalid Link
              </h1>
              <p className="text-gray-600 mb-6">
                This unsubscribe link is invalid or has expired. Please use the
                unsubscribe link from your most recent email, or manage your
                alert preferences directly from your watchlist.
              </p>
              <div className="space-y-3">
                <a
                  href="/watchlist"
                  className="block w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  Manage My Watchlist
                </a>
                <Link
                  href="/"
                  className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Back to Calendar
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
