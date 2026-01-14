import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  exportWatchlistReleases,
  exportIndicatorHistory,
} from "./export";

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

describe("exportWatchlistReleases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    const mockSupabase = createMockSupabase({ user: null });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportWatchlistReleases("csv");

    expect(result).toEqual({
      success: false,
      error: "Not authenticated",
    });
  });

  it("returns error for invalid format", async () => {
    const result = await exportWatchlistReleases("xml" as never);

    expect(result).toEqual({
      success: false,
      error: "Invalid export format. Use 'csv' or 'json'.",
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

    const result = await exportWatchlistReleases("csv");

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

    const result = await exportWatchlistReleases("csv");

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch watchlist",
    });
  });

  it("returns CSV data successfully", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // Mock watchlist query
    const mockWatchlistIs = vi.fn().mockResolvedValue({
      data: [{ indicator_id: validIndicatorId }],
      error: null,
    });
    const mockWatchlistEq = vi.fn().mockReturnValue({ is: mockWatchlistIs });
    const mockWatchlistSelect = vi.fn().mockReturnValue({ eq: mockWatchlistEq });

    // Mock releases query
    const mockReleasesLimit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "release-1",
          release_at: "2026-01-14T10:00:00Z",
          period: "Q4 2025",
          actual: "3.5",
          forecast: "3.4",
          previous: "3.2",
          revised: null,
          unit: "%",
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
    const mockReleasesIn = vi.fn().mockReturnValue({ order: mockReleasesOrder });
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

    const result = await exportWatchlistReleases("csv");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.contentType).toBe("text/csv");
      expect(result.filename).toMatch(/^watchlist-releases-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(result.data).toContain("Indicator,Country,Category");
      expect(result.data).toContain("CPI,US,Inflation");
      expect(result.data).toContain("3.5");
    }
  });

  it("returns JSON data successfully", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // Mock watchlist query
    const mockWatchlistIs = vi.fn().mockResolvedValue({
      data: [{ indicator_id: validIndicatorId }],
      error: null,
    });
    const mockWatchlistEq = vi.fn().mockReturnValue({ is: mockWatchlistIs });
    const mockWatchlistSelect = vi.fn().mockReturnValue({ eq: mockWatchlistEq });

    // Mock releases query
    const mockReleasesLimit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "release-1",
          release_at: "2026-01-14T10:00:00Z",
          period: "Q4 2025",
          actual: "3.5",
          forecast: "3.4",
          previous: "3.2",
          revised: null,
          unit: "%",
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
    const mockReleasesIn = vi.fn().mockReturnValue({ order: mockReleasesOrder });
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

    const result = await exportWatchlistReleases("json");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.contentType).toBe("application/json");
      expect(result.filename).toMatch(/^watchlist-releases-\d{4}-\d{2}-\d{2}\.json$/);
      const parsed = JSON.parse(result.data);
      expect(parsed).toBeInstanceOf(Array);
      expect(parsed[0].indicator_name).toBe("CPI");
      expect(parsed[0].country_code).toBe("US");
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
    const mockReleasesIn = vi.fn().mockReturnValue({ order: mockReleasesOrder });
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

    const result = await exportWatchlistReleases("csv");

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch releases",
    });
  });
});

describe("exportIndicatorHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid indicator ID format", async () => {
    const result = await exportIndicatorHistory("invalid-id", "csv");

    expect(result).toEqual({
      success: false,
      error: "Invalid indicator ID format",
    });
  });

  it("returns error for invalid format", async () => {
    const result = await exportIndicatorHistory(validIndicatorId, "xml" as never);

    expect(result).toEqual({
      success: false,
      error: "Invalid export format. Use 'csv' or 'json'.",
    });
  });

  it("returns error when indicator not found", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportIndicatorHistory(validIndicatorId, "csv");

    expect(result).toEqual({
      success: false,
      error: "Indicator not found",
    });
  });

  it("returns error when indicator fetch fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "50000", message: "DB error" },
    });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockSupabase.from.mockReturnValue({ select: mockSelect });
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportIndicatorHistory(validIndicatorId, "csv");

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch indicator",
    });
  });

  it("returns CSV data successfully", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // Mock indicator query
    const mockIndicatorSingle = vi.fn().mockResolvedValue({
      data: {
        id: validIndicatorId,
        name: "Consumer Price Index",
        country_code: "US",
        category: "Inflation",
      },
      error: null,
    });
    const mockIndicatorEq = vi.fn().mockReturnValue({ single: mockIndicatorSingle });
    const mockIndicatorSelect = vi.fn().mockReturnValue({ eq: mockIndicatorEq });

    // Mock releases query
    const mockReleasesLimit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "release-1",
          release_at: "2026-01-14T10:00:00Z",
          period: "Q4 2025",
          actual: "3.5",
          forecast: "3.4",
          previous: "3.2",
          revised: null,
          unit: "%",
        },
      ],
      error: null,
    });
    const mockReleasesOrder = vi.fn().mockReturnValue({ limit: mockReleasesLimit });
    const mockReleasesEq = vi.fn().mockReturnValue({ order: mockReleasesOrder });
    const mockReleasesSelect = vi.fn().mockReturnValue({ eq: mockReleasesEq });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "indicators") {
        return { select: mockIndicatorSelect };
      }
      if (table === "releases") {
        return { select: mockReleasesSelect };
      }
      return {};
    });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportIndicatorHistory(validIndicatorId, "csv");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.contentType).toBe("text/csv");
      expect(result.filename).toMatch(/^consumer-price-index-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(result.data).toContain("Release Date,Period,Actual,Forecast,Previous,Revised,Unit");
      expect(result.data).toContain("Q4 2025");
      expect(result.data).toContain("3.5");
    }
  });

  it("returns JSON data successfully", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // Mock indicator query
    const mockIndicatorSingle = vi.fn().mockResolvedValue({
      data: {
        id: validIndicatorId,
        name: "CPI",
        country_code: "US",
        category: "Inflation",
      },
      error: null,
    });
    const mockIndicatorEq = vi.fn().mockReturnValue({ single: mockIndicatorSingle });
    const mockIndicatorSelect = vi.fn().mockReturnValue({ eq: mockIndicatorEq });

    // Mock releases query
    const mockReleasesLimit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "release-1",
          release_at: "2026-01-14T10:00:00Z",
          period: "Q4 2025",
          actual: "3.5",
          forecast: "3.4",
          previous: "3.2",
          revised: null,
          unit: "%",
        },
      ],
      error: null,
    });
    const mockReleasesOrder = vi.fn().mockReturnValue({ limit: mockReleasesLimit });
    const mockReleasesEq = vi.fn().mockReturnValue({ order: mockReleasesOrder });
    const mockReleasesSelect = vi.fn().mockReturnValue({ eq: mockReleasesEq });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "indicators") {
        return { select: mockIndicatorSelect };
      }
      if (table === "releases") {
        return { select: mockReleasesSelect };
      }
      return {};
    });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportIndicatorHistory(validIndicatorId, "json");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.contentType).toBe("application/json");
      expect(result.filename).toMatch(/^cpi-\d{4}-\d{2}-\d{2}\.json$/);
      const parsed = JSON.parse(result.data);
      expect(parsed.indicator.name).toBe("CPI");
      expect(parsed.indicator.country_code).toBe("US");
      expect(parsed.releases).toBeInstanceOf(Array);
      expect(parsed.releases[0].actual).toBe("3.5");
      expect(parsed.exported_at).toBeDefined();
    }
  });

  it("returns error when releases fetch fails", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // Mock indicator query (success)
    const mockIndicatorSingle = vi.fn().mockResolvedValue({
      data: {
        id: validIndicatorId,
        name: "CPI",
        country_code: "US",
        category: "Inflation",
      },
      error: null,
    });
    const mockIndicatorEq = vi.fn().mockReturnValue({ single: mockIndicatorSingle });
    const mockIndicatorSelect = vi.fn().mockReturnValue({ eq: mockIndicatorEq });

    // Mock releases query (failure)
    const mockReleasesLimit = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });
    const mockReleasesOrder = vi.fn().mockReturnValue({ limit: mockReleasesLimit });
    const mockReleasesEq = vi.fn().mockReturnValue({ order: mockReleasesOrder });
    const mockReleasesSelect = vi.fn().mockReturnValue({ eq: mockReleasesEq });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "indicators") {
        return { select: mockIndicatorSelect };
      }
      if (table === "releases") {
        return { select: mockReleasesSelect };
      }
      return {};
    });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportIndicatorHistory(validIndicatorId, "csv");

    expect(result).toEqual({
      success: false,
      error: "Failed to fetch releases",
    });
  });

  it("handles special characters in indicator name for filename", async () => {
    const mockSupabase = createMockSupabase({ user: { id: mockUserId } });

    // Mock indicator query with special characters in name
    const mockIndicatorSingle = vi.fn().mockResolvedValue({
      data: {
        id: validIndicatorId,
        name: "CPI (YoY) - Consumer Price Index",
        country_code: "US",
        category: "Inflation",
      },
      error: null,
    });
    const mockIndicatorEq = vi.fn().mockReturnValue({ single: mockIndicatorSingle });
    const mockIndicatorSelect = vi.fn().mockReturnValue({ eq: mockIndicatorEq });

    // Mock releases query
    const mockReleasesLimit = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const mockReleasesOrder = vi.fn().mockReturnValue({ limit: mockReleasesLimit });
    const mockReleasesEq = vi.fn().mockReturnValue({ order: mockReleasesOrder });
    const mockReleasesSelect = vi.fn().mockReturnValue({ eq: mockReleasesEq });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "indicators") {
        return { select: mockIndicatorSelect };
      }
      if (table === "releases") {
        return { select: mockReleasesSelect };
      }
      return {};
    });

    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as never);

    const result = await exportIndicatorHistory(validIndicatorId, "csv");

    expect(result.success).toBe(true);
    if (result.success) {
      // Filename should have special characters removed and spaces converted to hyphens
      expect(result.filename).toMatch(/^cpi-yoy-consumer-price-index-\d{4}-\d{2}-\d{2}\.csv$/);
    }
  });
});
