/**
 * GET /api/v1/embed/code — Generate embeddable widget HTML snippet
 *
 * Returns an iframe HTML snippet for embedding the macro calendar widget.
 * No authentication required — this is a public endpoint.
 *
 * Query parameters:
 * - countries: Comma-separated country codes to filter (e.g. US,EU)
 * - impact: Impact level filter — high | medium | low | all (default: all)
 * - theme: Widget color theme — dark | light (default: light)
 * - width: Iframe width (default: 100%)
 * - height: Iframe height in pixels (default: 400)
 *
 * Task: T510
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const queryParamsSchema = z.object({
  countries: z.string().optional(),
  impact: z.enum(["high", "medium", "low", "all"]).optional().default("all"),
  theme: z.enum(["dark", "light"]).optional().default("light"),
  width: z.string().optional().default("100%"),
  height: z.coerce.number().int().min(100).max(2000).optional().default(400),
});

interface EmbedCodeResponse {
  snippet: string;
  widget_url: string;
  params: {
    countries: string | undefined;
    impact: string;
    theme: string;
    width: string;
    height: number;
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<EmbedCodeResponse | { error: string; code: string }>> {
  const { searchParams } = new URL(request.url);

  const parseResult = queryParamsSchema.safeParse({
    countries: searchParams.get("countries") ?? undefined,
    impact: searchParams.get("impact") ?? undefined,
    theme: searchParams.get("theme") ?? undefined,
    width: searchParams.get("width") ?? undefined,
    height: searchParams.get("height") ?? undefined,
  });

  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return NextResponse.json(
      {
        error: `Invalid parameter: ${firstError?.path.join(".")} — ${firstError?.message}`,
        code: "INVALID_PARAMETER",
      },
      { status: 400 }
    );
  }

  const { countries, impact, theme, width, height } = parseResult.data;

  // Build the widget URL
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://insights-econ-watchs-projects.vercel.app";

  const widgetParams = new URLSearchParams();
  if (countries) widgetParams.set("countries", countries);
  if (impact !== "all") widgetParams.set("impact", impact);
  if (theme !== "light") widgetParams.set("theme", theme);

  const widgetUrl = `${baseUrl}/widget/calendar${widgetParams.size > 0 ? `?${widgetParams.toString()}` : ""}`;

  const snippet = `<iframe
  src="${widgetUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  title="Macro Economic Calendar"
  style="border:none;overflow:hidden;"
  loading="lazy"
></iframe>`;

  const response = NextResponse.json<EmbedCodeResponse>({
    snippet,
    widget_url: widgetUrl,
    params: { countries, impact, theme, width, height },
  });

  // Cache the response for 1 hour (params-keyed by Vary)
  response.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");

  return response;
}
