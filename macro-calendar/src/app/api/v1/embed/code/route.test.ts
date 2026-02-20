import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Mock env to avoid validation errors in test environment
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  },
}));

describe("GET /api/v1/embed/code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars between tests
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  describe("default parameters", () => {
    it("returns snippet with default parameters", async () => {
      const request = new NextRequest("http://localhost/api/v1/embed/code");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.snippet).toContain("<iframe");
      expect(body.snippet).toContain("/widget/calendar");
      expect(body.snippet).toContain('height="400"');
      expect(body.snippet).toContain('width="100%"');
    });

    it("returns widget_url in response", async () => {
      const request = new NextRequest("http://localhost/api/v1/embed/code");
      const response = await GET(request);

      const body = await response.json();
      expect(body.widget_url).toContain("/widget/calendar");
    });

    it("returns correct default params", async () => {
      const request = new NextRequest("http://localhost/api/v1/embed/code");
      const response = await GET(request);

      const body = await response.json();
      expect(body.params.impact).toBe("all");
      expect(body.params.theme).toBe("light");
      expect(body.params.width).toBe("100%");
      expect(body.params.height).toBe(400);
    });

    it("sets Cache-Control header", async () => {
      const request = new NextRequest("http://localhost/api/v1/embed/code");
      const response = await GET(request);

      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=3600, s-maxage=3600"
      );
    });
  });

  describe("query parameters", () => {
    it("includes countries in widget URL when specified", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/embed/code?countries=US,EU"
      );
      const response = await GET(request);

      const body = await response.json();
      expect(body.widget_url).toContain("countries=US%2CEU");
      expect(body.snippet).toContain("countries=US%2CEU");
    });

    it("includes impact=high in widget URL when specified", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/embed/code?impact=high"
      );
      const response = await GET(request);

      const body = await response.json();
      expect(body.widget_url).toContain("impact=high");
    });

    it("omits impact from URL when set to all (default)", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/embed/code?impact=all"
      );
      const response = await GET(request);

      const body = await response.json();
      expect(body.widget_url).not.toContain("impact=");
    });

    it("includes theme=dark in widget URL when specified", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/embed/code?theme=dark"
      );
      const response = await GET(request);

      const body = await response.json();
      expect(body.widget_url).toContain("theme=dark");
    });

    it("omits theme from URL when set to light (default)", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/embed/code?theme=light"
      );
      const response = await GET(request);

      const body = await response.json();
      expect(body.widget_url).not.toContain("theme=");
    });

    it("accepts custom height", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/embed/code?height=600"
      );
      const response = await GET(request);

      const body = await response.json();
      expect(body.snippet).toContain('height="600"');
      expect(body.params.height).toBe(600);
    });

    it("accepts custom width", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/embed/code?width=800px"
      );
      const response = await GET(request);

      const body = await response.json();
      expect(body.snippet).toContain('width="800px"');
      expect(body.params.width).toBe("800px");
    });
  });

  describe("parameter validation", () => {
    it("returns 400 for invalid impact value", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/embed/code?impact=extreme"
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 for invalid theme value", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/embed/code?theme=blue"
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 for height below minimum", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/embed/code?height=50"
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });

    it("returns 400 for height above maximum", async () => {
      const request = new NextRequest(
        "http://localhost/api/v1/embed/code?height=5000"
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe("INVALID_PARAMETER");
    });
  });

  describe("base URL resolution", () => {
    it("uses NEXT_PUBLIC_APP_URL when set", async () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://myapp.example.com";

      const request = new NextRequest("http://localhost/api/v1/embed/code");
      const response = await GET(request);

      const body = await response.json();
      expect(body.widget_url).toContain("https://myapp.example.com");
    });

    it("falls back to NEXT_PUBLIC_SITE_URL when APP_URL not set", async () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://siteurl.example.com";

      const request = new NextRequest("http://localhost/api/v1/embed/code");
      const response = await GET(request);

      const body = await response.json();
      expect(body.widget_url).toContain("https://siteurl.example.com");
    });
  });
});
