/**
 * GET /api/openapi - Serve the OpenAPI 3.0 specification as JSON
 *
 * This endpoint provides programmatic access to the API specification
 * for tools like Swagger UI and API clients.
 *
 * Task: T315 - Add API documentation page
 */

import { NextResponse } from "next/server";
import { getOpenApiJson } from "@/lib/api/openapi";

export const dynamic = "force-static";

export async function GET(): Promise<NextResponse> {
  const specJson = getOpenApiJson();

  return new NextResponse(specJson, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Allow caching as the spec rarely changes
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
