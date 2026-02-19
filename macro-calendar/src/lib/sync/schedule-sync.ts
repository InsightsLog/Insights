/**
 * Schedule sync service for T403
 * Fetches upcoming release times from data sources and updates releases table
 */

import { createSupabaseServiceClient } from "@/lib/supabase/service-role";

/**
 * Result of a sync operation
 */
export type SyncResult = {
  status: "success" | "partial" | "failed";
  recordsProcessed: number;
  errorMessage?: string;
};

/**
 * Data source configuration from database
 */
type DataSource = {
  id: string;
  name: string;
  type: "scraper" | "api";
  base_url: string;
  auth_config: Record<string, unknown>;
  enabled: boolean;
};

/**
 * Sync release schedules from enabled data sources
 * 
 * This function:
 * 1. Fetches enabled data sources from database
 * 2. For each source, fetches upcoming release schedules
 * 3. Updates releases table with scheduled times
 * 4. Logs sync results to sync_logs table
 * 
 * @returns Array of sync results per data source
 */
export async function syncReleaseSchedules(): Promise<SyncResult[]> {
  const supabase = createSupabaseServiceClient();
  const results: SyncResult[] = [];

  try {
    // Fetch enabled data sources
    const { data: dataSources, error: sourcesError } = await supabase
      .from("data_sources")
      .select("id, name, type, base_url, auth_config, enabled")
      .eq("enabled", true)
      .returns<DataSource[]>();

    if (sourcesError) {
      throw new Error(`Failed to fetch data sources: ${sourcesError.message}`);
    }

    if (!dataSources || dataSources.length === 0) {
      // No enabled data sources - not an error, just nothing to sync
      return [{
        status: "success",
        recordsProcessed: 0,
        errorMessage: "No enabled data sources found",
      }];
    }

    // Process each data source
    for (const source of dataSources) {
      const result = await syncFromSource(source);
      results.push(result);

      // Log sync result
      await logSyncResult(source.id, result);

      // Update last_sync_at timestamp
      await supabase
        .from("data_sources")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", source.id);
    }

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const failedResult: SyncResult = {
      status: "failed",
      recordsProcessed: 0,
      errorMessage,
    };
    
    return [failedResult];
  }
}

/**
 * Sync schedules from a single data source
 * 
 * Currently a placeholder - actual scraper/API integration pending T401, T402, T404-T406
 * 
 * @param source Data source configuration
 * @returns Sync result for this source
 */
async function syncFromSource(source: DataSource): Promise<SyncResult> {
  // TODO: Implement actual scraper/API calls in future tasks
  // T401: ForexFactory scraper
  // T402: Investing.com scraper
  // T404: FRED API
  // T405: BLS API
  // T406: ECB API
  
  // For now, return success with 0 records (scaffolding for future implementation)
  return {
    status: "success",
    recordsProcessed: 0,
    errorMessage: `${source.name} scraper not yet implemented`,
  };
}

/**
 * Log sync result to sync_logs table
 * 
 * @param dataSourceId Data source ID
 * @param result Sync result
 */
async function logSyncResult(dataSourceId: string, result: SyncResult): Promise<void> {
  const supabase = createSupabaseServiceClient();

  await supabase.from("sync_logs").insert({
    data_source_id: dataSourceId,
    status: result.status,
    records_processed: result.recordsProcessed,
    error_message: result.errorMessage || null,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
}
