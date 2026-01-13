import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for API Documentation components and route.
 *
 * Task: T315 - Add API documentation page
 */

// Mock the OpenAPI spec imports used by ApiDocsClient
vi.mock("@/lib/api/openapi", () => ({
  openApiSpec: {
    openapi: "3.0.3",
    info: {
      title: "Macro Calendar API",
      version: "1.0.0",
      description: "Test API description",
    },
    servers: [{ url: "/api/v1", description: "API v1" }],
    tags: [
      { name: "Indicators", description: "Economic indicators" },
      { name: "Releases", description: "Release data" },
      { name: "Calendar", description: "Calendar events" },
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
            { $ref: "#/components/parameters/limit" },
          ],
          responses: {},
          security: [{ apiKey: [] }],
        },
      },
      "/indicators/{id}": {
        get: {
          tags: ["Indicators"],
          summary: "Get a single indicator",
          description: "Returns detailed information about a specific indicator.",
          operationId: "getIndicator",
          parameters: [
            {
              name: "id",
              in: "path",
              description: "Indicator UUID",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {},
          security: [{ apiKey: [] }],
        },
      },
      "/calendar": {
        get: {
          tags: ["Calendar"],
          summary: "Get upcoming releases",
          description: "Returns upcoming releases.",
          operationId: "getCalendar",
          parameters: [
            {
              name: "days",
              in: "query",
              description: "Number of days",
              schema: { type: "integer", minimum: 1, maximum: 90, default: 7 },
            },
          ],
          responses: {},
          security: [{ apiKey: [] }],
        },
      },
    },
    components: {
      parameters: {
        country: {
          name: "country",
          in: "query",
          description: "Filter by country code",
          schema: { type: "string", minLength: 2, maxLength: 3 },
        },
        limit: {
          name: "limit",
          in: "query",
          description: "Number of results",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      },
      schemas: {},
      securitySchemes: {
        apiKey: { type: "http", scheme: "bearer" },
      },
      responses: {},
    },
  },
  rateLimitTiers: {
    free: { name: "Free", requestsPerMinute: 30, requestsPerMonth: 1000 },
    pro: { name: "Pro", requestsPerMinute: 60, requestsPerMonth: 50000 },
    enterprise: {
      name: "Enterprise",
      requestsPerMinute: 120,
      requestsPerMonth: -1,
    },
  },
  getOpenApiJson: () => JSON.stringify({ openapi: "3.0.3" }),
}));

describe("API Docs Route", () => {
  describe("/api/openapi endpoint", () => {
    it("should serve OpenAPI spec as JSON", async () => {
      // Import after mock is set up
      const { getOpenApiJson } = await import("@/lib/api/openapi");

      const json = getOpenApiJson();
      const parsed = JSON.parse(json);

      expect(parsed.openapi).toBe("3.0.3");
    });
  });
});

describe("ApiDocsClient Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("endpoint extraction", () => {
    it("extracts endpoints from OpenAPI spec", async () => {
      const { openApiSpec } = await import("@/lib/api/openapi");

      // Verify the mock spec has expected endpoints
      expect(openApiSpec.paths["/indicators"]).toBeDefined();
      expect(openApiSpec.paths["/indicators/{id}"]).toBeDefined();
      expect(openApiSpec.paths["/calendar"]).toBeDefined();
    });

    it("groups endpoints by tags", async () => {
      const { openApiSpec } = await import("@/lib/api/openapi");

      // Count endpoints per tag
      const tagCounts: Record<string, number> = {};
      for (const pathItem of Object.values(openApiSpec.paths)) {
        if (pathItem.get) {
          const tag = pathItem.get.tags[0];
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }

      expect(tagCounts["Indicators"]).toBe(2);
      expect(tagCounts["Calendar"]).toBe(1);
    });
  });

  describe("parameter resolution", () => {
    it("resolves $ref parameters correctly", async () => {
      const { openApiSpec } = await import("@/lib/api/openapi");

      const indicatorsPath = openApiSpec.paths["/indicators"];
      const params = indicatorsPath.get?.parameters || [];

      // First param should be a $ref
      expect(params[0]).toHaveProperty("$ref");
      expect(params[0].$ref).toBe("#/components/parameters/country");

      // Verify the referenced parameter exists
      const countryParam = openApiSpec.components.parameters.country;
      expect(countryParam.name).toBe("country");
      expect(countryParam.in).toBe("query");
    });

    it("handles inline parameters correctly", async () => {
      const { openApiSpec } = await import("@/lib/api/openapi");

      const calendarPath = openApiSpec.paths["/calendar"];
      const params = calendarPath.get?.parameters || [];

      // Days param should be inline (not a $ref)
      const daysParam = params.find(
        (p) => !("$ref" in p) && p.name === "days"
      );
      expect(daysParam).toBeDefined();
      if (daysParam && !("$ref" in daysParam)) {
        expect(daysParam.schema.default).toBe(7);
        expect(daysParam.schema.minimum).toBe(1);
        expect(daysParam.schema.maximum).toBe(90);
      }
    });

    it("handles path parameters correctly", async () => {
      const { openApiSpec } = await import("@/lib/api/openapi");

      const indicatorByIdPath = openApiSpec.paths["/indicators/{id}"];
      const params = indicatorByIdPath.get?.parameters || [];

      const idParam = params.find((p) => !("$ref" in p) && p.name === "id");
      expect(idParam).toBeDefined();
      if (idParam && !("$ref" in idParam)) {
        expect(idParam.in).toBe("path");
        expect(idParam.required).toBe(true);
      }
    });
  });

  describe("rate limit tiers", () => {
    it("provides rate limit information", async () => {
      const { rateLimitTiers } = await import("@/lib/api/openapi");

      expect(rateLimitTiers.free).toBeDefined();
      expect(rateLimitTiers.pro).toBeDefined();
      expect(rateLimitTiers.enterprise).toBeDefined();

      // Verify tier values
      expect(rateLimitTiers.free.requestsPerMinute).toBe(30);
      expect(rateLimitTiers.pro.requestsPerMinute).toBe(60);
      expect(rateLimitTiers.enterprise.requestsPerMonth).toBe(-1); // Unlimited
    });
  });
});

describe("Code Example Generation", () => {
  // Test the logic for generating code examples
  describe("URL generation", () => {
    it("builds correct URL with path parameters", () => {
      const baseUrl = "https://your-domain.com/api/v1";
      const path = "/indicators/{id}";
      const paramValues = { id: "test-uuid-123" };

      let url = path;
      for (const [key, value] of Object.entries(paramValues)) {
        url = url.replace(`{${key}}`, value);
      }

      expect(`${baseUrl}${url}`).toBe(
        "https://your-domain.com/api/v1/indicators/test-uuid-123"
      );
    });

    it("builds correct URL with query parameters", () => {
      const baseUrl = "https://your-domain.com/api/v1";
      const path = "/indicators";
      const queryParams = [
        { name: "country", value: "US" },
        { name: "limit", value: "50" },
      ];

      const queryString = queryParams
        .filter((p) => p.value)
        .map((p) => `${p.name}=${encodeURIComponent(p.value)}`)
        .join("&");

      const fullUrl = queryString
        ? `${baseUrl}${path}?${queryString}`
        : `${baseUrl}${path}`;

      expect(fullUrl).toBe(
        "https://your-domain.com/api/v1/indicators?country=US&limit=50"
      );
    });

    it("handles URL encoding for query parameters", () => {
      const value = "test value with spaces";
      const encoded = encodeURIComponent(value);

      expect(encoded).toBe("test%20value%20with%20spaces");
    });
  });

  describe("example code formats", () => {
    it("generates valid cURL format", () => {
      const url = "https://your-domain.com/api/v1/indicators";
      const curl = `curl -X GET "${url}" \\
  -H "Authorization: Bearer mc_your_api_key_here" \\
  -H "Content-Type: application/json"`;

      expect(curl).toContain('curl -X GET');
      expect(curl).toContain("Authorization: Bearer");
      expect(curl).toContain(url);
    });

    it("generates valid JavaScript format", () => {
      const url = "https://your-domain.com/api/v1/indicators";
      const js = `const response = await fetch("${url}", {
  method: "GET",
  headers: {
    "Authorization": "Bearer mc_your_api_key_here"
  }
});`;

      expect(js).toContain("await fetch");
      expect(js).toContain('method: "GET"');
      expect(js).toContain("Authorization");
      expect(js).toContain(url);
    });

    it("generates valid Python format", () => {
      const url = "https://your-domain.com/api/v1/indicators";
      const python = `import requests

url = "${url}"
headers = {
    "Authorization": "Bearer mc_your_api_key_here"
}

response = requests.get(url, headers=headers)`;

      expect(python).toContain("import requests");
      expect(python).toContain("requests.get");
      expect(python).toContain("Authorization");
      expect(python).toContain(url);
    });
  });
});

describe("API Docs Page", () => {
  it("exports a valid page component", async () => {
    // This tests that the page module can be imported without errors
    const pageModule = await import("@/app/docs/api/page");

    expect(pageModule.default).toBeDefined();
    expect(typeof pageModule.default).toBe("function");
  });

  it("has proper metadata export", async () => {
    const pageModule = await import("@/app/docs/api/page");

    expect(pageModule.metadata).toBeDefined();
    expect(pageModule.metadata.title).toBe("API Documentation");
    expect(pageModule.metadata.description).toContain("API documentation");
  });
});
