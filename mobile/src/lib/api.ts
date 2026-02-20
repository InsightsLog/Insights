/**
 * Insights API client for the mobile app.
 *
 * Fetches release and watchlist data via Supabase or the /api/v1 REST API.
 * Configure API_BASE_URL and API_KEY below (or via a secrets manager).
 */

import { supabase } from './supabase';

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

// ---------------------------------------------------------------------------
// Watchlist helpers (Supabase direct queries, respects RLS)
// ---------------------------------------------------------------------------

export interface WatchlistEntry {
  id: string;
  indicator_id: string;
  created_at: string;
  indicator: Indicator;
  /** Earliest future release for this indicator, or null if none scheduled. */
  next_release: Pick<Release, 'id' | 'release_at' | 'period'> | null;
}

/**
 * Fetch the signed-in user's watchlist with indicator details and the next
 * upcoming release per indicator.
 *
 * Requires an active Supabase session. Returns an empty array if there is no
 * authenticated user or the watchlist is empty.
 *
 * Throws an Error on Supabase query failure.
 */
export async function fetchWatchlist(): Promise<WatchlistEntry[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Fetch watchlist rows joined with indicator data
  const { data: watchlistRows, error: watchlistError } = await supabase
    .from('watchlist')
    .select(`
      id,
      indicator_id,
      created_at,
      indicators!inner(id, name, country_code, category, importance, source_name, source_url, created_at)
    `)
    .order('created_at', { ascending: true });

  if (watchlistError) {
    throw new Error(`Failed to fetch watchlist: ${watchlistError.message}`);
  }

  if (!watchlistRows || watchlistRows.length === 0) {
    return [];
  }

  const indicatorIds = watchlistRows.map((row) => row.indicator_id as string);

  // Fetch the next upcoming release for each watchlisted indicator in one query
  const now = new Date().toISOString();
  const { data: upcomingReleases, error: releasesError } = await supabase
    .from('releases')
    .select('id, indicator_id, release_at, period')
    .in('indicator_id', indicatorIds)
    .gte('release_at', now)
    .order('release_at', { ascending: true });

  if (releasesError) {
    throw new Error(`Failed to fetch upcoming releases: ${releasesError.message}`);
  }

  // Build a map of indicator_id → next release
  const nextReleaseMap = new Map<string, Pick<Release, 'id' | 'release_at' | 'period'>>();
  for (const rel of upcomingReleases ?? []) {
    if (!nextReleaseMap.has(rel.indicator_id as string)) {
      nextReleaseMap.set(rel.indicator_id as string, {
        id: rel.id as string,
        release_at: rel.release_at as string,
        period: rel.period as string,
      });
    }
  }

  return watchlistRows.map((row) => {
    const ind = Array.isArray(row.indicators) ? row.indicators[0] : row.indicators;
    const indicator: Indicator = {
      id: ind.id as string,
      name: ind.name as string,
      country_code: ind.country_code as string,
      category: ind.category as string,
      importance: ind.importance as 'low' | 'medium' | 'high',
      source_name: ind.source_name as string,
      source_url: ind.source_url as string | null,
      created_at: ind.created_at as string,
    };

    const nextRel = nextReleaseMap.get(row.indicator_id as string) ?? null;

    return {
      id: row.id as string,
      indicator_id: row.indicator_id as string,
      created_at: row.created_at as string,
      indicator,
      next_release: nextRel
        ? { id: nextRel.id, release_at: nextRel.release_at, period: nextRel.period }
        : null,
    };
  });
}

/**
 * Fetch upcoming releases (next `days` days) for the signed-in user's
 * watchlisted indicators, grouped by calendar day (ascending).
 *
 * Returns an empty array if there is no authenticated user, an empty
 * watchlist, or no upcoming releases in the window.
 *
 * Throws an Error on Supabase query failure.
 */
export async function fetchWatchlistAlerts(days = 7): Promise<Release[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Get the user's watchlisted indicator IDs
  const { data: watchlistRows, error: watchlistError } = await supabase
    .from('watchlist')
    .select('indicator_id');

  if (watchlistError) {
    throw new Error(`Failed to fetch watchlist: ${watchlistError.message}`);
  }

  if (!watchlistRows || watchlistRows.length === 0) {
    return [];
  }

  const indicatorIds = watchlistRows.map((row) => row.indicator_id as string);

  const now = new Date();
  const future = new Date(now);
  future.setDate(future.getDate() + days);

  const { data: releases, error: releasesError } = await supabase
    .from('releases')
    .select(`
      id, indicator_id, release_at, period, actual, forecast, previous, revised, unit, created_at,
      indicators!inner(id, name, country_code, category, importance, source_name, source_url, created_at)
    `)
    .in('indicator_id', indicatorIds)
    .gte('release_at', now.toISOString())
    .lte('release_at', future.toISOString())
    .order('release_at', { ascending: true });

  if (releasesError) {
    throw new Error(`Failed to fetch alerts: ${releasesError.message}`);
  }

  return (releases ?? []).map((rel) => {
    const ind = Array.isArray(rel.indicators) ? rel.indicators[0] : rel.indicators;
    return {
      id: rel.id as string,
      indicator_id: rel.indicator_id as string,
      release_at: rel.release_at as string,
      period: rel.period as string,
      actual: rel.actual as string | null,
      forecast: rel.forecast as string | null,
      previous: rel.previous as string | null,
      revised: rel.revised as string | null,
      unit: rel.unit as string | null,
      created_at: rel.created_at as string,
      indicator: {
        id: ind.id as string,
        name: ind.name as string,
        country_code: ind.country_code as string,
        category: ind.category as string,
        importance: ind.importance as 'low' | 'medium' | 'high',
        source_name: ind.source_name as string,
        source_url: ind.source_url as string | null,
        created_at: ind.created_at as string,
      },
    };
  });
}
