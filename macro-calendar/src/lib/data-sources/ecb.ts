/**
 * ECB (European Central Bank) API Integration
 * Task: T407 (minimal implementation for import-release-data)
 * 
 * Fetches European economic data from the ECB Statistical Data Warehouse.
 * API Documentation: https://data.ecb.europa.eu/help/api/overview
 * 
 * Note: ECB API does not require an API key.
 */

export interface EcbObservation {
  TIME_PERIOD: string; // Date in YYYY-MM-DD or YYYY-MM format
  OBS_VALUE: string; // Numeric value
}

export interface EcbDataSet {
  observations: Record<string, EcbObservation>;
}

/**
 * Fetch the latest observation for an ECB series.
 * 
 * @param flowRef - ECB data flow reference
 * @param seriesKey - ECB series key (dimensions)
 * @returns The latest value or null if not available
 */
export async function fetchLatestEcbValue(
  flowRef: string,
  seriesKey: string
): Promise<{ value: string; date: string } | null> {
  // ECB SDMX-JSON API endpoint
  const baseUrl = `https://data-api.ecb.europa.eu/service/data/${flowRef}/${seriesKey}`;
  const url = new URL(baseUrl);
  
  // Request parameters
  url.searchParams.set('format', 'jsondata');
  url.searchParams.set('lastNObservations', '1'); // Get only the most recent

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ECB API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // ECB returns data in SDMX-JSON format
  // Structure: data.dataSets[0].series[key].observations[index]
  const dataSets = data.dataSets;
  
  if (!dataSets || dataSets.length === 0) {
    return null;
  }

  const dataSet = dataSets[0];
  
  if (!dataSet.series) {
    return null;
  }

  // Get the first (and should be only) series
  const seriesKeys = Object.keys(dataSet.series);
  
  if (seriesKeys.length === 0) {
    return null;
  }

  const series = dataSet.series[seriesKeys[0]];
  
  if (!series.observations) {
    return null;
  }

  // Get the observation keys (indices)
  const obsKeys = Object.keys(series.observations);
  
  if (obsKeys.length === 0) {
    return null;
  }

  // Get the latest observation (should be index 0 with lastNObservations=1)
  const latestObs = series.observations[obsKeys[0]];
  
  if (!latestObs || latestObs.length === 0) {
    return null;
  }

  const value = latestObs[0]; // Observation value
  
  // Get the corresponding time period from structure
  const dimensions = data.structure.dimensions.observation;
  const timeDimension = dimensions.find((d: { id: string }) => d.id === 'TIME_PERIOD');
  
  if (!timeDimension || !timeDimension.values) {
    return null;
  }

  // The obsKey corresponds to the index in the time dimension values
  const obsIndex = parseInt(obsKeys[0], 10);
  const timeValue = timeDimension.values[obsIndex];
  
  if (!timeValue) {
    return null;
  }

  return {
    value: value.toString(),
    date: timeValue.id,
  };
}
