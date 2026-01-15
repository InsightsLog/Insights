/**
 * Data Validation and Deduplication Module
 *
 * Provides validation and deduplication logic for historical data imports.
 * Part of T401.6: Add data validation and deduplication logic.
 *
 * Features:
 * - Numeric range validation with configurable min/max
 * - Outlier detection using standard deviation
 * - Deduplication by (indicator_id, release_at, period) key
 * - Missing/invalid value handling
 */

import { z } from "zod";

/**
 * Validation result for a single observation.
 */
export type ValidationResult = {
  valid: boolean;
  reason?: string;
};

/**
 * Observation data for validation.
 */
export interface ObservationData {
  date: string;
  value: string;
  indicatorId?: string;
  period?: string;
}

/**
 * Validation options for import data.
 */
export interface ValidationOptions {
  /** Allow missing/null values (default: false) */
  allowMissing?: boolean;
  /** Minimum allowed numeric value (optional) */
  minValue?: number;
  /** Maximum allowed numeric value (optional) */
  maxValue?: number;
  /** Number of standard deviations for outlier detection (default: disabled) */
  outlierStdDevs?: number;
}

/**
 * Zod schema for FRED observation date validation.
 * FRED dates are in YYYY-MM-DD format.
 */
const fredDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Date must be in YYYY-MM-DD format"
);

/**
 * Zod schema for FRED observation value validation.
 * Values are numeric strings, or "." for missing data.
 */
const fredValueSchema = z.string().refine(
  (val) => val === "." || !isNaN(parseFloat(val)),
  "Value must be a number or '.' for missing data"
);

/**
 * Zod schema for a complete FRED observation.
 */
export const fredObservationSchema = z.object({
  date: fredDateSchema,
  value: fredValueSchema,
});

/**
 * Validates a single observation value.
 *
 * @param value - The observation value string
 * @param options - Validation options
 * @returns Validation result with valid flag and optional reason
 */
export function validateObservationValue(
  value: string,
  options: ValidationOptions = {}
): ValidationResult {
  const {
    allowMissing = false,
    minValue,
    maxValue,
  } = options;

  // Check for missing values (FRED uses "." for missing)
  if (value === "." || value.trim() === "") {
    if (allowMissing) {
      return { valid: true };
    }
    return { valid: false, reason: "Missing value" };
  }

  // Parse numeric value
  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return { valid: false, reason: `Invalid numeric value: ${value}` };
  }

  // Check min/max bounds
  if (minValue !== undefined && numValue < minValue) {
    return { valid: false, reason: `Value ${numValue} below minimum ${minValue}` };
  }
  if (maxValue !== undefined && numValue > maxValue) {
    return { valid: false, reason: `Value ${numValue} above maximum ${maxValue}` };
  }

  return { valid: true };
}

/**
 * Validates an observation date.
 *
 * @param date - The date string to validate
 * @returns Validation result with valid flag and optional reason
 */
export function validateObservationDate(date: string): ValidationResult {
  const result = fredDateSchema.safeParse(date);
  if (!result.success) {
    return { valid: false, reason: `Invalid date format: ${date}` };
  }

  // Also verify it's a valid date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return { valid: false, reason: `Invalid date: ${date}` };
  }

  // Check for future dates (data shouldn't be from the future)
  const now = new Date();
  if (parsed > now) {
    return { valid: false, reason: `Future date not allowed: ${date}` };
  }

  return { valid: true };
}

/**
 * Validates a complete observation (date + value).
 *
 * @param observation - The observation to validate
 * @param options - Validation options
 * @returns Validation result with valid flag and optional reason
 */
export function validateObservation(
  observation: ObservationData,
  options: ValidationOptions = {}
): ValidationResult {
  // Validate date
  const dateResult = validateObservationDate(observation.date);
  if (!dateResult.valid) {
    return dateResult;
  }

  // Validate value
  const valueResult = validateObservationValue(observation.value, options);
  if (!valueResult.valid) {
    return valueResult;
  }

  return { valid: true };
}

/**
 * Filters and validates an array of observations.
 * Returns valid observations and a list of skipped observations with reasons.
 *
 * @param observations - Array of observations to validate
 * @param options - Validation options
 * @returns Object containing valid observations and skipped observations
 */
export function filterValidObservations<T extends ObservationData>(
  observations: T[],
  options: ValidationOptions = {}
): {
  valid: T[];
  skipped: Array<{ observation: T; reason: string }>;
} {
  const valid: T[] = [];
  const skipped: Array<{ observation: T; reason: string }> = [];

  for (const obs of observations) {
    const result = validateObservation(obs, options);
    if (result.valid) {
      valid.push(obs);
    } else {
      skipped.push({ observation: obs, reason: result.reason ?? "Unknown validation error" });
    }
  }

  return { valid, skipped };
}

/**
 * Detects outliers in numeric observation values using standard deviation.
 *
 * @param observations - Array of observations with numeric values
 * @param stdDevs - Number of standard deviations from mean to consider outlier (default: 3)
 * @returns Object containing normal and outlier observations
 */
export function detectOutliers<T extends ObservationData>(
  observations: T[],
  stdDevs: number = 3
): {
  normal: T[];
  outliers: Array<{ observation: T; deviation: number }>;
} {
  // Filter to only numeric values
  const numericObs = observations.filter(
    (obs) => obs.value !== "." && !isNaN(parseFloat(obs.value))
  );

  if (numericObs.length === 0) {
    return { normal: [], outliers: [] };
  }

  // Calculate mean
  const values = numericObs.map((obs) => parseFloat(obs.value));
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

  // Calculate standard deviation
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Avoid division by zero for constant values
  if (stdDev === 0) {
    return { normal: numericObs, outliers: [] };
  }

  const normal: T[] = [];
  const outliers: Array<{ observation: T; deviation: number }> = [];

  for (const obs of numericObs) {
    const value = parseFloat(obs.value);
    const deviation = Math.abs(value - mean) / stdDev;

    if (deviation > stdDevs) {
      outliers.push({ observation: obs, deviation });
    } else {
      normal.push(obs);
    }
  }

  return { normal, outliers };
}

/**
 * Creates a unique key for deduplication.
 * Uses (indicator_id, release_at, period) as the composite key.
 *
 * @param indicatorId - The indicator UUID
 * @param releaseAt - The release timestamp
 * @param period - The period string (e.g., "Q1 2024", "Jan 2024")
 * @returns A unique string key for the observation
 */
export function createDeduplicationKey(
  indicatorId: string,
  releaseAt: string,
  period: string
): string {
  return `${indicatorId}|${releaseAt}|${period}`;
}

/**
 * Deduplicates observations by their unique key.
 * When duplicates exist, keeps the last occurrence (most recent).
 *
 * @param observations - Array of observations with indicator/release info
 * @param getKey - Function to extract the deduplication key
 * @returns Object containing unique observations and duplicate count
 */
export function deduplicateObservations<T>(
  observations: T[],
  getKey: (obs: T) => string
): {
  unique: T[];
  duplicateCount: number;
} {
  const seen = new Map<string, T>();
  let duplicateCount = 0;

  for (const obs of observations) {
    const key = getKey(obs);
    if (seen.has(key)) {
      duplicateCount++;
    }
    seen.set(key, obs); // Last occurrence wins
  }

  return {
    unique: Array.from(seen.values()),
    duplicateCount,
  };
}

/**
 * Validation statistics for a batch of observations.
 */
export interface ValidationStats {
  totalReceived: number;
  validCount: number;
  skippedCount: number;
  duplicateCount: number;
  outlierCount: number;
  skippedReasons: Record<string, number>;
}

/**
 * Validates and deduplicates a batch of observations.
 * This is the main entry point for data validation in import scripts.
 *
 * @param observations - Array of observations to process
 * @param options - Validation options
 * @param getKey - Optional function to extract deduplication key
 * @returns Processed observations and statistics
 */
export function processObservations<T extends ObservationData>(
  observations: T[],
  options: ValidationOptions = {},
  getKey?: (obs: T) => string
): {
  observations: T[];
  stats: ValidationStats;
} {
  const stats: ValidationStats = {
    totalReceived: observations.length,
    validCount: 0,
    skippedCount: 0,
    duplicateCount: 0,
    outlierCount: 0,
    skippedReasons: {},
  };

  // Step 1: Filter valid observations
  const { valid, skipped } = filterValidObservations(observations, options);
  stats.skippedCount = skipped.length;

  // Track skip reasons
  for (const { reason } of skipped) {
    stats.skippedReasons[reason] = (stats.skippedReasons[reason] ?? 0) + 1;
  }

  // Step 2: Detect outliers if configured (outliers are additional skipped items)
  let processedObs = valid;
  if (options.outlierStdDevs !== undefined) {
    const { normal, outliers } = detectOutliers(valid, options.outlierStdDevs);
    processedObs = normal;
    stats.outlierCount = outliers.length;
    // Outliers are counted separately from initial validation skips
    stats.skippedCount += outliers.length;
    if (outliers.length > 0) {
      // Add to existing outlier count if any (for batch processing)
      stats.skippedReasons["Outlier value"] = 
        (stats.skippedReasons["Outlier value"] ?? 0) + outliers.length;
    }
  }

  // Step 3: Deduplicate if key function provided
  if (getKey) {
    const { unique, duplicateCount } = deduplicateObservations(processedObs, getKey);
    processedObs = unique;
    stats.duplicateCount = duplicateCount;
  }

  stats.validCount = processedObs.length;

  return { observations: processedObs, stats };
}
