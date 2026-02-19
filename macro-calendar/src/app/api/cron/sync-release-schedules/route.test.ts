/**
 * Tests for sync-release-schedules cron endpoint (T403)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createSupabaseServiceClient } from "@/lib/supabase/service-role";

describe("sync-release-schedules API", () => {
  const supabase = createSupabaseServiceClient();
  let testDataSourceId: string;

  beforeAll(async () => {
    // Create a test data source
    const { data, error } = await supabase
      .from("data_sources")
      .insert({
        name: "Test Source",
        type: "api",
        base_url: "https://example.com",
        enabled: true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create test data source: ${error?.message}`);
    }

    testDataSourceId = data.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testDataSourceId) {
      await supabase.from("data_sources").delete().eq("id", testDataSourceId);
    }
  });

  it("should reject requests without CRON_SECRET when configured", async () => {
    // Skip if CRON_SECRET is not configured
    if (!process.env.CRON_SECRET) {
      return;
    }

    const response = await fetch("http://localhost:3000/api/cron/sync-release-schedules", {
      method: "POST",
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain("Unauthorized");
  });

  it("should accept requests with valid CRON_SECRET", async () => {
    const cronSecret = process.env.CRON_SECRET;
    
    // Skip if CRON_SECRET is not configured
    if (!cronSecret) {
      return;
    }

    const response = await fetch("http://localhost:3000/api/cron/sync-release-schedules", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cronSecret}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("duration_ms");
    expect(data).toHaveProperty("total_records_processed");
  });

  it("should return 405 for GET requests", async () => {
    const response = await fetch("http://localhost:3000/api/cron/sync-release-schedules", {
      method: "GET",
    });

    expect(response.status).toBe(405);
    const data = await response.json();
    expect(data.error).toContain("Method not allowed");
  });
});
