import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Mock the supabase service client
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

// Mock the ical module
vi.mock("@/lib/ical", () => ({
  generateICalendar: vi.fn(() => "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"),
  releaseToCalendarEvent: vi.fn((release) => ({
    id: release.id,
    title: `${release.indicator_name} (${release.country_code})`,
    description: release.category,
    startTime: new Date(release.release_at),
  })),
}));

import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

const USER_ID = "user-abc-123";
const VALID_TOKEN = "mc_validtestkey0000";

/** Build the default supabase mock with chainable query methods. */
function buildSupabaseMock({
  keyData = { id: "key-1", user_id: USER_ID, revoked_at: null },
  keyError = null,
  watchlistData = [{ indicator_id: "ind-1" }],
  watchlistError = null,
  releasesData = [
    {
      id: "rel-1",
      indicator_id: "ind-1",
      release_at: "2026-03-01T13:30:00Z",
      period: "Feb 2026",
      forecast: "3.2%",
      previous: "3.1%",
      indicator: {
        id: "ind-1",
        name: "CPI",
        country_code: "US",
        category: "Inflation",
      },
    },
  ],
  releasesError = null,
}: {
  keyData?: { id: string; user_id: string; revoked_at: string | null } | null;
  keyError?: { message: string } | null;
  watchlistData?: { indicator_id: string }[] | null;
  watchlistError?: { message: string } | null;
  releasesData?: object[] | null;
  releasesError?: { message: string } | null;
} = {}) {
  // Single chain returns for api_keys query
  const singleMock = vi.fn().mockResolvedValue({ data: keyData, error: keyError });
  const eqKeyMock = vi.fn().mockReturnValue({ single: singleMock });
  const selectKeyMock = vi.fn().mockReturnValue({ eq: eqKeyMock });

  // Watchlist query chain
  const isMock = vi.fn().mockResolvedValue({ data: watchlistData, error: watchlistError });
  const eqWatchlistMock = vi.fn().mockReturnValue({ is: isMock });
  const selectWatchlistMock = vi.fn().mockReturnValue({ eq: eqWatchlistMock });

  // Releases query chain
  const limitMock = vi
    .fn()
    .mockResolvedValue({ data: releasesData, error: releasesError });
  const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
  const lteMock = vi.fn().mockReturnValue({ order: orderMock });
  const gteMock = vi.fn().mockReturnValue({ lte: lteMock });
  const inMock = vi.fn().mockReturnValue({ gte: gteMock });
  const selectReleasesMock = vi.fn().mockReturnValue({ in: inMock });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === "api_keys") return { select: selectKeyMock };
    if (table === "watchlist") return { select: selectWatchlistMock };
    if (table === "releases") return { select: selectReleasesMock };
    return {};
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCreateSupabaseServiceClient.mockReturnValue({ from: fromMock } as any);
}

function makeRequest(userId: string, token?: string) {
  const url = token
    ? `http://localhost/api/v1/calendar/${userId}/feed.ics?token=${token}`
    : `http://localhost/api/v1/calendar/${userId}/feed.ics`;
  return new NextRequest(url);
}

describe("GET /api/v1/calendar/[userId]/feed.ics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when token is missing", async () => {
      const request = makeRequest(USER_ID);
      const response = await GET(request, { params: Promise.resolve({ userId: USER_ID }) });

      expect(response.status).toBe(401);
      expect(await response.text()).toContain("Missing token");
    });

    it("returns 401 when token format is invalid", async () => {
      const request = makeRequest(USER_ID, "invalid_key");
      const response = await GET(request, { params: Promise.resolve({ userId: USER_ID }) });

      expect(response.status).toBe(401);
      expect(await response.text()).toContain("Invalid token");
    });

    it("returns 401 when token is not found in the database", async () => {
      buildSupabaseMock({ keyData: null, keyError: { message: "not found" } });

      const request = makeRequest(USER_ID, VALID_TOKEN);
      const response = await GET(request, { params: Promise.resolve({ userId: USER_ID }) });

      expect(response.status).toBe(401);
    });

    it("returns 401 when token has been revoked", async () => {
      buildSupabaseMock({
        keyData: { id: "key-1", user_id: USER_ID, revoked_at: "2026-01-01T00:00:00Z" },
      });

      const request = makeRequest(USER_ID, VALID_TOKEN);
      const response = await GET(request, { params: Promise.resolve({ userId: USER_ID }) });

      expect(response.status).toBe(401);
      expect(await response.text()).toContain("revoked");
    });

    it("returns 403 when token belongs to a different user", async () => {
      buildSupabaseMock({
        keyData: { id: "key-1", user_id: "other-user-id", revoked_at: null },
      });

      const request = makeRequest(USER_ID, VALID_TOKEN);
      const response = await GET(request, { params: Promise.resolve({ userId: USER_ID }) });

      expect(response.status).toBe(403);
    });
  });

  describe("successful responses", () => {
    it("returns text/calendar content type", async () => {
      buildSupabaseMock();

      const request = makeRequest(USER_ID, VALID_TOKEN);
      const response = await GET(request, { params: Promise.resolve({ userId: USER_ID }) });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/calendar");
    });

    it("returns an empty calendar when watchlist is empty", async () => {
      buildSupabaseMock({ watchlistData: [] });

      const request = makeRequest(USER_ID, VALID_TOKEN);
      const response = await GET(request, { params: Promise.resolve({ userId: USER_ID }) });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/calendar");
    });

    it("returns iCal content for watchlist releases", async () => {
      buildSupabaseMock();

      const request = makeRequest(USER_ID, VALID_TOKEN);
      const response = await GET(request, { params: Promise.resolve({ userId: USER_ID }) });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("VCALENDAR");
    });

    it("handles embedded indicator relation as array", async () => {
      buildSupabaseMock({
        releasesData: [
          {
            id: "rel-1",
            indicator_id: "ind-1",
            release_at: "2026-03-01T13:30:00Z",
            period: "Feb 2026",
            forecast: "3.2%",
            previous: "3.1%",
            indicator: [
              {
                id: "ind-1",
                name: "CPI",
                country_code: "US",
                category: "Inflation",
              },
            ],
          },
        ],
      });

      const request = makeRequest(USER_ID, VALID_TOKEN);
      const response = await GET(request, { params: Promise.resolve({ userId: USER_ID }) });

      expect(response.status).toBe(200);
    });
  });

  describe("error handling", () => {
    it("returns 500 when watchlist query fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      buildSupabaseMock({
        watchlistData: null,
        watchlistError: { message: "DB error" },
      });

      const request = makeRequest(USER_ID, VALID_TOKEN);
      const response = await GET(request, { params: Promise.resolve({ userId: USER_ID }) });

      expect(response.status).toBe(500);
      consoleSpy.mockRestore();
    });

    it("returns 500 when releases query fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      buildSupabaseMock({
        releasesData: null,
        releasesError: { message: "DB error" },
      });

      const request = makeRequest(USER_ID, VALID_TOKEN);
      const response = await GET(request, { params: Promise.resolve({ userId: USER_ID }) });

      expect(response.status).toBe(500);
      consoleSpy.mockRestore();
    });
  });
});
