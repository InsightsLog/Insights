/**
 * Insights API client for the mobile app.
 *
 * Fetches release data from the /api/v1/releases endpoint.
 * Configure API_BASE_URL and API_KEY below (or via a secrets manager).
 */

/** Base URL for the Insights API. Override this for local dev. */
export const API_BASE_URL =
  process.env['EXPO_PUBLIC_API_BASE_URL'] ?? 'https://insights-econ-watchs-projects.vercel.app';

/** API key for authenticating requests. Set via env or secrets manager. */
export const API_KEY =
  process.env['EXPO_PUBLIC_API_KEY'] ?? '';

// ---------------------------------------------------------------------------
// Shared TypeScript types (mirrors macro-calendar /api/v1/releases shapes)
// ---------------------------------------------------------------------------

export interface Indicator {
  id: string;
  name: string;
  country_code: string;
  category: string;
  importance: 'low' | 'medium' | 'high';
  source_name: string;
  source_url: string | null;
  created_at: string;
}

export interface Release {
  id: string;
  indicator_id: string;
  release_at: string;
  period: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  revised: string | null;
  unit: string | null;
  created_at: string;
  indicator: Indicator;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ReleasesResponse {
  data: Release[];
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export interface FetchReleasesParams {
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch releases from the Insights /api/v1/releases endpoint.
 * Throws an Error if the request fails or the response is not ok.
 */
export async function fetchReleases(
  params: FetchReleasesParams = {}
): Promise<ReleasesResponse> {
  const url = new URL('/api/v1/releases', API_BASE_URL);

  if (params.from_date) url.searchParams.set('from_date', params.from_date);
  if (params.to_date) url.searchParams.set('to_date', params.to_date);
  if (params.limit !== undefined)
    url.searchParams.set('limit', String(params.limit));
  if (params.offset !== undefined)
    url.searchParams.set('offset', String(params.offset));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<ReleasesResponse>;
}
