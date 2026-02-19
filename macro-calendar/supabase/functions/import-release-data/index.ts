/**
 * Edge Function: import-release-data
 * Task: T407
 *
 * Triggered at release times to fetch actual values from external APIs,
 * update the releases table, and trigger webhooks + email alerts.
 *
 * Accepts POST body with:
 * - indicator_id: UUID of the indicator
 * - release_id: UUID of the release to update
 *
 * Process:
 * 1. Fetch indicator details and determine data source
 * 2. Call appropriate API (FRED/BLS/ECB) to get latest value
 * 3. Update releases.actual in database
 * 4. Trigger send-webhook edge function
 * 5. Trigger send-release-alert edge function
 * 6. Log sync result to sync_logs table
 */

import { createClient } from "npm:@supabase/supabase-js@2";

// Request payload interface
interface ImportRequest {
  indicator_id: string;
  release_id: string;
}

// Indicator with data source info
interface Indicator {
  id: string;
  name: string;
  country_code: string;
  category: string;
  source_name: string;
  series_id: string | null;
  data_source_name: string | null;
}

// Release record
interface Release {
  id: string;
  indicator_id: string;
  release_at: string;
  period: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

// Data source configuration
interface DataSource {
  id: string;
  name: string;
  type: string;
  base_url: string;
  auth_config: {
    api_key_env?: string;
  };
  enabled: boolean;
}

// Validate required environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ENV_VARS_VALID = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY;

if (!ENV_VARS_VALID) {
  console.error("Missing required environment variables");
}

// Create Supabase client with service role key
const supabase = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? ""
);

/**
 * Fetch the latest value from FRED API.
 */
async function fetchFredValue(
  seriesId: string,
  apiKey: string
): Promise<string | null> {
  const baseUrl = "https://api.stlouisfed.org/fred/series/observations";
  const url = new URL(baseUrl);

  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`FRED API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.observations || data.observations.length === 0) {
    return null;
  }

  const value = data.observations[0].value;
  return value === "." ? null : value;
}

/**
 * Fetch the latest value from BLS API.
 */
async function fetchBlsValue(
  seriesId: string,
  apiKey?: string
): Promise<string | null> {
  const baseUrl = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const payload = {
    seriesid: [seriesId],
    startyear: lastYear.toString(),
    endyear: currentYear.toString(),
    latest: true,
    ...(apiKey && { registrationkey: apiKey }),
  };

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`BLS API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== "REQUEST_SUCCEEDED") {
    throw new Error(`BLS API failed: ${data.message?.join(", ")}`);
  }

  if (!data.Results?.series?.[0]?.data?.[0]) {
    return null;
  }

  return data.Results.series[0].data[0].value;
}

/**
 * Fetch the latest value from ECB API.
 */
async function fetchEcbValue(
  flowRef: string,
  seriesKey: string
): Promise<string | null> {
  const baseUrl = `https://data-api.ecb.europa.eu/service/data/${flowRef}/${seriesKey}`;
  const url = new URL(baseUrl);

  url.searchParams.set("format", "jsondata");
  url.searchParams.set("lastNObservations", "1");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`ECB API error: ${response.status}`);
  }

  const data = await response.json();

  // Navigate ECB SDMX-JSON structure
  const dataSet = data.dataSets?.[0];
  if (!dataSet?.series) return null;

  const seriesKeys = Object.keys(dataSet.series);
  if (seriesKeys.length === 0) return null;

  const series = dataSet.series[seriesKeys[0]];
  const obsKeys = Object.keys(series.observations || {});
  if (obsKeys.length === 0) return null;

  const value = series.observations[obsKeys[0]]?.[0];
  return value ? value.toString() : null;
}

/**
 * Fetch data from the appropriate source.
 */
async function fetchDataFromSource(
  dataSourceName: string,
  seriesId: string
): Promise<string | null> {
  // Get data source configuration from database
  const { data: dataSource, error } = await supabase
    .from("data_sources")
    .select("id, name, type, base_url, auth_config, enabled")
    .eq("name", dataSourceName)
    .eq("enabled", true)
    .single();

  if (error || !dataSource) {
    throw new Error(`Data source ${dataSourceName} not found or disabled`);
  }

  const ds = dataSource as DataSource;

  // Get API key from environment if specified
  let apiKey: string | undefined;
  if (ds.auth_config?.api_key_env) {
    apiKey = Deno.env.get(ds.auth_config.api_key_env);
  }

  // Call appropriate API based on data source name
  switch (dataSourceName) {
    case "FRED":
      if (!apiKey) {
        throw new Error("FRED API key not configured");
      }
      return await fetchFredValue(seriesId, apiKey);

    case "BLS":
      return await fetchBlsValue(seriesId, apiKey);

    case "ECB":
      // ECB API format: flowRef/seriesKey
      // For simplicity, assume seriesId contains both
      const [flowRef, key] = seriesId.split("/");
      if (!flowRef || !key) {
        throw new Error("Invalid ECB series format (expected: flowRef/seriesKey)");
      }
      return await fetchEcbValue(flowRef, key);

    default:
      throw new Error(`Unsupported data source: ${dataSourceName}`);
  }
}

/**
 * Trigger an edge function via HTTP.
 */
async function triggerEdgeFunction(
  functionName: string,
  payload: unknown
): Promise<void> {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to trigger ${functionName}:`, response.status, text);
    // Don't throw - we want to log the failure but continue
  } else {
    console.log(`Successfully triggered ${functionName}`);
  }
}

/**
 * Log sync operation to sync_logs table.
 */
async function logSync(
  dataSourceId: string,
  status: "success" | "partial" | "failed",
  recordsProcessed: number,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase.from("sync_logs").insert({
    data_source_id: dataSourceId,
    status,
    records_processed: recordsProcessed,
    error_message: errorMessage,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to log sync:", error);
  }
}

Deno.serve(async (req) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check environment variables
  if (!ENV_VARS_VALID) {
    return new Response(
      JSON.stringify({
        error: "Server configuration error: missing environment variables",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const payload: ImportRequest = await req.json();
    const { indicator_id, release_id } = payload;

    if (!indicator_id || !release_id) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: indicator_id and release_id",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `Processing data import for indicator: ${indicator_id}, release: ${release_id}`
    );

    // 1. Fetch indicator details
    const { data: indicator, error: indicatorError } = await supabase
      .from("indicators")
      .select(
        "id, name, country_code, category, source_name, series_id, data_source_name"
      )
      .eq("id", indicator_id)
      .single();

    if (indicatorError || !indicator) {
      return new Response(
        JSON.stringify({ error: "Indicator not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const ind = indicator as Indicator;

    // Check if indicator has data source mapping
    if (!ind.data_source_name || !ind.series_id) {
      return new Response(
        JSON.stringify({
          error: "Indicator has no data source mapping configured",
          indicator_id: ind.id,
          name: ind.name,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 2. Fetch release details
    const { data: release, error: releaseError } = await supabase
      .from("releases")
      .select("id, indicator_id, release_at, period, actual, forecast, previous")
      .eq("id", release_id)
      .single();

    if (releaseError || !release) {
      return new Response(
        JSON.stringify({ error: "Release not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const rel = release as Release;

    // Get data source ID for logging
    const { data: dataSource } = await supabase
      .from("data_sources")
      .select("id")
      .eq("name", ind.data_source_name)
      .single();

    const dataSourceId = dataSource?.id;

    let actualValue: string | null = null;
    let errorMessage: string | undefined;

    try {
      // 3. Fetch actual value from external API
      console.log(
        `Fetching data from ${ind.data_source_name} for series ${ind.series_id}`
      );
      actualValue = await fetchDataFromSource(
        ind.data_source_name,
        ind.series_id
      );

      if (!actualValue) {
        errorMessage = "No data available from source";
        console.warn(errorMessage);
      } else {
        console.log(`Fetched value: ${actualValue}`);
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to fetch data from source:", errorMessage);
      
      // Log failed sync
      if (dataSourceId) {
        await logSync(dataSourceId, "failed", 0, errorMessage);
      }

      return new Response(
        JSON.stringify({
          error: "Failed to fetch data from source",
          details: errorMessage,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 4. Update releases.actual if we got a value
    if (actualValue) {
      const { error: updateError } = await supabase
        .from("releases")
        .update({ actual: actualValue })
        .eq("id", release_id);

      if (updateError) {
        errorMessage = `Failed to update release: ${updateError.message}`;
        console.error(errorMessage);
        
        // Log partial sync (fetched but failed to save)
        if (dataSourceId) {
          await logSync(dataSourceId, "partial", 0, errorMessage);
        }

        return new Response(
          JSON.stringify({
            error: "Failed to update release",
            details: updateError.message,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Updated release ${release_id} with actual value: ${actualValue}`);

      // 5. Trigger webhooks - construct database trigger payload format
      // The send-webhook function expects a database webhook payload
      const webhookPayload = {
        type: rel.actual ? "UPDATE" : "INSERT",
        table: "releases",
        schema: "public",
        record: {
          ...rel,
          actual: actualValue,
        },
        old_record: rel.actual ? rel : null,
      };

      await triggerEdgeFunction("send-webhook", webhookPayload);

      // 6. Trigger email alerts - same payload format
      await triggerEdgeFunction("send-release-alert", webhookPayload);

      // 7. Log successful sync
      if (dataSourceId) {
        await logSync(dataSourceId, "success", 1);
      }

      return new Response(
        JSON.stringify({
          message: "Data import completed successfully",
          indicator_id: ind.id,
          release_id: rel.id,
          actual_value: actualValue,
          data_source: ind.data_source_name,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      // Log partial sync (no data available)
      if (dataSourceId) {
        await logSync(dataSourceId, "partial", 0, errorMessage);
      }

      return new Response(
        JSON.stringify({
          message: "No data available from source",
          indicator_id: ind.id,
          release_id: rel.id,
          data_source: ind.data_source_name,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
