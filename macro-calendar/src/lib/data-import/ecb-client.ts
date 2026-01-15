/**
 * ECB API Client
 *
 * Client for fetching historical economic data from the European Central Bank (ECB)
 * Statistical Data Warehouse (SDW) using the SDMX-JSON REST API.
 *
 * API Documentation: https://sdw-wsrest.ecb.europa.eu/help/
 *
 * Rate Limits: No stated limit, fair use policy applies.
 * Format: SDMX-JSON (no API key required)
 */

const ECB_API_BASE_URL = "https://data-api.ecb.europa.eu/service/data";

/**
 * ECB observation data point normalized for our use.
 */
export interface ECBObservation {
  date: string; // YYYY-MM-DD format
  value: string; // Numeric value as string
  period: string; // Human-readable period (e.g., "Jan 2024", "Q1 2024")
}

/**
 * ECB series metadata.
 */
export interface ECBSeriesInfo {
  seriesKey: string;
  title: string;
  frequency: string; // "M" for monthly, "Q" for quarterly, "A" for annual
  unit?: string;
}

/**
 * Raw SDMX-JSON structure definitions.
 */
interface SDMXDimension {
  id: string;
  name: string;
  values: Array<{ id: string; name: string }>;
}

interface SDMXAttribute {
  id: string;
  name: string;
  values?: Array<{ id: string; name: string }>;
}

interface SDMXObservation {
  [key: string]: [number | null, ...number[]];
}

interface SDMXSeries {
  attributes?: number[];
  observations: SDMXObservation;
}

interface SDMXDataSet {
  action?: string;
  validFrom?: string;
  series?: {
    [seriesKey: string]: SDMXSeries;
  };
}

interface SDMXStructure {
  name?: string;
  dimensions?: {
    series?: SDMXDimension[];
    observation?: SDMXDimension[];
  };
  attributes?: {
    series?: SDMXAttribute[];
    observation?: SDMXAttribute[];
  };
}

interface SDMXResponse {
  header?: {
    id?: string;
    prepared?: string;
    sender?: { id: string };
  };
  dataSets?: SDMXDataSet[];
  structure?: SDMXStructure;
}

/**
 * ECB API error.
 */
export class ECBApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public dataflow?: string
  ) {
    super(message);
    this.name = "ECBApiError";
  }
}

/**
 * Delay execution for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert ECB time period to date string.
 * ECB uses various formats: YYYY-MM for monthly, YYYY-Q1 for quarterly, YYYY for annual.
 */
function periodToDate(period: string): string {
  // Monthly: 2024-01, 2024-02, etc.
  if (/^\d{4}-\d{2}$/.test(period)) {
    return `${period}-01`;
  }

  // Quarterly: 2024-Q1, 2024-Q2, etc.
  const quarterMatch = period.match(/^(\d{4})-Q(\d)$/);
  if (quarterMatch) {
    const year = quarterMatch[1];
    const quarter = parseInt(quarterMatch[2], 10);
    const month = ((quarter - 1) * 3 + 1).toString().padStart(2, "0");
    return `${year}-${month}-01`;
  }

  // Annual: 2024
  if (/^\d{4}$/.test(period)) {
    return `${period}-01-01`;
  }

  // Default: return as-is or append day
  return period.length === 7 ? `${period}-01` : period;
}

/**
 * Format period for human-readable display.
 */
function formatPeriodDisplay(period: string, _frequency: string): string {
  // Quarterly: 2024-Q1 -> Q1 2024
  const quarterMatch = period.match(/^(\d{4})-Q(\d)$/);
  if (quarterMatch) {
    return `Q${quarterMatch[2]} ${quarterMatch[1]}`;
  }

  // Monthly: 2024-01 -> Jan 2024
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = parseInt(month, 10) - 1;
    return `${months[monthIndex]} ${year}`;
  }

  // Annual: 2024 -> 2024
  if (/^\d{4}$/.test(period)) {
    return period;
  }

  return period;
}

/**
 * ECB API Client class.
 */
export class ECBClient {
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 500; // 500ms between requests for fair use

  constructor() {
    // ECB API doesn't require an API key
  }

  /**
   * Rate limiting: ensure minimum interval between requests.
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval && this.requestCount > 0) {
      await delay(this.minRequestInterval - timeSinceLastRequest);
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Make a request to the ECB API.
   * ECB uses a URL pattern: /dataflow/seriesKey?startPeriod=...&endPeriod=...
   */
  private async request(
    dataflow: string,
    seriesKey: string,
    startPeriod?: string,
    endPeriod?: string
  ): Promise<SDMXResponse> {
    await this.throttle();

    // Build URL: https://data-api.ecb.europa.eu/service/data/{dataflow}/{seriesKey}
    const url = new URL(`${ECB_API_BASE_URL}/${dataflow}/${seriesKey}`);
    
    // Add period filters if provided
    if (startPeriod) {
      url.searchParams.set("startPeriod", startPeriod);
    }
    if (endPeriod) {
      url.searchParams.set("endPeriod", endPeriod);
    }

    // Request SDMX-JSON format
    url.searchParams.set("format", "jsondata");
    url.searchParams.set("detail", "dataonly");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      // ECB returns 404 for no data, which is not necessarily an error
      if (response.status === 404) {
        return { dataSets: [] };
      }
      const text = await response.text();
      throw new ECBApiError(
        `ECB API error: ${response.status} ${response.statusText} - ${text}`,
        response.status,
        dataflow
      );
    }

    return response.json() as Promise<SDMXResponse>;
  }

  /**
   * Get series observations from ECB.
   *
   * @param dataflow - ECB dataflow ID (e.g., "MNA" for Main National Accounts, "ICP" for Inflation)
   * @param seriesKey - Series key within the dataflow
   * @param startPeriod - Start period in ECB format (e.g., "2014-01" for monthly, "2014" for annual)
   * @param endPeriod - End period (optional, defaults to latest available)
   */
  async getSeriesObservations(
    dataflow: string,
    seriesKey: string,
    startPeriod?: string,
    endPeriod?: string
  ): Promise<ECBObservation[]> {
    const response = await this.request(dataflow, seriesKey, startPeriod, endPeriod);

    if (!response.dataSets || response.dataSets.length === 0) {
      return [];
    }

    const observations: ECBObservation[] = [];
    
    // Get time dimension values for mapping observation indices to periods
    const timeDimension = response.structure?.dimensions?.observation?.find(
      (d) => d.id === "TIME_PERIOD"
    );
    const timeValues = timeDimension?.values ?? [];

    // Get frequency from series dimensions
    const freqDimension = response.structure?.dimensions?.series?.find(
      (d) => d.id === "FREQ"
    );
    const frequency = freqDimension?.values?.[0]?.id ?? "M";

    // Process each dataset (usually just one)
    for (const dataSet of response.dataSets) {
      if (!dataSet.series) continue;

      // Process each series in the dataset
      for (const seriesData of Object.values(dataSet.series)) {
        // Process observations
        for (const [obsIndex, obsValue] of Object.entries(seriesData.observations)) {
          const timeIndex = parseInt(obsIndex, 10);
          const timePeriod = timeValues[timeIndex]?.id;
          
          if (!timePeriod) continue;

          // obsValue is an array where first element is the value
          const value = obsValue[0];
          
          // Skip null/missing values
          if (value === null || value === undefined) continue;

          observations.push({
            date: periodToDate(timePeriod),
            value: value.toString(),
            period: formatPeriodDisplay(timePeriod, frequency),
          });
        }
      }
    }

    // Sort by date ascending
    observations.sort((a, b) => a.date.localeCompare(b.date));

    return observations;
  }

  /**
   * Get series metadata/info.
   */
  async getSeriesInfo(dataflow: string, seriesKey: string): Promise<ECBSeriesInfo> {
    // Make a minimal request to get structure info
    const currentYear = new Date().getFullYear().toString();
    const response = await this.request(dataflow, seriesKey, currentYear, currentYear);

    const freqDimension = response.structure?.dimensions?.series?.find(
      (d) => d.id === "FREQ"
    );
    const frequency = freqDimension?.values?.[0]?.id ?? "M";

    const title = response.structure?.name ?? `${dataflow} - ${seriesKey}`;

    return {
      seriesKey: `${dataflow}/${seriesKey}`,
      title,
      frequency,
    };
  }
}

/**
 * ECB series configuration.
 * Maps series to their dataflow and key for fetching.
 *
 * Key ECB dataflows:
 * - FM: Financial market data (interest rates)
 * - ICP: Harmonised Index of Consumer Prices (HICP)
 * - MNA: Main National Accounts (GDP)
 * - STS: Short-term Statistics
 * - BSI: Balance Sheet Items (monetary aggregates)
 *
 * Series key format varies by dataflow but generally:
 * FREQ.AREA.INDICATOR.OTHER_DIMENSIONS
 */
export const ECB_SERIES_CONFIG = {
  // ECB Main Refinancing Rate (key policy rate)
  "FM.D.U2.EUR.4F.KR.MRR_FR.LEV": {
    name: "ECB Main Refinancing Rate",
    dataflow: "FM",
    seriesKey: "D.U2.EUR.4F.KR.MRR_FR.LEV",
    category: "Interest Rates",
    countryCode: "EU",
    frequency: "Daily",
  },

  // ECB Deposit Facility Rate
  "FM.D.U2.EUR.4F.KR.DFR.LEV": {
    name: "ECB Deposit Facility Rate",
    dataflow: "FM",
    seriesKey: "D.U2.EUR.4F.KR.DFR.LEV",
    category: "Interest Rates",
    countryCode: "EU",
    frequency: "Daily",
  },

  // Eurozone HICP (Inflation) - All items
  "ICP.M.U2.N.000000.4.ANR": {
    name: "Eurozone HICP Inflation (YoY)",
    dataflow: "ICP",
    seriesKey: "M.U2.N.000000.4.ANR",
    category: "Inflation",
    countryCode: "EU",
    frequency: "Monthly",
  },

  // Eurozone Core HICP (Less energy, food, alcohol, tobacco)
  "ICP.M.U2.N.XEF000.4.ANR": {
    name: "Eurozone Core HICP Inflation (YoY)",
    dataflow: "ICP",
    seriesKey: "M.U2.N.XEF000.4.ANR",
    category: "Inflation",
    countryCode: "EU",
    frequency: "Monthly",
  },

  // Eurozone GDP Growth (chain-linked, seasonally adjusted)
  "MNA.Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY": {
    name: "Eurozone GDP Growth (QoQ)",
    dataflow: "MNA",
    seriesKey: "Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY",
    category: "GDP",
    countryCode: "EU",
    frequency: "Quarterly",
  },

  // Eurozone Unemployment Rate
  "STS.M.I9.S.UNEH.RTT000.4.000": {
    name: "Eurozone Unemployment Rate",
    dataflow: "STS",
    seriesKey: "M.I9.S.UNEH.RTT000.4.000",
    category: "Employment",
    countryCode: "EU",
    frequency: "Monthly",
  },

  // M3 Money Supply Growth (YoY)
  "BSI.M.U2.N.V.M30.X.I.U2.2300.Z01.A": {
    name: "Eurozone M3 Money Supply (YoY)",
    dataflow: "BSI",
    seriesKey: "M.U2.N.V.M30.X.I.U2.2300.Z01.A",
    category: "Monetary",
    countryCode: "EU",
    frequency: "Monthly",
  },

  // Germany HICP Inflation
  "ICP.M.DE.N.000000.4.ANR": {
    name: "Germany HICP Inflation (YoY)",
    dataflow: "ICP",
    seriesKey: "M.DE.N.000000.4.ANR",
    category: "Inflation",
    countryCode: "DE",
    frequency: "Monthly",
  },

  // France HICP Inflation
  "ICP.M.FR.N.000000.4.ANR": {
    name: "France HICP Inflation (YoY)",
    dataflow: "ICP",
    seriesKey: "M.FR.N.000000.4.ANR",
    category: "Inflation",
    countryCode: "FR",
    frequency: "Monthly",
  },

  // Italy HICP Inflation
  "ICP.M.IT.N.000000.4.ANR": {
    name: "Italy HICP Inflation (YoY)",
    dataflow: "ICP",
    seriesKey: "M.IT.N.000000.4.ANR",
    category: "Inflation",
    countryCode: "IT",
    frequency: "Monthly",
  },

  // Spain HICP Inflation
  "ICP.M.ES.N.000000.4.ANR": {
    name: "Spain HICP Inflation (YoY)",
    dataflow: "ICP",
    seriesKey: "M.ES.N.000000.4.ANR",
    category: "Inflation",
    countryCode: "ES",
    frequency: "Monthly",
  },
} as const;

export type ECBSeriesId = keyof typeof ECB_SERIES_CONFIG;
