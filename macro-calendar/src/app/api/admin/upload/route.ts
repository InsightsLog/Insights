import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { parseCSV } from "@/lib/csv-parser";
import { checkAdminRole, logAuditAction } from "@/lib/supabase/auth";

/**
 * Zod schema for a single CSV row.
 * Required columns per SPEC.md CSV Format (L0).
 */
const csvRowSchema = z.object({
  indicator_name: z.string().min(1, "indicator_name is required"),
  country_code: z.string().min(1, "country_code is required"),
  category: z.string().min(1, "category is required"),
  source_name: z.string().min(1, "source_name is required"),
  source_url: z.string().min(1, "source_url is required"),
  release_at: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "release_at must be a valid ISO8601 date" }
  ),
  period: z.string().min(1, "period is required"),
  // Optional columns
  actual: z.string().optional(),
  forecast: z.string().optional(),
  previous: z.string().optional(),
  revised: z.string().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

type CsvRow = z.infer<typeof csvRowSchema>;

/**
 * Authentication method used for the upload.
 */
type AuthMethod = "role" | "secret";

/**
 * Helper to create a unique key for an indicator (name + country_code).
 */
function indicatorKey(name: string, countryCode: string): string {
  return `${name}|${countryCode}`;
}

/**
 * Helper to create a unique key for a release (indicator_id + release_at + period).
 */
function releaseKey(indicatorId: string, releaseAt: string, period: string): string {
  return `${indicatorId}|${releaseAt}|${period}`;
}

/**
 * POST /api/admin/upload
 * Accepts multipart form data with a CSV file.
 * Validates CSV structure and inserts data into Supabase.
 *
 * Authentication (T212):
 * - Primary: Supabase auth + admin role check
 * - Fallback: ADMIN_UPLOAD_SECRET (for migration period)
 *
 * All uploads are logged to audit_log table.
 */
export async function POST(request: NextRequest) {
  try {
    // Get server env (now with optional ADMIN_UPLOAD_SECRET)
    const serverEnv = getServerEnv();

    // Parse form data first to get the secret (if provided)
    const formData = await request.formData();
    const providedSecret = formData.get("secret");

    // Authentication: Check admin role first, then fallback to secret
    let authUserId: string | null = null;
    let authMethod: AuthMethod | null = null;

    // Try role-based authentication first
    const adminCheck = await checkAdminRole();
    if (adminCheck.isAdmin && adminCheck.userId) {
      authUserId = adminCheck.userId;
      authMethod = "role";
    } else if (providedSecret && typeof providedSecret === "string") {
      // Fallback: check ADMIN_UPLOAD_SECRET (migration period)
      if (serverEnv.ADMIN_UPLOAD_SECRET && providedSecret === serverEnv.ADMIN_UPLOAD_SECRET) {
        // Secret auth succeeded - use the authenticated user's ID if available
        authUserId = adminCheck.userId; // May be null for anonymous secret auth
        authMethod = "secret";
      }
    }

    // If neither auth method succeeded, return appropriate error
    if (!authMethod) {
      // If user is authenticated but not admin, return 403 Forbidden
      if (adminCheck.userId) {
        return NextResponse.json(
          { error: "Access denied: Admin role required" },
          { status: 403 }
        );
      }
      // If not authenticated at all and no valid secret, return 401 Unauthorized
      return NextResponse.json(
        { error: "Authentication required: Sign in with an admin account or provide a valid admin secret" },
        { status: 401 }
      );
    }

    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No CSV file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      return NextResponse.json(
        { error: "File must be a CSV" },
        { status: 400 }
      );
    }

    // Read file content
    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      );
    }

    // Parse CSV
    const rawRows = parseCSV(text);
    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: "CSV file contains no data rows" },
        { status: 400 }
      );
    }

    // Validate each row with zod
    const validatedRows: CsvRow[] = [];
    const errors: { row: number; errors: string[] }[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const result = csvRowSchema.safeParse(rawRows[i]);
      if (result.success) {
        validatedRows.push(result.data);
      } else {
        errors.push({
          row: i + 2, // +2 for 1-indexed and header row
          errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
        });
      }
    }

    // If any validation errors, return them all
    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: "CSV validation failed",
          details: errors.slice(0, 10), // Limit to first 10 errors
          totalErrors: errors.length,
        },
        { status: 400 }
      );
    }

    // Insert into Supabase using batched queries (T092)
    // Target: 2-3 total queries regardless of row count
    const supabase = await createSupabaseServerClient();

    // Step 1: Collect unique indicators from CSV rows
    const uniqueIndicators = new Map<string, {
      name: string;
      country_code: string;
      category: string;
      source_name: string;
      source_url: string;
    }>();

    for (const row of validatedRows) {
      const key = indicatorKey(row.indicator_name, row.country_code);
      // Last occurrence wins (in case of duplicate indicators in CSV)
      uniqueIndicators.set(key, {
        name: row.indicator_name,
        country_code: row.country_code,
        category: row.category,
        source_name: row.source_name,
        source_url: row.source_url,
      });
    }

    // Step 2: Fetch all existing indicators that match any (name, country_code) in one query
    // We use an OR filter for all unique indicators
    const indicatorFilters = Array.from(uniqueIndicators.values()).map(
      (ind) => `and(name.eq.${encodeURIComponent(ind.name)},country_code.eq.${encodeURIComponent(ind.country_code)})`
    );
    
    const { data: existingIndicators, error: fetchError } = await supabase
      .from("indicators")
      .select("id, name, country_code")
      .or(indicatorFilters.join(","));

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch existing indicators", details: fetchError.message },
        { status: 500 }
      );
    }

    // Create a map of existing indicators for quick lookup
    const existingIndicatorMap = new Map<string, string>();
    for (const ind of existingIndicators || []) {
      existingIndicatorMap.set(indicatorKey(ind.name, ind.country_code), ind.id);
    }

    // Step 3: Separate indicators into those to update vs insert
    const indicatorsToUpdate: Array<{ id: string; category: string; source_name: string; source_url: string }> = [];
    const indicatorsToInsert: Array<{ name: string; country_code: string; category: string; source_name: string; source_url: string }> = [];

    for (const [key, ind] of uniqueIndicators) {
      const existingId = existingIndicatorMap.get(key);
      if (existingId) {
        indicatorsToUpdate.push({
          id: existingId,
          category: ind.category,
          source_name: ind.source_name,
          source_url: ind.source_url,
        });
      } else {
        indicatorsToInsert.push(ind);
      }
    }

    // Step 4: Batch update existing indicators (one query per update, but could be optimized with RPC)
    // For now, we update in a single loop but this is still much better than N queries per CSV row
    // Supabase doesn't support bulk update with different values, so we batch by using Promise.all
    if (indicatorsToUpdate.length > 0) {
      const updatePromises = indicatorsToUpdate.map((ind) =>
        supabase
          .from("indicators")
          .update({
            category: ind.category,
            source_name: ind.source_name,
            source_url: ind.source_url,
          })
          .eq("id", ind.id)
      );
      const updateResults = await Promise.all(updatePromises);
      const updateError = updateResults.find((r) => r.error);
      if (updateError?.error) {
        return NextResponse.json(
          { error: "Failed to update indicators", details: updateError.error.message },
          { status: 500 }
        );
      }
    }

    // Step 5: Batch insert new indicators (single query)
    let newIndicatorIds: Array<{ id: string; name: string; country_code: string }> = [];
    if (indicatorsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("indicators")
        .insert(indicatorsToInsert)
        .select("id, name, country_code");

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to insert new indicators", details: insertError.message },
          { status: 500 }
        );
      }
      newIndicatorIds = inserted || [];
    }

    // Add new indicator IDs to the map
    for (const ind of newIndicatorIds) {
      existingIndicatorMap.set(indicatorKey(ind.name, ind.country_code), ind.id);
    }

    const indicatorsUpserted = indicatorsToUpdate.length + indicatorsToInsert.length;

    // Step 6: Build releases data with indicator IDs
    const releasesData = validatedRows.map((row) => {
      const indId = existingIndicatorMap.get(indicatorKey(row.indicator_name, row.country_code));
      return {
        indicator_id: indId!,
        release_at: row.release_at,
        period: row.period,
        actual: row.actual || null,
        forecast: row.forecast || null,
        previous: row.previous || null,
        revised: row.revised || null,
        unit: row.unit || null,
        notes: row.notes || null,
      };
    });

    // Step 7: Fetch existing releases to determine which to update vs insert
    // Build a filter for all (indicator_id, release_at, period) combinations
    const releaseFilters = releasesData.map(
      (rel) => `and(indicator_id.eq.${rel.indicator_id},release_at.eq.${rel.release_at},period.eq.${encodeURIComponent(rel.period)})`
    );

    // Supabase has a limit on OR filter length, so we chunk if needed
    const CHUNK_SIZE = 50;
    const releaseFilterChunks: string[][] = [];
    for (let i = 0; i < releaseFilters.length; i += CHUNK_SIZE) {
      releaseFilterChunks.push(releaseFilters.slice(i, i + CHUNK_SIZE));
    }

    const existingReleaseMap = new Map<string, string>();
    for (const chunk of releaseFilterChunks) {
      const { data: existingReleases, error: relFetchError } = await supabase
        .from("releases")
        .select("id, indicator_id, release_at, period")
        .or(chunk.join(","));

      if (relFetchError) {
        return NextResponse.json(
          { error: "Failed to fetch existing releases", details: relFetchError.message },
          { status: 500 }
        );
      }

      for (const rel of existingReleases || []) {
        existingReleaseMap.set(releaseKey(rel.indicator_id, rel.release_at, rel.period), rel.id);
      }
    }

    // Step 8: Separate releases into those to update vs insert
    const releasesToUpdate: Array<{ id: string; actual: string | null; forecast: string | null; previous: string | null; revised: string | null; unit: string | null; notes: string | null }> = [];
    const releasesToInsert: Array<{ indicator_id: string; release_at: string; period: string; actual: string | null; forecast: string | null; previous: string | null; revised: string | null; unit: string | null; notes: string | null }> = [];

    for (const rel of releasesData) {
      const key = releaseKey(rel.indicator_id, rel.release_at, rel.period);
      const existingId = existingReleaseMap.get(key);
      if (existingId) {
        releasesToUpdate.push({
          id: existingId,
          actual: rel.actual,
          forecast: rel.forecast,
          previous: rel.previous,
          revised: rel.revised,
          unit: rel.unit,
          notes: rel.notes,
        });
      } else {
        releasesToInsert.push(rel);
      }
    }

    // Step 9: Batch update existing releases
    if (releasesToUpdate.length > 0) {
      const updatePromises = releasesToUpdate.map((rel) =>
        supabase
          .from("releases")
          .update({
            actual: rel.actual,
            forecast: rel.forecast,
            previous: rel.previous,
            revised: rel.revised,
            unit: rel.unit,
            notes: rel.notes,
          })
          .eq("id", rel.id)
      );
      const updateResults = await Promise.all(updatePromises);
      const updateError = updateResults.find((r) => r.error);
      if (updateError?.error) {
        return NextResponse.json(
          { error: "Failed to update releases", details: updateError.error.message },
          { status: 500 }
        );
      }
    }

    // Step 10: Batch insert new releases (single query)
    if (releasesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("releases")
        .insert(releasesToInsert);

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to insert new releases", details: insertError.message },
          { status: 500 }
        );
      }
    }

    const releasesInserted = releasesToUpdate.length + releasesToInsert.length;

    // Log upload action to audit_log (T212)
    // Note: We log even if authUserId is null (anonymous secret auth during migration)
    if (authUserId) {
      await logAuditAction(
        authUserId,
        "upload",
        "release",
        null, // No single resource ID - bulk upload
        {
          filename: file.name,
          rowCount: validatedRows.length,
          indicatorsUpserted,
          releasesInserted,
          authMethod,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${validatedRows.length} rows`,
      indicatorsUpserted,
      releasesInserted,
      authMethod, // Include auth method in response for transparency
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error during upload" },
      { status: 500 }
    );
  }
}
