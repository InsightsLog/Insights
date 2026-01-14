"use client";

import { useState } from "react";

/**
 * Props for the CalendarIntegration component.
 */
interface CalendarIntegrationProps {
  /**
   * Optional: Additional CSS classes.
   */
  className?: string;
}

/**
 * CalendarIntegration component provides buttons for:
 * - Downloading iCal/ICS feed of watchlist releases
 * - Viewing upcoming events with Google Calendar one-click add links
 *
 * Task: T341 - Add calendar integrations
 */
export function CalendarIntegration({ className = "" }: CalendarIntegrationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleICalDownload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/calendar/ical");

      if (!response.ok) {
        const contentType = response.headers.get("Content-Type") ?? "";
        let errorMessage = `Download failed (${response.status})`;

        if (contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // JSON parsing failed, use default error message
          }
        }

        throw new Error(errorMessage);
      }

      // Get the filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `watchlist-calendar-${new Date().toISOString().slice(0, 10)}.ics`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`inline-flex flex-col gap-2 ${className}`}>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={handleICalDownload}
          disabled={isLoading}
          className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          title="Download iCal feed for your calendar app"
        >
          {isLoading ? (
            <svg
              className="mr-1.5 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="mr-1.5 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </svg>
          )}
          Download iCal
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Import to Apple Calendar, Outlook, etc.
        </span>
      </div>
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}

/**
 * Props for the GoogleCalendarButton component.
 */
interface GoogleCalendarButtonProps {
  /**
   * Google Calendar URL for the event.
   */
  googleCalendarUrl: string;

  /**
   * Event title for accessibility.
   */
  eventTitle: string;

  /**
   * Optional: Additional CSS classes.
   */
  className?: string;
}

/**
 * GoogleCalendarButton provides a one-click link to add a single event to Google Calendar.
 *
 * Task: T341 - Add calendar integrations
 */
export function GoogleCalendarButton({
  googleCalendarUrl,
  eventTitle,
  className = "",
}: GoogleCalendarButtonProps) {
  return (
    <a
      href={googleCalendarUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-300 ${className}`}
      title={`Add "${eventTitle}" to Google Calendar`}
    >
      <svg
        className="mr-1 h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2zM6 2a4 4 0 00-4 4v12a4 4 0 004 4h12a4 4 0 004-4V6a4 4 0 00-4-4H6z" />
        <path d="M12 17a1 1 0 01-1-1v-4a1 1 0 112 0v4a1 1 0 01-1 1zM12 10a1 1 0 110-2 1 1 0 010 2z" />
        <path d="M12 6a1 1 0 011 1v1a1 1 0 11-2 0V7a1 1 0 011-1z" />
      </svg>
      + Google
    </a>
  );
}
