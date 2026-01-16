"use server";

import { createSupabaseServiceClient } from "@/lib/supabase/service-role";
import { checkAdminRole } from "@/lib/supabase/auth";
import { z } from "zod";

/**
 * Result type for data source actions.
 * Success returns data, failure returns error message.
 */
export type DataSourceActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Data source from the database.
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
  data_source_name?: string;
  status: "success" | "partial" | "failed" | "in_progress";
  records_processed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

// Zod schema for validating data source from database
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

// Zod schema for validating sync log from database
const syncLogSchema = z.object({
  id: z.string().uuid(),
  data_source_id: z.string().uuid(),
  status: z.enum(["success", "partial", "failed", "in_progress"]),
  records_processed: z.number().int(),
  error_message: z.string().nullable(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
});

// Zod schema for creating/updating data source
const createDataSourceInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  type: z.enum(["scraper", "api"], { message: "Type must be 'scraper' or 'api'" }),
  base_url: z.string().url("Base URL must be a valid URL"),
  auth_config: z.record(z.string(), z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(false),
});

const updateDataSourceInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["scraper", "api"]).optional(),
  base_url: z.string().url().optional(),
  auth_config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

/**
 * Get all data sources.
 * Requires admin role.
 *
 * @returns List of data sources or error
 */
export async function getDataSources(): Promise<DataSourceActionResult<DataSource[]>> {
  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  // Use service role client to access data_sources (no RLS)
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("data_sources")
    .select("id, name, type, base_url, auth_config, enabled, last_sync_at, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch data sources:", error);
    return { success: false, error: "Failed to fetch data sources" };
  }

  // Validate and transform data
  try {
    const dataSources: DataSource[] = (data ?? []).map((source) => {
      const validated = dataSourceSchema.parse(source);
      return validated;
    });
    return { success: true, data: dataSources };
  } catch (zodError) {
    console.error("Data source validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Get a single data source by ID.
 * Requires admin role.
 *
 * @param id - The data source ID
 * @returns Data source or error
 */
export async function getDataSource(id: string): Promise<DataSourceActionResult<DataSource>> {
  // Validate input
  const idResult = z.string().uuid("Invalid data source ID").safeParse(id);
  if (!idResult.success) {
    return { success: false, error: idResult.error.issues[0]?.message ?? "Invalid ID" };
  }

  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("data_sources")
    .select("id, name, type, base_url, auth_config, enabled, last_sync_at, created_at")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { success: false, error: "Data source not found" };
    }
    console.error("Failed to fetch data source:", error);
    return { success: false, error: "Failed to fetch data source" };
  }

  try {
    const validated = dataSourceSchema.parse(data);
    return { success: true, data: validated };
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
 * @returns Created data source or error
 */
export async function createDataSource(
  input: {
    name: string;
    type: "scraper" | "api";
    base_url: string;
    auth_config?: Record<string, unknown>;
    enabled?: boolean;
  }
): Promise<DataSourceActionResult<DataSource>> {
  // Validate input
  const parseResult = createDataSourceInputSchema.safeParse(input);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return { success: false, error: firstError?.message ?? "Invalid input" };
  }

  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin || !adminCheck.userId) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("data_sources")
    .insert({
      name: parseResult.data.name,
      type: parseResult.data.type,
      base_url: parseResult.data.base_url,
      auth_config: parseResult.data.auth_config,
      enabled: parseResult.data.enabled,
    })
    .select("id, name, type, base_url, auth_config, enabled, last_sync_at, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "A data source with this name already exists" };
    }
    console.error("Failed to create data source:", error);
    return { success: false, error: "Failed to create data source" };
  }

  try {
    const validated = dataSourceSchema.parse(data);
    return { success: true, data: validated };
  } catch (zodError) {
    console.error("Data source validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Update an existing data source.
 * Requires admin role.
 *
 * @param id - The data source ID
 * @param input - Fields to update
 * @returns Updated data source or error
 */
export async function updateDataSource(
  id: string,
  input: {
    name?: string;
    type?: "scraper" | "api";
    base_url?: string;
    auth_config?: Record<string, unknown>;
    enabled?: boolean;
  }
): Promise<DataSourceActionResult<DataSource>> {
  // Validate ID
  const idResult = z.string().uuid("Invalid data source ID").safeParse(id);
  if (!idResult.success) {
    return { success: false, error: idResult.error.issues[0]?.message ?? "Invalid ID" };
  }

  // Validate input
  const parseResult = updateDataSourceInputSchema.safeParse(input);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return { success: false, error: firstError?.message ?? "Invalid input" };
  }

  // Check if there's anything to update
  const updates = parseResult.data;
  if (Object.keys(updates).length === 0) {
    return { success: false, error: "No fields to update" };
  }

  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("data_sources")
    .update(updates)
    .eq("id", id)
    .select("id, name, type, base_url, auth_config, enabled, last_sync_at, created_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { success: false, error: "Data source not found" };
    }
    if (error.code === "23505") {
      return { success: false, error: "A data source with this name already exists" };
    }
    console.error("Failed to update data source:", error);
    return { success: false, error: "Failed to update data source" };
  }

  try {
    const validated = dataSourceSchema.parse(data);
    return { success: true, data: validated };
  } catch (zodError) {
    console.error("Data source validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Delete a data source.
 * Requires admin role.
 * Also deletes all associated sync logs (via CASCADE).
 *
 * @param id - The data source ID
 * @returns Success or error
 */
export async function deleteDataSource(id: string): Promise<DataSourceActionResult<{ id: string }>> {
  // Validate input
  const idResult = z.string().uuid("Invalid data source ID").safeParse(id);
  if (!idResult.success) {
    return { success: false, error: idResult.error.issues[0]?.message ?? "Invalid ID" };
  }

  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
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

  return { success: true, data: { id } };
}

/**
 * Toggle a data source's enabled status.
 * Requires admin role.
 *
 * @param id - The data source ID
 * @returns Updated data source or error
 */
export async function toggleDataSource(id: string): Promise<DataSourceActionResult<DataSource>> {
  // Validate input
  const idResult = z.string().uuid("Invalid data source ID").safeParse(id);
  if (!idResult.success) {
    return { success: false, error: idResult.error.issues[0]?.message ?? "Invalid ID" };
  }

  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const supabase = createSupabaseServiceClient();

  // First, get the current enabled state
  const { data: currentData, error: fetchError } = await supabase
    .from("data_sources")
    .select("enabled")
    .eq("id", id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return { success: false, error: "Data source not found" };
    }
    console.error("Failed to fetch data source:", fetchError);
    return { success: false, error: "Failed to fetch data source" };
  }

  // Toggle the enabled state
  const { data, error } = await supabase
    .from("data_sources")
    .update({ enabled: !currentData.enabled })
    .eq("id", id)
    .select("id, name, type, base_url, auth_config, enabled, last_sync_at, created_at")
    .single();

  if (error) {
    console.error("Failed to toggle data source:", error);
    return { success: false, error: "Failed to toggle data source" };
  }

  try {
    const validated = dataSourceSchema.parse(data);
    return { success: true, data: validated };
  } catch (zodError) {
    console.error("Data source validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Get sync logs for a data source or all sources.
 * Requires admin role.
 *
 * @param options - Filtering options
 * @returns List of sync logs or error
 */
export async function getSyncLogs(
  options: {
    dataSourceId?: string;
    status?: "success" | "partial" | "failed" | "in_progress";
    limit?: number;
  } = {}
): Promise<DataSourceActionResult<SyncLogEntry[]>> {
  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  // Validate dataSourceId if provided
  if (options.dataSourceId) {
    const idResult = z.string().uuid("Invalid data source ID").safeParse(options.dataSourceId);
    if (!idResult.success) {
      return { success: false, error: idResult.error.issues[0]?.message ?? "Invalid ID" };
    }
  }

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  const supabase = createSupabaseServiceClient();

  // Build query
  let query = supabase
    .from("sync_logs")
    .select("id, data_source_id, status, records_processed, error_message, started_at, completed_at, data_sources(name)")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (options.dataSourceId) {
    query = query.eq("data_source_id", options.dataSourceId);
  }

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch sync logs:", error);
    return { success: false, error: "Failed to fetch sync logs" };
  }

  // Validate and transform data
  try {
    const syncLogs: SyncLogEntry[] = (data ?? []).map((log) => {
      const validated = syncLogSchema.parse(log);
      // Extract the data source name from the join result
      // Supabase returns either an object or array depending on the join type
      const joinedData = log as { data_sources?: { name?: string } | null };
      const dataSourceName = joinedData.data_sources?.name;
      return {
        ...validated,
        data_source_name: dataSourceName,
      };
    });
    return { success: true, data: syncLogs };
  } catch (zodError) {
    console.error("Sync log validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Create a sync log entry.
 * Used by sync jobs to record their progress.
 * Requires admin role (or called from edge functions with service role).
 * Always creates with 'in_progress' status - use updateSyncLog to set final status.
 *
 * @param dataSourceId - The data source being synced
 * @returns Created sync log entry or error
 */
export async function createSyncLog(
  dataSourceId: string
): Promise<DataSourceActionResult<SyncLogEntry>> {
  // Validate input
  const idResult = z.string().uuid("Invalid data source ID").safeParse(dataSourceId);
  if (!idResult.success) {
    return { success: false, error: idResult.error.issues[0]?.message ?? "Invalid ID" };
  }

  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("sync_logs")
    .insert({
      data_source_id: dataSourceId,
      status: "in_progress",
    })
    .select("id, data_source_id, status, records_processed, error_message, started_at, completed_at")
    .single();

  if (error) {
    if (error.code === "23503") {
      return { success: false, error: "Data source not found" };
    }
    console.error("Failed to create sync log:", error);
    return { success: false, error: "Failed to create sync log" };
  }

  try {
    const validated = syncLogSchema.parse(data);
    return { success: true, data: validated };
  } catch (zodError) {
    console.error("Sync log validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Update a sync log entry.
 * Used by sync jobs to record completion or errors.
 * Requires admin role.
 * 
 * Note: When status is set to a terminal value (success/partial/failed),
 * completed_at is automatically set to the current time if not provided.
 * To prevent this, explicitly pass completed_at: null in updates.
 *
 * @param id - The sync log ID
 * @param updates - Fields to update
 * @returns Updated sync log entry or error
 */
export async function updateSyncLog(
  id: string,
  updates: {
    status?: "success" | "partial" | "failed";
    records_processed?: number;
    error_message?: string | null;
    completed_at?: string | null;
  }
): Promise<DataSourceActionResult<SyncLogEntry>> {
  // Validate input
  const idResult = z.string().uuid("Invalid sync log ID").safeParse(id);
  if (!idResult.success) {
    return { success: false, error: idResult.error.issues[0]?.message ?? "Invalid ID" };
  }

  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const supabase = createSupabaseServiceClient();

  // If completing the sync (status is set) and completed_at is not explicitly provided,
  // automatically set completed_at to current time
  const updateData = { ...updates };
  if (updates.status && updates.completed_at === undefined) {
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("sync_logs")
    .update(updateData)
    .eq("id", id)
    .select("id, data_source_id, status, records_processed, error_message, started_at, completed_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { success: false, error: "Sync log not found" };
    }
    console.error("Failed to update sync log:", error);
    return { success: false, error: "Failed to update sync log" };
  }

  try {
    const validated = syncLogSchema.parse(data);
    return { success: true, data: validated };
  } catch (zodError) {
    console.error("Sync log validation failed:", zodError);
    return { success: false, error: "Invalid data format from database" };
  }
}

/**
 * Update the last_sync_at timestamp for a data source.
 * Called after a successful sync.
 * Requires admin role.
 *
 * @param id - The data source ID
 * @returns Success or error
 */
export async function updateLastSyncAt(id: string): Promise<DataSourceActionResult<{ id: string }>> {
  // Validate input
  const idResult = z.string().uuid("Invalid data source ID").safeParse(id);
  if (!idResult.success) {
    return { success: false, error: idResult.error.issues[0]?.message ?? "Invalid ID" };
  }

  // Check admin role
  const adminCheck = await checkAdminRole();
  if (!adminCheck.isAdmin) {
    return { success: false, error: "Access denied: Admin role required" };
  }

  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from("data_sources")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Failed to update last_sync_at:", error);
    return { success: false, error: "Failed to update last sync time" };
  }

  return { success: true, data: { id } };
}
