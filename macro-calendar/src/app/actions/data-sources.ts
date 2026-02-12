"use server";

import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { checkAdminRole } from "@/lib/supabase/auth";
import { z } from "zod";

/**
 * Result type for data source actions.
 * Follows the same pattern as AdminActionResult.
 *
 * Task: T400, T408
 */
export type DataSourceActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Data source record from the database.
 */
export type DataSource = {
  id: string;
  name: string;
  type: "scraper" | "api";
  base_url: string;
  auth_config: Record<string, unknown>;
  enabled: boolean;
  last_sync_at: string | null;
  created_at: string;
};

/**
 * Sync log entry from the database.
 */
export type SyncLogEntry = {
  id: string;
  data_source_id: string;
  status: "success" | "partial" | "failed";
  records_processed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

// Zod schemas for validation
const dataSourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(["scraper", "api"]),
  base_url: z.string(),
  auth_config: z.record(z.string(), z.unknown()),
  enabled: z.boolean(),
  last_sync_at: z.string().nullable(),
  created_at: z.string(),
});

const syncLogSchema = z.object({
  id: z.string().uuid(),
  data_source_id: z.string().uuid(),
  status: z.enum(["success", "partial", "failed"]),
  records_processed: z.number().int(),
  error_message: z.string().nullable(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
});

const createDataSourceInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  type: z.enum(["scraper", "api"]),
  base_url: z.string().url("Must be a valid URL"),
  auth_config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

const updateDataSourceInputSchema = z.object({
  id: z.string().uuid("Invalid data source ID"),
  name: z.string().min(1).max(100).optional(),
  base_url: z.string().url().optional(),
  auth_config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

/**
 * List all data sources.
 * Requires admin role.
 *
 * @returns List of all configured data sources
 */
export async function listDataSources(): Promise<
  DataSourceActionResult<DataSource[]>
> {
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("data_sources")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch data sources:", error);
    return { success: false, error: "Failed to fetch data sources" };
  }

  try {
    const sources = (data ?? []).map((row) => dataSourceSchema.parse(row));
    return { success: true, data: sources };
  } catch (zodError) {
    console.error("Data source validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Get a single data source by ID.
 * Requires admin role.
 *
 * @param id - Data source UUID
 * @returns The data source or error
 */
export async function getDataSource(
  id: string
): Promise<DataSourceActionResult<DataSource>> {
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const idResult = z.string().uuid().safeParse(id);
  if (!idResult.success) {
    return { success: false, error: "Invalid data source ID" };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("data_sources")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return { success: false, error: "Data source not found" };
  }

  try {
    const source = dataSourceSchema.parse(data);
    return { success: true, data: source };
  } catch (zodError) {
    console.error("Data source validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Create a new data source.
 * Requires admin role.
 *
 * @param input - Data source configuration
 * @returns The created data source
 */
export async function createDataSource(input: {
  name: string;
  type: "scraper" | "api";
  base_url: string;
  auth_config?: Record<string, unknown>;
  enabled?: boolean;
}): Promise<DataSourceActionResult<DataSource>> {
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const parseResult = createDataSourceInputSchema.safeParse(input);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return {
      success: false,
      error: firstError?.message ?? "Invalid input",
    };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("data_sources")
    .insert({
      name: parseResult.data.name,
      type: parseResult.data.type,
      base_url: parseResult.data.base_url,
      auth_config: parseResult.data.auth_config ?? {},
      enabled: parseResult.data.enabled ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create data source:", error);
    return { success: false, error: "Failed to create data source" };
  }

  try {
    const source = dataSourceSchema.parse(data);
    return { success: true, data: source };
  } catch (zodError) {
    console.error("Data source validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Update an existing data source.
 * Requires admin role.
 *
 * @param input - Fields to update (id required, others optional)
 * @returns The updated data source
 */
export async function updateDataSource(input: {
  id: string;
  name?: string;
  base_url?: string;
  auth_config?: Record<string, unknown>;
  enabled?: boolean;
}): Promise<DataSourceActionResult<DataSource>> {
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const parseResult = updateDataSourceInputSchema.safeParse(input);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return {
      success: false,
      error: firstError?.message ?? "Invalid input",
    };
  }

  const { id, ...updates } = parseResult.data;

  // Build update object with only provided fields
  const updateObj: Record<string, unknown> = {};
  if (updates.name !== undefined) updateObj.name = updates.name;
  if (updates.base_url !== undefined) updateObj.base_url = updates.base_url;
  if (updates.auth_config !== undefined)
    updateObj.auth_config = updates.auth_config;
  if (updates.enabled !== undefined) updateObj.enabled = updates.enabled;

  if (Object.keys(updateObj).length === 0) {
    return { success: false, error: "No fields to update" };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("data_sources")
    .update(updateObj)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to update data source:", error);
    return { success: false, error: "Failed to update data source" };
  }

  try {
    const source = dataSourceSchema.parse(data);
    return { success: true, data: source };
  } catch (zodError) {
    console.error("Data source validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Delete a data source and its sync logs.
 * Requires admin role.
 *
 * @param id - Data source UUID
 * @returns Success or error
 */
export async function deleteDataSource(
  id: string
): Promise<DataSourceActionResult> {
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const idResult = z.string().uuid().safeParse(id);
  if (!idResult.success) {
    return { success: false, error: "Invalid data source ID" };
  }

  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from("data_sources")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete data source:", error);
    return { success: false, error: "Failed to delete data source" };
  }

  return { success: true, data: undefined };
}

/**
 * Get sync logs for a data source.
 * Requires admin role.
 *
 * @param dataSourceId - Data source UUID
 * @param limit - Max entries to return (default 20)
 * @returns List of sync log entries
 */
export async function getSyncLogs(
  dataSourceId: string,
  limit: number = 20
): Promise<DataSourceActionResult<SyncLogEntry[]>> {
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const idResult = z.string().uuid().safeParse(dataSourceId);
  if (!idResult.success) {
    return { success: false, error: "Invalid data source ID" };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("sync_logs")
    .select("*")
    .eq("data_source_id", dataSourceId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch sync logs:", error);
    return { success: false, error: "Failed to fetch sync logs" };
  }

  try {
    const logs = (data ?? []).map((row) => syncLogSchema.parse(row));
    return { success: true, data: logs };
  } catch (zodError) {
    console.error("Sync log validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Create a sync log entry (used by sync jobs).
 * Requires admin role or called from server-side cron.
 *
 * @param dataSourceId - Data source UUID
 * @returns The created sync log entry (with started_at set)
 */
export async function createSyncLog(
  dataSourceId: string
): Promise<DataSourceActionResult<SyncLogEntry>> {
  const idResult = z.string().uuid().safeParse(dataSourceId);
  if (!idResult.success) {
    return { success: false, error: "Invalid data source ID" };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("sync_logs")
    .insert({
      data_source_id: dataSourceId,
      status: "success",
      records_processed: 0,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to create sync log:", error);
    return { success: false, error: "Failed to create sync log" };
  }

  try {
    const log = syncLogSchema.parse(data);
    return { success: true, data: log };
  } catch (zodError) {
    console.error("Sync log validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Update a sync log entry (used by sync jobs to record result).
 *
 * @param logId - Sync log UUID
 * @param result - Sync outcome details
 * @returns The updated sync log entry
 */
export async function completeSyncLog(
  logId: string,
  result: {
    status: "success" | "partial" | "failed";
    records_processed: number;
    error_message?: string;
  }
): Promise<DataSourceActionResult<SyncLogEntry>> {
  const idResult = z.string().uuid().safeParse(logId);
  if (!idResult.success) {
    return { success: false, error: "Invalid sync log ID" };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("sync_logs")
    .update({
      status: result.status,
      records_processed: result.records_processed,
      error_message: result.error_message ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", logId)
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to update sync log:", error);
    return { success: false, error: "Failed to update sync log" };
  }

  try {
    const log = syncLogSchema.parse(data);
    return { success: true, data: log };
  } catch (zodError) {
    console.error("Sync log validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}
