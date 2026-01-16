import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDataSources,
  getDataSource,
  createDataSource,
  updateDataSource,
  deleteDataSource,
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
  user1: "11111111-1111-4111-a111-111111111111",
  admin: "33333333-3333-4333-a333-333333333333",
  dataSource1: "44444444-4444-4444-a444-444444444444",
  dataSource2: "55555555-5555-4555-a555-555555555555",
  syncLog1: "66666666-6666-4666-a666-666666666666",
  syncLog2: "77777777-7777-4777-a777-777777777777",
};

// Sample data source
const mockDataSource = {
  id: TEST_UUIDS.dataSource1,
  name: "FRED",
  type: "api",
  base_url: "https://api.stlouisfed.org/fred",
  auth_config: { api_key: "test-key" },
  enabled: true,
  last_sync_at: "2026-01-15T12:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
};

// Sample sync log
const mockSyncLog = {
  id: TEST_UUIDS.syncLog1,
  data_source_id: TEST_UUIDS.dataSource1,
  status: "success",
  records_processed: 100,
  error_message: null,
  started_at: "2026-01-15T12:00:00Z",
  completed_at: "2026-01-15T12:05:00Z",
};

describe("getDataSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user1,
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

  it("returns data sources on success", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [mockDataSource],
            error: null,
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getDataSources();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("FRED");
      expect(result.data[0].type).toBe("api");
    }
  });

  it("returns error when database query fails", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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

    consoleErrorSpy.mockRestore();
  });
});

describe("getDataSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await getDataSource("not-a-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid data source ID");
    }
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user1,
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
              error: { code: "PGRST116", message: "No rows found" },
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

  it("returns data source on success", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

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
      expect(result.data.id).toBe(TEST_UUIDS.dataSource1);
      expect(result.data.name).toBe("FRED");
    }
  });
});

describe("createDataSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user1,
    });

    const result = await createDataSource({
      name: "Test",
      type: "api",
      base_url: "https://example.com",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("returns error for empty name", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const result = await createDataSource({
      name: "",
      type: "api",
      base_url: "https://example.com",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Name is required");
    }
  });

  it("returns error for invalid type", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const result = await createDataSource({
      name: "Test",
      // @ts-expect-error Testing invalid input
      type: "invalid",
      base_url: "https://example.com",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod v4 uses different error message format
      expect(result.error).toContain("scraper");
      expect(result.error).toContain("api");
    }
  });

  it("returns error for invalid URL", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const result = await createDataSource({
      name: "Test",
      type: "api",
      base_url: "not-a-url",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Base URL must be a valid URL");
    }
  });

  it("returns error for duplicate name", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "23505", message: "Unique constraint violation" },
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await createDataSource({
      name: "FRED",
      type: "api",
      base_url: "https://example.com",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("A data source with this name already exists");
    }
  });

  it("creates data source successfully", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDataSource,
              error: null,
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await createDataSource({
      name: "FRED",
      type: "api",
      base_url: "https://api.stlouisfed.org/fred",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("FRED");
    }
  });
});

describe("updateDataSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await updateDataSource("not-a-uuid", { name: "Test" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid data source ID");
    }
  });

  it("returns error when no fields to update", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const result = await updateDataSource(TEST_UUIDS.dataSource1, {});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("No fields to update");
    }
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user1,
    });

    const result = await updateDataSource(TEST_UUIDS.dataSource1, { name: "Updated" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("updates data source successfully", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const updatedDataSource = { ...mockDataSource, name: "Updated FRED" };

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updatedDataSource,
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await updateDataSource(TEST_UUIDS.dataSource1, { name: "Updated FRED" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Updated FRED");
    }
  });
});

describe("deleteDataSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await deleteDataSource("not-a-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid data source ID");
    }
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user1,
    });

    const result = await deleteDataSource(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("deletes data source successfully", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await deleteDataSource(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(TEST_UUIDS.dataSource1);
    }
  });
});

describe("toggleDataSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await toggleDataSource("not-a-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid data source ID");
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
              error: { code: "PGRST116", message: "No rows found" },
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await toggleDataSource(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Data source not found");
    }
  });

  it("toggles data source enabled status", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const toggledDataSource = { ...mockDataSource, enabled: false };

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
                data: toggledDataSource,
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
});

describe("getSyncLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user1,
    });

    const result = await getSyncLogs();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("returns sync logs on success", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ ...mockSyncLog, data_sources: { name: "FRED" } }],
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
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe("success");
      expect(result.data[0].data_source_name).toBe("FRED");
    }
  });

  it("filters by data source ID", async () => {
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
                data: [{ ...mockSyncLog, data_sources: { name: "FRED" } }],
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

  it("filters by status", async () => {
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
                data: [{ ...mockSyncLog, data_sources: { name: "FRED" } }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await getSyncLogs({ status: "success" });

    expect(result.success).toBe(true);
  });
});

describe("createSyncLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await createSyncLog("not-a-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid data source ID");
    }
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user1,
    });

    const result = await createSyncLog(TEST_UUIDS.dataSource1);

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
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "23503", message: "Foreign key violation" },
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseServiceClient.mockReturnValue(mockSupabase as never);

    const result = await createSyncLog(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Data source not found");
    }
  });

  it("creates sync log successfully", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const newSyncLog = {
      ...mockSyncLog,
      status: "in_progress",
      records_processed: 0,
      completed_at: null,
    };

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: newSyncLog,
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
    }
  });
});

describe("updateSyncLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await updateSyncLog("not-a-uuid", { status: "success" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid sync log ID");
    }
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user1,
    });

    const result = await updateSyncLog(TEST_UUIDS.syncLog1, { status: "success" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("updates sync log successfully", async () => {
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
                data: mockSyncLog,
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
      records_processed: 100,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("success");
      expect(result.data.records_processed).toBe(100);
    }
  });
});

describe("updateLastSyncAt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid UUID", async () => {
    const result = await updateLastSyncAt("not-a-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid data source ID");
    }
  });

  it("returns error when user is not admin", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: false,
      userId: TEST_UUIDS.user1,
    });

    const result = await updateLastSyncAt(TEST_UUIDS.dataSource1);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Access denied: Admin role required");
    }
  });

  it("updates last_sync_at successfully", async () => {
    mockCheckAdminRole.mockResolvedValue({
      isAdmin: true,
      userId: TEST_UUIDS.admin,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
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
