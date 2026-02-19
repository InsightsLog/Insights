import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDataSources,
  getDataSource,
  toggleDataSource,
  getSyncLogs,
  createSyncLog,
  updateSyncLog,
  updateLastSyncAt,
} from "./data-sources";

// Mock the auth module
vi.mock("@/lib/supabase/auth", () => ({
  checkAdminRole: vi.fn(),
}));

// Mock the service-role module
vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

// Import the mocked functions
import { checkAdminRole } from "@/lib/supabase/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
const mockCheckAdminRole = vi.mocked(checkAdminRole);
const mockCreateSupabaseServiceClient = vi.mocked(createSupabaseServiceClient);

// Test UUIDs for mock data
const TEST_UUIDS = {
  dataSource1: "11111111-1111-4111-a111-111111111111",
  dataSource2: "22222222-2222-4222-a222-222222222222",
  syncLog1: "33333333-3333-4333-a333-333333333333",
  syncLog2: "44444444-4444-4444-a444-444444444444",
  admin: "55555555-5555-4555-a555-555555555555",
  user: "66666666-6666-4666-a666-666666666666",
};

describe("getDataSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user,
    });

    const result = await getDataSources();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("returns empty array when no data sources exist", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getDataSources();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it("returns list of data sources", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockDataSources = [
      {
        id: TEST_UUIDS.dataSource1,
        name: "FRED",
        type: "api",
        base_url: "https://api.stlouisfed.org/fred",
        auth_config: { api_key: "test-key" },
        enabled: true,
        last_sync_at: "2026-01-10T12:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: TEST_UUIDS.dataSource2,
        name: "BLS",
        type: "api",
        base_url: "https://api.bls.gov/publicAPI/v2",
        auth_config: {},
        enabled: false,
        last_sync_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockDataSources,
            error: null,
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getDataSources();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe("FRED");
      expect(result.data[0].enabled).toBe(true);
      expect(result.data[1].name).toBe("BLS");
      expect(result.data[1].enabled).toBe(false);
    }
  });

  it("handles database errors", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getDataSources();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Failed to fetch data sources");
    }
  });
});

describe("getDataSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await getDataSource("invalid-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid data source ID");
    }
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user,
    });

    const result = await getDataSource(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("returns error when data source not found", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getDataSource(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Data source not found");
    }
  });

  it("returns data source when found", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockDataSource = {
      id: TEST_UUIDS.dataSource1,
      name: "FRED",
      type: "api",
      base_url: "https://api.stlouisfed.org/fred",
      auth_config: { api_key: "test-key" },
      enabled: true,
      last_sync_at: "2026-01-10T12:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
    };

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDataSource,
              error: null,
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getDataSource(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("FRED");
      expect(result.data.type).toBe("api");
    }
  });
});

describe("toggleDataSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await toggleDataSource("invalid-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid data source ID");
    }
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user,
    });

    const result = await toggleDataSource(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("toggles enabled status from true to false", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { enabled: true },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: TEST_UUIDS.dataSource1,
                  name: "FRED",
                  type: "api",
                  base_url: "https://api.stlouisfed.org/fred",
                  auth_config: {},
                  enabled: false,
                  last_sync_at: null,
                  created_at: "2026-01-01T00:00:00Z",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await toggleDataSource(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(false);
    }
  });

  it("toggles enabled status from false to true", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { enabled: false },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: TEST_UUIDS.dataSource1,
                  name: "FRED",
                  type: "api",
                  base_url: "https://api.stlouisfed.org/fred",
                  auth_config: {},
                  enabled: true,
                  last_sync_at: null,
                  created_at: "2026-01-01T00:00:00Z",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await toggleDataSource(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
    }
  });
});

describe("getSyncLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user,
    });

    const result = await getSyncLogs();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("returns empty array when no sync logs exist", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getSyncLogs();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it("returns list of sync logs with data source names", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSyncLogs = [
      {
        id: TEST_UUIDS.syncLog1,
        data_source_id: TEST_UUIDS.dataSource1,
        status: "success",
        records_processed: 100,
        error_message: null,
        started_at: "2026-01-10T12:00:00Z",
        completed_at: "2026-01-10T12:01:00Z",
        data_sources: { name: "FRED" },
      },
      {
        id: TEST_UUIDS.syncLog2,
        data_source_id: TEST_UUIDS.dataSource2,
        status: "failed",
        records_processed: 0,
        error_message: "Connection timeout",
        started_at: "2026-01-10T11:00:00Z",
        completed_at: "2026-01-10T11:00:30Z",
        data_sources: { name: "BLS" },
      },
    ];

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockSyncLogs,
              error: null,
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getSyncLogs();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].status).toBe("success");
      expect(result.data[0].data_source_name).toBe("FRED");
      expect(result.data[1].status).toBe("failed");
      expect(result.data[1].error_message).toBe("Connection timeout");
    }
  });

  it("filters by data source ID when provided", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getSyncLogs({ dataSourceId: TEST_UUIDS.dataSource1 });

    expect(result.success).toBe(true);
  });
});

describe("createSyncLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await createSyncLog("invalid-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid data source ID");
    }
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user,
    });

    const result = await createSyncLog(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("creates sync log with in_progress status", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSyncLog = {
      id: TEST_UUIDS.syncLog1,
      data_source_id: TEST_UUIDS.dataSource1,
      status: "in_progress",
      records_processed: 0,
      error_message: null,
      started_at: "2026-01-10T12:00:00Z",
      completed_at: null,
    };

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockSyncLog,
              error: null,
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await createSyncLog(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("in_progress");
      expect(result.data.records_processed).toBe(0);
    }
  });
});

describe("updateSyncLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await updateSyncLog("invalid-uuid", { status: "success" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid sync log ID");
    }
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user,
    });

    const result = await updateSyncLog(TEST_UUIDS.syncLog1, { status: "success" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("updates sync log with success status", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: TEST_UUIDS.syncLog1,
                  data_source_id: TEST_UUIDS.dataSource1,
                  status: "success",
                  records_processed: 150,
                  error_message: null,
                  started_at: "2026-01-10T12:00:00Z",
                  completed_at: "2026-01-10T12:01:00Z",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await updateSyncLog(TEST_UUIDS.syncLog1, {
      status: "success",
      records_processed: 150,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("success");
      expect(result.data.records_processed).toBe(150);
    }
  });
});

describe("updateLastSyncAt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await updateLastSyncAt("invalid-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid data source ID");
    }
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user,
    });

    const result = await updateLastSyncAt(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("updates last_sync_at timestamp", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await updateLastSyncAt(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(TEST_UUIDS.dataSource1);
    }
  });
});
