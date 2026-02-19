/**
 * FRED (Federal Reserve Economic Data) API Integration
 * Task: T407 (minimal implementation for import-release-data)
 * 
 * Fetches the latest economic data from the St. Louis Federal Reserve API.
 * API Documentation: https://fred.stlouisfed.org/docs/api/fred/
 */

export interface FredDataPoint {
  date: string; // YYYY-MM-DD format
  value: string; // Numeric value as string
}

export interface FredSeriesResponse {
  observations: FredDataPoint[];
}

/**
 * Fetch the latest observation for a FRED series.
 * 
 * @param seriesId - FRED series ID (e.g., 'CPIAUCSL' for CPI)
 * @param apiKey - FRED API key
 * @returns The latest value or null if not available
 */
export async function fetchLatestFredValue(
  seriesId: string,
  apiKey: string
): Promise<{ value: string; date: string } | null> {
  const baseUrl = 'https://api.stlouisfed.org/fred/series/observations';
  const url = new URL(baseUrl);
  
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('sort_order', 'desc'); // Most recent first
  url.searchParams.set('limit', '1'); // Only get the latest

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`FRED API error: ${response.status} ${response.statusText}`);
  }

  const data: FredSeriesResponse = await response.json();
  
  if (!data.observations || data.observations.length === 0) {
    return null;
  }

  const latest = data.observations[0];
  
  // FRED returns "." for missing values
  if (!latest.value || latest.value === '.') {
    return null;
  }

  return {
    value: latest.value,
    date: latest.date,
  };
}
