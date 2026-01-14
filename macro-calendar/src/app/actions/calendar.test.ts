import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  exportWatchlistToICal,
  getWatchlistCalendarEvents,
} from "./calendar";

// Mock the createSupabaseServerClient function
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

// Import the mocked function to control its behavior
import { createSupabaseServerClient } from "@/lib/supabase/server";
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

// Helper to create a mock Supabase client
function createMockSupabase(options: {
  user?: { id: string } | null;
  authError?: Error | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user ?? null },
        error: options.authError ?? null,
      }),
    },
    from: vi.fn(),
  };
}

// Valid UUID for testing
const validIndicatorId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const mockUserId = "user-1234-5678-9abc-def012345678";

describe("exportWatchlistToICal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportWatchlistToICal();

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error when watchlist is empty", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEq = vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportWatchlistToICal();

    expect(result).toEqual({
      success: false,
      error: "No indicators in watchlist",
    });
  });

  it("returns error when watchlist fetch fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEq = vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportWatchlistToICal();

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch watchlist",
    });
  });

  it("returns iCal data successfully", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // Mock watchlist query
    const mockWatchlistIs = vi.fn().mockResolvedValue({
      data: [{ indicator_id: validIndicatorId }],
      error: null,
    });
    const mockWatchlistEq = vi.fn().mockReturnValue({ is: mockWatchlistIs });
    const mockWatchlistSelect = vi.fn().mockReturnValue({ eq: mockWatchlistEq });

    // Mock releases query - future date
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const mockReleasesLimit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "release-1",
          release_at: futureDate,
          period: "Q4 2025",
          forecast: "3.4",
          previous: "3.2",
          indicator: {
            id: validIndicatorId,
            name: "CPI",
            country_code: "US",
            category: "Inflation",
          },
        },
      ],
      error: null,
    });
    const mockReleasesOrder = vi.fn().mockReturnValue({ limit: mockReleasesLimit });
    const mockReleasesGte = vi.fn().mockReturnValue({ order: mockReleasesOrder });
    const mockReleasesIn = vi.fn().mockReturnValue({ gte: mockReleasesGte });
    const mockReleasesSelect = vi.fn().mockReturnValue({ in: mockReleasesIn });

    // Set up from() to return different mocks based on table name
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "watchlist") {
        return { select: mockWatchlistSelect };
      }
      if (table === "releases") {
        return { select: mockReleasesSelect };
      }
      return {};
    });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportWatchlistToICal();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.contentType).toBe("text/calendar");
      expect(result.filename).toMatch(/^watchlist-calendar-\d{4}-\d{2}-\d{2}\.ics$/);
      // Validate iCal format
      expect(result.data).toContain("BEGIN:VCALENDAR");
      expect(result.data).toContain("END:VCALENDAR");
      expect(result.data).toContain("VERSION:2.0");
      expect(result.data).toContain("BEGIN:VEVENT");
      expect(result.data).toContain("SUMMARY:CPI (US)");
      expect(result.data).toContain("END:VEVENT");
    }
  });

  it("returns error when releases fetch fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // Mock watchlist query (success)
    const mockWatchlistIs = vi.fn().mockResolvedValue({
      data: [{ indicator_id: validIndicatorId }],
      error: null,
    });
    const mockWatchlistEq = vi.fn().mockReturnValue({ is: mockWatchlistIs });
    const mockWatchlistSelect = vi.fn().mockReturnValue({ eq: mockWatchlistEq });

    // Mock releases query (failure)
    const mockReleasesLimit = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });
    const mockReleasesOrder = vi.fn().mockReturnValue({ limit: mockReleasesLimit });
    const mockReleasesGte = vi.fn().mockReturnValue({ order: mockReleasesOrder });
    const mockReleasesIn = vi.fn().mockReturnValue({ gte: mockReleasesGte });
    const mockReleasesSelect = vi.fn().mockReturnValue({ in: mockReleasesIn });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "watchlist") {
        return { select: mockWatchlistSelect };
      }
      if (table === "releases") {
        return { select: mockReleasesSelect };
      }
      return {};
    });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportWatchlistToICal();

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch releases",
    });
  });

  it("handles empty releases gracefully", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // Mock watchlist query
    const mockWatchlistIs = vi.fn().mockResolvedValue({
      data: [{ indicator_id: validIndicatorId }],
      error: null,
    });
    const mockWatchlistEq = vi.fn().mockReturnValue({ is: mockWatchlistIs });
    const mockWatchlistSelect = vi.fn().mockReturnValue({ eq: mockWatchlistEq });

    // Mock releases query - empty results
    const mockReleasesLimit = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const mockReleasesOrder = vi.fn().mockReturnValue({ limit: mockReleasesLimit });
    const mockReleasesGte = vi.fn().mockReturnValue({ order: mockReleasesOrder });
    const mockReleasesIn = vi.fn().mockReturnValue({ gte: mockReleasesGte });
    const mockReleasesSelect = vi.fn().mockReturnValue({ in: mockReleasesIn });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "watchlist") {
        return { select: mockWatchlistSelect };
      }
      if (table === "releases") {
        return { select: mockReleasesSelect };
      }
      return {};
    });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportWatchlistToICal();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toContain("BEGIN:VCALENDAR");
      expect(result.data).toContain("END:VCALENDAR");
      expect(result.data).not.toContain("BEGIN:VEVENT");
    }
  });
});

describe("getWatchlistCalendarEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getWatchlistCalendarEvents();

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns empty array when watchlist is empty", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEq = vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getWatchlistCalendarEvents();

    expect(result).toEqual({
      success: true,
      data: [],
    });
  });

  it("returns calendar events with Google Calendar URLs", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // Mock watchlist query
    const mockWatchlistIs = vi.fn().mockResolvedValue({
      data: [{ indicator_id: validIndicatorId }],
      error: null,
    });
    const mockWatchlistEq = vi.fn().mockReturnValue({ is: mockWatchlistIs });
    const mockWatchlistSelect = vi.fn().mockReturnValue({ eq: mockWatchlistEq });

    // Mock releases query - future date
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const mockReleasesLimit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "release-1",
          release_at: futureDate,
          period: "Q4 2025",
          forecast: "3.4",
          previous: "3.2",
          indicator: {
            id: validIndicatorId,
            name: "CPI",
            country_code: "US",
            category: "Inflation",
          },
        },
      ],
      error: null,
    });
    const mockReleasesOrder = vi.fn().mockReturnValue({ limit: mockReleasesLimit });
    const mockReleasesGte = vi.fn().mockReturnValue({ order: mockReleasesOrder });
    const mockReleasesIn = vi.fn().mockReturnValue({ gte: mockReleasesGte });
    const mockReleasesSelect = vi.fn().mockReturnValue({ in: mockReleasesIn });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "watchlist") {
        return { select: mockWatchlistSelect };
      }
      if (table === "releases") {
        return { select: mockReleasesSelect };
      }
      return {};
    });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getWatchlistCalendarEvents();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: "release-1",
        title: "CPI (US)",
        indicator_name: "CPI",
        country_code: "US",
        period: "Q4 2025",
      });
      expect(result.data[0].googleCalendarUrl).toContain("https://calendar.google.com");
      expect(result.data[0].googleCalendarUrl).toContain("action=TEMPLATE");
    }
  });

  it("returns error when watchlist fetch fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });
    const mockEq = vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getWatchlistCalendarEvents();

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch watchlist",
    });
  });

  it("returns error when releases fetch fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // Mock watchlist query (success)
    const mockWatchlistIs = vi.fn().mockResolvedValue({
      data: [{ indicator_id: validIndicatorId }],
      error: null,
    });
    const mockWatchlistEq = vi.fn().mockReturnValue({ is: mockWatchlistIs });
    const mockWatchlistSelect = vi.fn().mockReturnValue({ eq: mockWatchlistEq });

    // Mock releases query (failure)
    const mockReleasesLimit = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });
    const mockReleasesOrder = vi.fn().mockReturnValue({ limit: mockReleasesLimit });
    const mockReleasesGte = vi.fn().mockReturnValue({ order: mockReleasesOrder });
    const mockReleasesIn = vi.fn().mockReturnValue({ gte: mockReleasesGte });
    const mockReleasesSelect = vi.fn().mockReturnValue({ in: mockReleasesIn });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "watchlist") {
        return { select: mockWatchlistSelect };
      }
      if (table === "releases") {
        return { select: mockReleasesSelect };
      }
      return {};
    });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await getWatchlistCalendarEvents();

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch releases",
    });
  });
});
