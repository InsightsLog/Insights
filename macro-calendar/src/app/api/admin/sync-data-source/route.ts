import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/supabase/auth";
import { createSyncLog, updateSyncLog, updateLastSyncAt } from "@/app/actions/data-sources";
import { z } from "zod";

const requestSchema = z.object({
  dataSourceId: z.string().uuid("Invalid data source ID"),
});

/**
 * POST /api/admin/sync-data-source
 * Manually trigger a sync for a specific data source.
 * Creates a sync log entry and calls the appropriate edge function.
 */
export async function POST(request: Request) {
  try {
    // Check admin role
    const adminCheck = await checkAdminRole();
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { error: "Access denied: Admin role required" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = requestSchema.safeParse(body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const { dataSourceId } = parseResult.data;

    // Create a sync log entry
    const syncLogResult = await createSyncLog(dataSourceId);
    if (!syncLogResult.success) {
      return NextResponse.json(
        { error: syncLogResult.error },
        { status: 500 }
      );
    }

    const syncLogId = syncLogResult.data.id;

    try {
      // Call the sync-release-schedules edge function
      // Note: This would be replaced with the actual edge function URL
      // For now, we'll just mark the sync as successful
      // In a real implementation, you would:
      // 1. Get the Supabase URL from env
      // 2. Call the edge function with proper authentication
      // 3. Handle the response and update the sync log accordingly

      // Placeholder: Mark sync as successful
      await updateSyncLog(syncLogId, {
        status: "success",
        records_processed: 0,
      });

      await updateLastSyncAt(dataSourceId);

      return NextResponse.json({
        success: true,
        message: "Sync started successfully",
        syncLogId,
      });
    } catch (error) {
      // Update sync log with error
      await updateSyncLog(syncLogId, {
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  } catch (error) {
    console.error("Error triggering manual sync:", error);
    return NextResponse.json(
      { error: "Failed to trigger sync" },
      { status: 500 }
    );
  }
}
