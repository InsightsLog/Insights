/**
 * BLS (Bureau of Labor Statistics) API Integration
 * Task: T407 (minimal implementation for import-release-data)
 * 
 * Fetches employment and labor data from the U.S. Bureau of Labor Statistics API.
 * API Documentation: https://www.bls.gov/developers/api_signature_v2.htm
 */

export interface BlsDataPoint {
  year: string;
  period: string; // M01-M12 for months, Q01-Q04 for quarters, A01 for annual
  periodName: string;
  value: string;
  latest: string; // 'true' or 'false'
}

export interface BlsSeries {
  seriesID: string;
  data: BlsDataPoint[];
}

export interface BlsApiResponse {
  status: string;
  responseTime: number;
  message?: string[];
  Results?: {
    series: BlsSeries[];
  };
}

/**
 * Fetch the latest observation for a BLS series.
 * 
 * @param seriesId - BLS series ID (e.g., 'CES0000000001' for nonfarm payrolls)
 * @param apiKey - BLS API key (optional for v2 with higher rate limits)
 * @returns The latest value or null if not available
 */
export async function fetchLatestBlsValue(
  seriesId: string,
  apiKey?: string
): Promise<{ value: string; period: string; year: string } | null> {
  const baseUrl = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
  
  // Get current year and last year for the request
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  
  const payload = {
    seriesid: [seriesId],
    startyear: lastYear.toString(),
    endyear: currentYear.toString(),
    latest: true, // Get only the most recent value
    ...(apiKey && { registrationkey: apiKey }),
  };

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`BLS API error: ${response.status} ${response.statusText}`);
  }

  const data: BlsApiResponse = await response.json();
  
  if (data.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS API request failed: ${data.message?.join(', ') || 'Unknown error'}`);
  }

  if (!data.Results?.series || data.Results.series.length === 0) {
    return null;
  }

  const series = data.Results.series[0];
  
  if (!series.data || series.data.length === 0) {
    return null;
  }

  const latest = series.data[0]; // BLS API sorts by latest first when latest=true
  
  return {
    value: latest.value,
    period: latest.periodName,
    year: latest.year,
  };
}
