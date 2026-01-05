import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { parseCSV } from "@/lib/csv-parser";

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
 * POST /api/admin/upload
 * Accepts multipart form data with a CSV file.
 * Validates CSV structure and inserts data into Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate admin secret
    let serverEnv;
    try {
      serverEnv = getServerEnv();
    } catch {
      return NextResponse.json(
        { error: "Server configuration error: ADMIN_UPLOAD_SECRET not set" },
        { status: 500 }
      );
    }

    // Parse form data
    const formData = await request.formData();

    // Check secret from form data
    const providedSecret = formData.get("secret");
    if (!providedSecret || typeof providedSecret !== "string") {
      return NextResponse.json(
        { error: "Admin secret is required" },
        { status: 401 }
      );
    }

    if (providedSecret !== serverEnv.ADMIN_UPLOAD_SECRET) {
      return NextResponse.json(
        { error: "Invalid admin secret" },
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

    // Insert into Supabase
    const supabase = await createSupabaseServerClient();
    let indicatorsUpserted = 0;
    let releasesInserted = 0;

    for (const row of validatedRows) {
      // Upsert indicator (find by name + country_code, or insert)
      // First, check if indicator exists
      const { data: existingIndicator } = await supabase
        .from("indicators")
        .select("id")
        .eq("name", row.indicator_name)
        .eq("country_code", row.country_code)
        .single();

      let indicatorId: string;

      if (existingIndicator) {
        // Update existing indicator
        indicatorId = existingIndicator.id;
        await supabase
          .from("indicators")
          .update({
            category: row.category,
            source_name: row.source_name,
            source_url: row.source_url,
          })
          .eq("id", indicatorId);
        indicatorsUpserted++;
      } else {
        // Insert new indicator
        const { data: newIndicator, error: insertError } = await supabase
          .from("indicators")
          .insert({
            name: row.indicator_name,
            country_code: row.country_code,
            category: row.category,
            source_name: row.source_name,
            source_url: row.source_url,
          })
          .select("id")
          .single();

        if (insertError || !newIndicator) {
          return NextResponse.json(
            { error: `Failed to insert indicator: ${row.indicator_name}`, details: insertError?.message },
            { status: 500 }
          );
        }
        indicatorId = newIndicator.id;
        indicatorsUpserted++;
      }

      // Check if release already exists (by indicator_id + release_at + period)
      const { data: existingRelease } = await supabase
        .from("releases")
        .select("id")
        .eq("indicator_id", indicatorId)
        .eq("release_at", row.release_at)
        .eq("period", row.period)
        .single();

      if (existingRelease) {
        // Update existing release
        const { error: updateError } = await supabase
          .from("releases")
          .update({
            actual: row.actual || null,
            forecast: row.forecast || null,
            previous: row.previous || null,
            revised: row.revised || null,
            unit: row.unit || null,
            notes: row.notes || null,
          })
          .eq("id", existingRelease.id);

        if (updateError) {
          return NextResponse.json(
            { error: `Failed to update release for: ${row.indicator_name}`, details: updateError.message },
            { status: 500 }
          );
        }
      } else {
        // Insert new release
        const { error: insertError } = await supabase.from("releases").insert({
          indicator_id: indicatorId,
          release_at: row.release_at,
          period: row.period,
          actual: row.actual || null,
          forecast: row.forecast || null,
          previous: row.previous || null,
          revised: row.revised || null,
          unit: row.unit || null,
          notes: row.notes || null,
        });

        if (insertError) {
          return NextResponse.json(
            { error: `Failed to insert release for: ${row.indicator_name}`, details: insertError.message },
            { status: 500 }
          );
        }
      }
      releasesInserted++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${validatedRows.length} rows`,
      indicatorsUpserted,
      releasesInserted,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error during upload" },
      { status: 500 }
    );
  }
}
