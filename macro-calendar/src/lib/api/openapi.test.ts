import { describe, it, expect } from "vitest";
import {
  openApiSpec,
  rateLimitTiers,
  getOpenApiJson,
  apiVersion,
} from "./openapi";

describe("OpenAPI Specification", () => {
  describe("spec structure", () => {
    it("has valid OpenAPI version", () => {
      expect(openApiSpec.openapi).toBe("3.0.3");
    });

    it("has required info fields", () => {
      expect(openApiSpec.info.title).toBe("Macro Calendar API");
      expect(openApiSpec.info.version).toBe("1.0.0");
      expect(openApiSpec.info.description).toBeDefined();
      expect(openApiSpec.info.description.length).toBeGreaterThan(100);
    });

    it("has server configuration with v1 prefix", () => {
      expect(openApiSpec.servers).toHaveLength(1);
      expect(openApiSpec.servers[0].url).toBe("/api/v1");
    });

    it("has required tags", () => {
      const tagNames = openApiSpec.tags.map((t) => t.name);
      expect(tagNames).toContain("Indicators");
      expect(tagNames).toContain("Releases");
      expect(tagNames).toContain("Calendar");
    });
  });

  describe("paths", () => {
    it("defines /indicators endpoint", () => {
      expect(openApiSpec.paths["/indicators"]).toBeDefined();
      expect(openApiSpec.paths["/indicators"].get).toBeDefined();
      expect(openApiSpec.paths["/indicators"].get?.operationId).toBe(
        "listIndicators"
      );
    });

    it("defines /indicators/{id} endpoint", () => {
      expect(openApiSpec.paths["/indicators/{id}"]).toBeDefined();
      expect(openApiSpec.paths["/indicators/{id}"].get).toBeDefined();
      expect(openApiSpec.paths["/indicators/{id}"].get?.operationId).toBe(
        "getIndicator"
      );
    });

    it("defines /releases endpoint", () => {
      expect(openApiSpec.paths["/releases"]).toBeDefined();
      expect(openApiSpec.paths["/releases"].get).toBeDefined();
      expect(openApiSpec.paths["/releases"].get?.operationId).toBe(
        "listReleases"
      );
    });

    it("defines /releases/{id} endpoint", () => {
      expect(openApiSpec.paths["/releases/{id}"]).toBeDefined();
      expect(openApiSpec.paths["/releases/{id}"].get).toBeDefined();
      expect(openApiSpec.paths["/releases/{id}"].get?.operationId).toBe(
        "getRelease"
      );
    });

    it("defines /calendar endpoint", () => {
      expect(openApiSpec.paths["/calendar"]).toBeDefined();
      expect(openApiSpec.paths["/calendar"].get).toBeDefined();
      expect(openApiSpec.paths["/calendar"].get?.operationId).toBe(
        "getCalendar"
      );
    });

    it("all endpoints require API key security", () => {
      const paths = Object.values(openApiSpec.paths);
      for (const path of paths) {
        if (path.get) {
          expect(path.get.security).toEqual([{ apiKey: [] }]);
        }
      }
    });

    it("all endpoints have standard error responses", () => {
      const expectedResponses = ["401", "429", "500"] as const;
      const paths = Object.values(openApiSpec.paths);
      for (const path of paths) {
        if (path.get) {
          for (const code of expectedResponses) {
            expect(
              (path.get.responses as Record<string, unknown>)[code]
            ).toBeDefined();
          }
        }
      }
    });
  });

  describe("components", () => {
    it("defines API key security scheme", () => {
      expect(openApiSpec.components.securitySchemes.apiKey).toBeDefined();
      expect(openApiSpec.components.securitySchemes.apiKey.type).toBe("http");
      expect(openApiSpec.components.securitySchemes.apiKey.scheme).toBe(
        "bearer"
      );
    });

    it("defines required schemas", () => {
      const schemaNames = Object.keys(openApiSpec.components.schemas);
      expect(schemaNames).toContain("Indicator");
      expect(schemaNames).toContain("Release");
      expect(schemaNames).toContain("CalendarEvent");
      expect(schemaNames).toContain("Pagination");
      expect(schemaNames).toContain("Error");
    });

    it("defines required parameters", () => {
      const paramNames = Object.keys(openApiSpec.components.parameters);
      expect(paramNames).toContain("country");
      expect(paramNames).toContain("category");
      expect(paramNames).toContain("search");
      expect(paramNames).toContain("limit");
      expect(paramNames).toContain("offset");
    });

    it("defines required response types", () => {
      const responseNames = Object.keys(openApiSpec.components.responses);
      expect(responseNames).toContain("BadRequest");
      expect(responseNames).toContain("Unauthorized");
      expect(responseNames).toContain("NotFound");
      expect(responseNames).toContain("RateLimited");
      expect(responseNames).toContain("InternalError");
    });
  });

  describe("schema validation", () => {
    it("Indicator schema has required fields", () => {
      const indicatorSchema = openApiSpec.components.schemas.Indicator;
      expect(indicatorSchema.required).toContain("id");
      expect(indicatorSchema.required).toContain("name");
      expect(indicatorSchema.required).toContain("country_code");
      expect(indicatorSchema.required).toContain("category");
      expect(indicatorSchema.required).toContain("source_name");
      expect(indicatorSchema.required).toContain("created_at");
    });

    it("Release schema has required fields", () => {
      const releaseSchema = openApiSpec.components.schemas.Release;
      expect(releaseSchema.required).toContain("id");
      expect(releaseSchema.required).toContain("indicator_id");
      expect(releaseSchema.required).toContain("release_at");
      expect(releaseSchema.required).toContain("period");
      expect(releaseSchema.required).toContain("created_at");
    });

    it("Pagination schema has required fields", () => {
      const paginationSchema = openApiSpec.components.schemas.Pagination;
      expect(paginationSchema.required).toContain("total");
      expect(paginationSchema.required).toContain("limit");
      expect(paginationSchema.required).toContain("offset");
      expect(paginationSchema.required).toContain("has_more");
    });

    it("Error schema has required error field", () => {
      const errorSchema = openApiSpec.components.schemas.Error;
      expect(errorSchema.required).toContain("error");
    });

    it("Indicator schema has UUID format for id", () => {
      const indicatorSchema = openApiSpec.components.schemas.Indicator;
      expect(indicatorSchema.properties?.id?.format).toBe("uuid");
    });

    it("Release schema has datetime format for release_at", () => {
      const releaseSchema = openApiSpec.components.schemas.Release;
      expect(releaseSchema.properties?.release_at?.format).toBe("date-time");
    });
  });

  describe("parameter validation", () => {
    it("limit parameter has valid constraints", () => {
      const limitParam = openApiSpec.components.parameters.limit;
      expect(limitParam.schema.minimum).toBe(1);
      expect(limitParam.schema.maximum).toBe(100);
      expect(limitParam.schema.default).toBe(20);
    });

    it("offset parameter has valid constraints", () => {
      const offsetParam = openApiSpec.components.parameters.offset;
      expect(offsetParam.schema.minimum).toBe(0);
      expect(offsetParam.schema.default).toBe(0);
    });

    it("calendar days parameter has valid constraints", () => {
      const calendarPath = openApiSpec.paths["/calendar"];
      const daysParam = calendarPath.get?.parameters?.find(
        (p) => !("$ref" in p) && p.name === "days"
      );
      expect(daysParam).toBeDefined();
      if (daysParam && !("$ref" in daysParam)) {
        expect(daysParam.schema.minimum).toBe(1);
        expect(daysParam.schema.maximum).toBe(90);
        expect(daysParam.schema.default).toBe(7);
      }
    });
  });
});

describe("Rate Limit Tiers", () => {
  it("defines free tier with correct limits", () => {
    expect(rateLimitTiers.free).toBeDefined();
    expect(rateLimitTiers.free.name).toBe("Free");
    expect(rateLimitTiers.free.requestsPerMinute).toBe(30);
    expect(rateLimitTiers.free.requestsPerMonth).toBe(1000);
  });

  it("defines pro tier with correct limits", () => {
    expect(rateLimitTiers.pro).toBeDefined();
    expect(rateLimitTiers.pro.name).toBe("Pro");
    expect(rateLimitTiers.pro.requestsPerMinute).toBe(60);
    expect(rateLimitTiers.pro.requestsPerMonth).toBe(50000);
  });

  it("defines enterprise tier with unlimited monthly requests", () => {
    expect(rateLimitTiers.enterprise).toBeDefined();
    expect(rateLimitTiers.enterprise.name).toBe("Enterprise");
    expect(rateLimitTiers.enterprise.requestsPerMinute).toBe(120);
    expect(rateLimitTiers.enterprise.requestsPerMonth).toBe(-1); // Unlimited
  });

  it("has increasing rate limits per tier", () => {
    expect(rateLimitTiers.pro.requestsPerMinute).toBeGreaterThan(
      rateLimitTiers.free.requestsPerMinute
    );
    expect(rateLimitTiers.enterprise.requestsPerMinute).toBeGreaterThan(
      rateLimitTiers.pro.requestsPerMinute
    );
  });
});

describe("API Version", () => {
  it("has current version v1", () => {
    expect(apiVersion.current).toBe("v1");
  });

  it("has correct prefix", () => {
    expect(apiVersion.prefix).toBe("/api/v1");
  });

  it("has no deprecated versions", () => {
    expect(apiVersion.deprecated).toEqual([]);
  });
});

describe("getOpenApiJson", () => {
  it("returns valid JSON string", () => {
    const json = getOpenApiJson();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("returns formatted JSON", () => {
    const json = getOpenApiJson();
    expect(json).toContain("\n");
  });

  it("contains OpenAPI version", () => {
    const json = getOpenApiJson();
    const parsed = JSON.parse(json);
    expect(parsed.openapi).toBe("3.0.3");
  });

  it("contains all defined paths", () => {
    const json = getOpenApiJson();
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed.paths)).toHaveLength(5);
  });
});

describe("OpenAPI spec documentation", () => {
  it("info description documents authentication", () => {
    expect(openApiSpec.info.description).toContain("Authentication");
    expect(openApiSpec.info.description).toContain("Authorization");
    expect(openApiSpec.info.description).toContain("Bearer");
  });

  it("info description documents rate limits", () => {
    expect(openApiSpec.info.description).toContain("Rate Limits");
    expect(openApiSpec.info.description).toContain("Free");
    expect(openApiSpec.info.description).toContain("Pro");
    expect(openApiSpec.info.description).toContain("Enterprise");
  });

  it("info description documents versioning", () => {
    expect(openApiSpec.info.description).toContain("Versioning");
    expect(openApiSpec.info.description).toContain("/api/v1/");
  });

  it("info description documents error handling", () => {
    expect(openApiSpec.info.description).toContain("Error Handling");
    expect(openApiSpec.info.description).toContain("400");
    expect(openApiSpec.info.description).toContain("401");
    expect(openApiSpec.info.description).toContain("429");
  });
});
