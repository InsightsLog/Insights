/**
 * OpenAPI 3.0 Specification for Macro Calendar Public API
 *
 * This specification documents the versioned REST API at /api/v1/
 * for programmatic access to economic indicator and release data.
 *
 * Task: T310 - Design API schema and versioning strategy
 */

/**
 * OpenAPI 3.0.3 Specification object.
 * Exported as a TypeScript object for easier maintenance and testing.
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Macro Calendar API",
    description: `
The Macro Calendar API provides programmatic access to economic indicator data, 
release schedules, and calendar events.

## Authentication

All API endpoints require authentication using an API key. Include your API key 
in the Authorization header:

\`\`\`
Authorization: Bearer mc_your_api_key_here
\`\`\`

API keys can be generated from your account settings at /settings/api-keys.

## Rate Limits

Rate limits are enforced per API key based on your subscription tier:

| Plan       | Requests/minute | Requests/month |
|------------|----------------|----------------|
| Free       | 30             | 1,000          |
| Pro        | 60             | 50,000         |
| Enterprise | 120            | Unlimited      |

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Requests remaining in window
- \`X-RateLimit-Reset\`: Unix timestamp when limit resets

When rate limited, the API returns HTTP 429 with a \`Retry-After\` header.

## Versioning

The API uses URL path versioning. The current version is \`v1\`.
All endpoints are prefixed with \`/api/v1/\`.

Breaking changes will result in a new version (e.g., \`v2\`).
Non-breaking additions may be made to existing versions.

## Error Handling

All errors return a JSON object with an \`error\` field:

\`\`\`json
{
  "error": "Error message here",
  "code": "ERROR_CODE"
}
\`\`\`

Common HTTP status codes:
- 400: Bad Request (invalid parameters)
- 401: Unauthorized (missing or invalid API key)
- 403: Forbidden (insufficient permissions)
- 404: Not Found (resource doesn't exist)
- 429: Too Many Requests (rate limit exceeded)
- 500: Internal Server Error
`,
    version: "1.0.0",
    contact: {
      name: "Macro Calendar Support",
      url: "https://github.com/InsightsLog/Insights",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1",
    },
  ],
  tags: [
    {
      name: "Indicators",
      description: "Economic indicators tracked by the calendar",
    },
    {
      name: "Releases",
      description: "Scheduled and historical releases for indicators",
    },
    {
      name: "Calendar",
      description: "Upcoming release schedule",
    },
  ],
  paths: {
    "/indicators": {
      get: {
        tags: ["Indicators"],
        summary: "List all indicators",
        description: "Returns a paginated list of all economic indicators.",
        operationId: "listIndicators",
        parameters: [
          { $ref: "#/components/parameters/country" },
          { $ref: "#/components/parameters/category" },
          { $ref: "#/components/parameters/search" },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/offset" },
        ],
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Indicator" },
                    },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                  required: ["data", "pagination"],
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
        security: [{ apiKey: [] }],
      },
    },
    "/indicators/{id}": {
      get: {
        tags: ["Indicators"],
        summary: "Get a single indicator",
        description:
          "Returns detailed information about a specific indicator, including its latest releases.",
        operationId: "getIndicator",
        parameters: [
          {
            name: "id",
            in: "path",
            description: "Indicator UUID",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "include_releases",
            in: "query",
            description: "Include latest releases in response",
            schema: {
              type: "boolean",
              default: true,
            },
          },
          {
            name: "releases_limit",
            in: "query",
            description: "Number of releases to include (max 100)",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 10,
            },
          },
        ],
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/IndicatorWithReleases",
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
        security: [{ apiKey: [] }],
      },
    },
    "/releases": {
      get: {
        tags: ["Releases"],
        summary: "List releases",
        description:
          "Returns a paginated list of releases with optional filtering.",
        operationId: "listReleases",
        parameters: [
          {
            name: "indicator_id",
            in: "query",
            description: "Filter by indicator UUID",
            schema: {
              type: "string",
              format: "uuid",
            },
          },
          {
            name: "from_date",
            in: "query",
            description: "Filter releases from this date (ISO 8601)",
            schema: {
              type: "string",
              format: "date-time",
            },
          },
          {
            name: "to_date",
            in: "query",
            description: "Filter releases until this date (ISO 8601)",
            schema: {
              type: "string",
              format: "date-time",
            },
          },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/offset" },
        ],
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ReleaseWithIndicator" },
                    },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                  required: ["data", "pagination"],
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
        security: [{ apiKey: [] }],
      },
    },
    "/releases/{id}": {
      get: {
        tags: ["Releases"],
        summary: "Get a single release",
        description:
          "Returns detailed information about a specific release, including its indicator.",
        operationId: "getRelease",
        parameters: [
          {
            name: "id",
            in: "path",
            description: "Release UUID",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
          },
        ],
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ReleaseWithIndicator",
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
        security: [{ apiKey: [] }],
      },
    },
    "/calendar": {
      get: {
        tags: ["Calendar"],
        summary: "Get upcoming releases",
        description:
          "Returns upcoming releases for the specified time period. Default is the next 7 days.",
        operationId: "getCalendar",
        parameters: [
          {
            name: "days",
            in: "query",
            description: "Number of days to include (1-90)",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 90,
              default: 7,
            },
          },
          { $ref: "#/components/parameters/country" },
          { $ref: "#/components/parameters/category" },
        ],
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/CalendarEvent" },
                    },
                    meta: {
                      type: "object",
                      properties: {
                        from_date: {
                          type: "string",
                          format: "date-time",
                          description: "Start of the calendar range",
                        },
                        to_date: {
                          type: "string",
                          format: "date-time",
                          description: "End of the calendar range",
                        },
                        total_events: {
                          type: "integer",
                          description: "Total number of events in range",
                        },
                      },
                      required: ["from_date", "to_date", "total_events"],
                    },
                  },
                  required: ["data", "meta"],
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
        security: [{ apiKey: [] }],
      },
    },
  },
  components: {
    securitySchemes: {
      apiKey: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description:
          "API key authentication. Get your key at /settings/api-keys",
      },
    },
    parameters: {
      country: {
        name: "country",
        in: "query",
        description: "Filter by country code (e.g., US, EU, GB)",
        schema: {
          type: "string",
          minLength: 2,
          maxLength: 3,
        },
      },
      category: {
        name: "category",
        in: "query",
        description: "Filter by category (e.g., Employment, Inflation, GDP)",
        schema: {
          type: "string",
        },
      },
      search: {
        name: "search",
        in: "query",
        description: "Search indicator names (case-insensitive)",
        schema: {
          type: "string",
          minLength: 1,
          maxLength: 100,
        },
      },
      limit: {
        name: "limit",
        in: "query",
        description: "Number of results to return (max 100)",
        schema: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 20,
        },
      },
      offset: {
        name: "offset",
        in: "query",
        description: "Number of results to skip for pagination",
        schema: {
          type: "integer",
          minimum: 0,
          default: 0,
        },
      },
    },
    schemas: {
      Indicator: {
        type: "object",
        description: "An economic indicator",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "Unique identifier",
          },
          name: {
            type: "string",
            description: "Indicator name (e.g., 'CPI (YoY)')",
          },
          country_code: {
            type: "string",
            description: "ISO country code (e.g., 'US', 'EU')",
          },
          category: {
            type: "string",
            description: "Category (e.g., 'Inflation', 'Employment')",
          },
          source_name: {
            type: "string",
            description: "Data source name (e.g., 'Bureau of Labor Statistics')",
          },
          source_url: {
            type: "string",
            format: "uri",
            nullable: true,
            description: "URL to the source",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "When the indicator was added",
          },
        },
        required: [
          "id",
          "name",
          "country_code",
          "category",
          "source_name",
          "created_at",
        ],
      },
      IndicatorWithReleases: {
        allOf: [
          { $ref: "#/components/schemas/Indicator" },
          {
            type: "object",
            properties: {
              releases: {
                type: "array",
                items: { $ref: "#/components/schemas/Release" },
                description: "Latest releases for this indicator",
              },
            },
          },
        ],
      },
      Release: {
        type: "object",
        description: "A release event for an indicator",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            description: "Unique identifier",
          },
          indicator_id: {
            type: "string",
            format: "uuid",
            description: "Associated indicator ID",
          },
          release_at: {
            type: "string",
            format: "date-time",
            description: "Scheduled release date/time (UTC)",
          },
          period: {
            type: "string",
            description: "Period covered (e.g., 'Jan 2026', 'Q4 2025')",
          },
          actual: {
            type: "string",
            nullable: true,
            description: "Actual value (null if not yet released)",
          },
          forecast: {
            type: "string",
            nullable: true,
            description: "Forecasted value",
          },
          previous: {
            type: "string",
            nullable: true,
            description: "Previous period value",
          },
          revised: {
            type: "string",
            nullable: true,
            description: "Revised previous value (if applicable)",
          },
          unit: {
            type: "string",
            nullable: true,
            description: "Unit of measurement (e.g., '%', 'K')",
          },
          revision_history: {
            type: "array",
            items: { $ref: "#/components/schemas/Revision" },
            description: "History of revisions to the actual value",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "When the release was added",
          },
        },
        required: ["id", "indicator_id", "release_at", "period", "created_at"],
      },
      ReleaseWithIndicator: {
        allOf: [
          { $ref: "#/components/schemas/Release" },
          {
            type: "object",
            properties: {
              indicator: {
                $ref: "#/components/schemas/Indicator",
                description: "Associated indicator",
              },
            },
          },
        ],
      },
      CalendarEvent: {
        type: "object",
        description: "A calendar event combining release and indicator data",
        properties: {
          release_id: {
            type: "string",
            format: "uuid",
            description: "Release UUID",
          },
          release_at: {
            type: "string",
            format: "date-time",
            description: "Scheduled release date/time (UTC)",
          },
          indicator_id: {
            type: "string",
            format: "uuid",
            description: "Indicator UUID",
          },
          indicator_name: {
            type: "string",
            description: "Indicator name",
          },
          country_code: {
            type: "string",
            description: "ISO country code",
          },
          category: {
            type: "string",
            description: "Category",
          },
          period: {
            type: "string",
            description: "Period covered",
          },
          forecast: {
            type: "string",
            nullable: true,
            description: "Forecasted value",
          },
          previous: {
            type: "string",
            nullable: true,
            description: "Previous period value",
          },
          actual: {
            type: "string",
            nullable: true,
            description: "Actual value (null if not yet released)",
          },
          has_revisions: {
            type: "boolean",
            description: "Whether this release has been revised",
          },
        },
        required: [
          "release_id",
          "release_at",
          "indicator_id",
          "indicator_name",
          "country_code",
          "category",
          "period",
          "has_revisions",
        ],
      },
      Revision: {
        type: "object",
        description: "A revision to an actual value",
        properties: {
          previous_actual: {
            type: "string",
            description: "Value before revision",
          },
          new_actual: {
            type: "string",
            description: "Value after revision",
          },
          revised_at: {
            type: "string",
            format: "date-time",
            description: "When the revision was made",
          },
        },
        required: ["previous_actual", "new_actual", "revised_at"],
      },
      Pagination: {
        type: "object",
        description: "Pagination metadata",
        properties: {
          total: {
            type: "integer",
            description: "Total number of results",
          },
          limit: {
            type: "integer",
            description: "Results per page",
          },
          offset: {
            type: "integer",
            description: "Current offset",
          },
          has_more: {
            type: "boolean",
            description: "Whether more results are available",
          },
        },
        required: ["total", "limit", "offset", "has_more"],
      },
      Error: {
        type: "object",
        description: "Error response",
        properties: {
          error: {
            type: "string",
            description: "Human-readable error message",
          },
          code: {
            type: "string",
            description: "Machine-readable error code",
          },
        },
        required: ["error"],
      },
    },
    responses: {
      BadRequest: {
        description: "Bad Request - Invalid parameters",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: {
              error: "Invalid parameter: limit must be between 1 and 100",
              code: "INVALID_PARAMETER",
            },
          },
        },
      },
      Unauthorized: {
        description: "Unauthorized - Missing or invalid API key",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: {
              error: "Invalid or missing API key",
              code: "UNAUTHORIZED",
            },
          },
        },
      },
      NotFound: {
        description: "Not Found - Resource doesn't exist",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: {
              error: "Indicator not found",
              code: "NOT_FOUND",
            },
          },
        },
      },
      RateLimited: {
        description: "Too Many Requests - Rate limit exceeded",
        headers: {
          "Retry-After": {
            description: "Seconds until rate limit resets",
            schema: { type: "integer" },
          },
          "X-RateLimit-Limit": {
            description: "Maximum requests allowed",
            schema: { type: "integer" },
          },
          "X-RateLimit-Remaining": {
            description: "Requests remaining (always 0 when rate limited)",
            schema: { type: "integer" },
          },
          "X-RateLimit-Reset": {
            description: "Unix timestamp when limit resets",
            schema: { type: "integer" },
          },
        },
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: {
              error: "Rate limit exceeded. Please try again later.",
              code: "RATE_LIMITED",
            },
          },
        },
      },
      InternalError: {
        description: "Internal Server Error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: {
              error: "Internal server error",
              code: "INTERNAL_ERROR",
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Rate limit tiers for API access.
 * Defined per subscription plan for quota enforcement.
 */
export const rateLimitTiers = {
  free: {
    name: "Free",
    requestsPerMinute: 30,
    requestsPerMonth: 1000,
    description: "Basic access for evaluation and personal projects",
  },
  pro: {
    name: "Pro",
    requestsPerMinute: 60,
    requestsPerMonth: 50000,
    description: "Professional access for production applications",
  },
  enterprise: {
    name: "Enterprise",
    requestsPerMinute: 120,
    requestsPerMonth: -1, // Unlimited
    description: "Enterprise access with unlimited monthly requests",
  },
} as const;

export type RateLimitTier = keyof typeof rateLimitTiers;

/**
 * Get the OpenAPI specification as a JSON string.
 * Useful for serving the spec at a /openapi.json endpoint.
 */
export function getOpenApiJson(): string {
  return JSON.stringify(openApiSpec, null, 2);
}

/**
 * API version information.
 */
export const apiVersion = {
  current: "v1",
  prefix: "/api/v1",
  deprecated: [] as string[],
} as const;
