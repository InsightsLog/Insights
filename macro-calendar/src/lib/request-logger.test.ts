import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Supabase client before importing the module
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
const mockCreateClient = vi.fn(() => ({
  from: mockFrom,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

describe("request-logger", () => {
  // Store original env values
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules before each test to ensure fresh env parsing
    vi.resetModules();
    // Reset all mocks
    vi.clearAllMocks();
    // Create a fresh copy of process.env for each test
    process.env = { ...originalEnv };
    // Set required env vars for the module to load
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
  });

  afterEach(() => {
    // Restore original env after each test
    process.env = originalEnv;
  });

  describe("createLogEntry", () => {
    it("creates a log entry with all fields", async () => {
      const { createLogEntry } = await import("./request-logger");

      const entry = createLogEntry("192.168.1.1", "/api/releases", 200, "user-123");

      expect(entry).toEqual({
        ip: "192.168.1.1",
        endpoint: "/api/releases",
        response_code: 200,
        user_id: "user-123",
      });
    });

    it("creates a log entry without user_id", async () => {
      const { createLogEntry } = await import("./request-logger");

      const entry = createLogEntry("10.0.0.1", "/watchlist", 403);

      expect(entry).toEqual({
        ip: "10.0.0.1",
        endpoint: "/watchlist",
        response_code: 403,
        user_id: undefined,
      });
    });

    it("creates a log entry with null user_id", async () => {
      const { createLogEntry } = await import("./request-logger");

      const entry = createLogEntry("127.0.0.1", "/", 200, null);

      expect(entry).toEqual({
        ip: "127.0.0.1",
        endpoint: "/",
        response_code: 200,
        user_id: null,
      });
    });

    it("handles rate limited response code", async () => {
      const { createLogEntry } = await import("./request-logger");

      const entry = createLogEntry("192.168.1.100", "/api/admin", 429);

      expect(entry).toEqual({
        ip: "192.168.1.100",
        endpoint: "/api/admin",
        response_code: 429,
        user_id: undefined,
      });
    });
  });

  describe("logRequest", () => {
    it("does nothing when service role key is not set", async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const { logRequest, createLogEntry } = await import("./request-logger");
      const entry = createLogEntry("192.168.1.1", "/api/releases", 200);

      await logRequest(entry);

      // Should not create a client or call insert
      expect(mockCreateClient).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("logs request when service role key is set", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
      mockInsert.mockResolvedValue({ error: null });

      const { logRequest, createLogEntry } = await import("./request-logger");
      const entry = createLogEntry("192.168.1.1", "/api/releases", 200, "user-123");

      await logRequest(entry);

      // Verify Supabase client was created with correct params
      expect(mockCreateClient).toHaveBeenCalledWith(
        "https://placeholder.supabase.co",
        "test-service-role-key",
        expect.objectContaining({
          auth: expect.objectContaining({
            autoRefreshToken: false,
            persistSession: false,
          }),
        })
      );

      // Verify insert was called with correct data (including new T314 fields)
      expect(mockFrom).toHaveBeenCalledWith("request_logs");
      expect(mockInsert).toHaveBeenCalledWith({
        ip: "192.168.1.1",
        user_id: "user-123",
        endpoint: "/api/releases",
        response_code: 200,
        api_key_id: null,
        response_time_ms: null,
      });
    });

    it("logs request with null user_id for unauthenticated requests", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
      mockInsert.mockResolvedValue({ error: null });

      const { logRequest, createLogEntry } = await import("./request-logger");
      const entry = createLogEntry("10.0.0.1", "/", 200);

      await logRequest(entry);

      // Verify insert includes new T314 fields
      expect(mockInsert).toHaveBeenCalledWith({
        ip: "10.0.0.1",
        user_id: null,
        endpoint: "/",
        response_code: 200,
        api_key_id: null,
        response_time_ms: null,
      });
    });

    it("handles database errors gracefully (does not throw)", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
      mockInsert.mockResolvedValue({ error: { message: "Database error" } });

      const { logRequest, createLogEntry } = await import("./request-logger");
      const entry = createLogEntry("192.168.1.1", "/api/releases", 200);

      // Should not throw
      await expect(logRequest(entry)).resolves.toBeUndefined();
    });

    it("handles unexpected errors gracefully (does not throw)", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
      mockInsert.mockRejectedValue(new Error("Network error"));

      const { logRequest, createLogEntry } = await import("./request-logger");
      const entry = createLogEntry("192.168.1.1", "/api/releases", 200);

      // Should not throw
      await expect(logRequest(entry)).resolves.toBeUndefined();
    });

    it("caches the Supabase client across multiple calls", async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
      mockInsert.mockResolvedValue({ error: null });

      const { logRequest, createLogEntry } = await import("./request-logger");

      // First call
      await logRequest(createLogEntry("192.168.1.1", "/api/releases", 200));
      // Second call
      await logRequest(createLogEntry("192.168.1.2", "/watchlist", 200));
      // Third call
      await logRequest(createLogEntry("192.168.1.3", "/admin", 403));

      // Client should only be created once
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      // But insert should be called for each request
      expect(mockInsert).toHaveBeenCalledTimes(3);
    });
  });
});

describe("isRequestLoggingEnabled", () => {
  // Store original env values
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns false when ENABLE_REQUEST_LOGGING is not set", async () => {
    delete process.env.ENABLE_REQUEST_LOGGING;

    const { isRequestLoggingEnabled } = await import("./env");
    expect(isRequestLoggingEnabled()).toBe(false);
  });

  it("returns false when ENABLE_REQUEST_LOGGING is 'false'", async () => {
    process.env.ENABLE_REQUEST_LOGGING = "false";

    const { isRequestLoggingEnabled } = await import("./env");
    expect(isRequestLoggingEnabled()).toBe(false);
  });

  it("returns true when ENABLE_REQUEST_LOGGING is 'true'", async () => {
    process.env.ENABLE_REQUEST_LOGGING = "true";

    const { isRequestLoggingEnabled } = await import("./env");
    expect(isRequestLoggingEnabled()).toBe(true);
  });

  it("returns false for invalid values", async () => {
    process.env.ENABLE_REQUEST_LOGGING = "yes";

    const { isRequestLoggingEnabled } = await import("./env");
    expect(isRequestLoggingEnabled()).toBe(false);
  });
});
