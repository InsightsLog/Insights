/**
 * Tests for Data Validation and Deduplication Module
 *
 * Tests for T401.6: Add data validation and deduplication logic.
 */

import { describe, it, expect } from "vitest";
import {
  validateObservationValue,
  validateObservationDate,
  validateObservation,
  filterValidObservations,
  detectOutliers,
  createDeduplicationKey,
  deduplicateObservations,
  processObservations,
  fredObservationSchema,
} from "./validation";

describe("validateObservationValue", () => {
  it("should accept valid numeric values", () => {
    expect(validateObservationValue("123.45")).toEqual({ valid: true });
    expect(validateObservationValue("0")).toEqual({ valid: true });
    expect(validateObservationValue("-50.5")).toEqual({ valid: true });
    expect(validateObservationValue("1000000")).toEqual({ valid: true });
  });

  it("should reject missing values by default", () => {
    const result = validateObservationValue(".");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Missing");
  });

  it("should accept missing values when allowMissing is true", () => {
    const result = validateObservationValue(".", { allowMissing: true });
    expect(result.valid).toBe(true);
  });

  it("should reject non-numeric values", () => {
    const result = validateObservationValue("abc");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Invalid numeric");
  });

  it("should reject values below minimum", () => {
    const result = validateObservationValue("5", { minValue: 10 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("below minimum");
  });

  it("should reject values above maximum", () => {
    const result = validateObservationValue("100", { maxValue: 50 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("above maximum");
  });

  it("should accept values within range", () => {
    const result = validateObservationValue("30", { minValue: 10, maxValue: 50 });
    expect(result.valid).toBe(true);
  });
});

describe("validateObservationDate", () => {
  it("should accept valid YYYY-MM-DD dates", () => {
    expect(validateObservationDate("2024-01-15")).toEqual({ valid: true });
    expect(validateObservationDate("2000-12-31")).toEqual({ valid: true });
    expect(validateObservationDate("1990-01-01")).toEqual({ valid: true });
  });

  it("should reject invalid date formats", () => {
    const result1 = validateObservationDate("01-15-2024");
    expect(result1.valid).toBe(false);

    const result2 = validateObservationDate("2024/01/15");
    expect(result2.valid).toBe(false);

    const result3 = validateObservationDate("Jan 15, 2024");
    expect(result3.valid).toBe(false);
  });

  it("should reject future dates", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toISOString().split("T")[0];

    const result = validateObservationDate(futureDateStr);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Future date");
  });

  it("should reject invalid dates", () => {
    const result = validateObservationDate("2024-13-45");
    expect(result.valid).toBe(false);
  });
});

describe("validateObservation", () => {
  it("should validate complete observation", () => {
    const result = validateObservation({
      date: "2024-01-15",
      value: "123.45",
    });
    expect(result.valid).toBe(true);
  });

  it("should fail on invalid date", () => {
    const result = validateObservation({
      date: "invalid",
      value: "123.45",
    });
    expect(result.valid).toBe(false);
  });

  it("should fail on invalid value", () => {
    const result = validateObservation({
      date: "2024-01-15",
      value: "abc",
    });
    expect(result.valid).toBe(false);
  });
});

describe("filterValidObservations", () => {
  it("should filter out invalid observations", () => {
    const observations = [
      { date: "2024-01-01", value: "100" },
      { date: "2024-01-02", value: "." },
      { date: "2024-01-03", value: "200" },
      { date: "invalid", value: "300" },
    ];

    const { valid, skipped } = filterValidObservations(observations);

    expect(valid).toHaveLength(2);
    expect(skipped).toHaveLength(2);
    expect(skipped[0].reason).toContain("Missing");
    expect(skipped[1].reason).toContain("Invalid date");
  });

  it("should apply validation options", () => {
    const observations = [
      { date: "2024-01-01", value: "5" },
      { date: "2024-01-02", value: "15" },
      { date: "2024-01-03", value: "25" },
    ];

    const { valid, skipped } = filterValidObservations(observations, {
      minValue: 10,
      maxValue: 20,
    });

    expect(valid).toHaveLength(1);
    expect(valid[0].value).toBe("15");
    expect(skipped).toHaveLength(2);
  });
});

describe("detectOutliers", () => {
  it("should detect outliers based on standard deviation", () => {
    const observations = [
      { date: "2024-01-01", value: "100" },
      { date: "2024-01-02", value: "102" },
      { date: "2024-01-03", value: "98" },
      { date: "2024-01-04", value: "101" },
      { date: "2024-01-05", value: "99" },
      { date: "2024-01-06", value: "1000" }, // Outlier
    ];

    const { normal, outliers } = detectOutliers(observations, 2);

    expect(outliers).toHaveLength(1);
    expect(outliers[0].observation.value).toBe("1000");
    expect(normal).toHaveLength(5);
  });

  it("should handle empty array", () => {
    const { normal, outliers } = detectOutliers([]);
    expect(normal).toHaveLength(0);
    expect(outliers).toHaveLength(0);
  });

  it("should handle constant values", () => {
    const observations = [
      { date: "2024-01-01", value: "100" },
      { date: "2024-01-02", value: "100" },
      { date: "2024-01-03", value: "100" },
    ];

    const { normal, outliers } = detectOutliers(observations);
    expect(normal).toHaveLength(3);
    expect(outliers).toHaveLength(0);
  });
});

describe("createDeduplicationKey", () => {
  it("should create consistent keys", () => {
    const key1 = createDeduplicationKey("uuid-1", "2024-01-01T00:00:00Z", "Jan 2024");
    const key2 = createDeduplicationKey("uuid-1", "2024-01-01T00:00:00Z", "Jan 2024");
    expect(key1).toBe(key2);
  });

  it("should create unique keys for different inputs", () => {
    const key1 = createDeduplicationKey("uuid-1", "2024-01-01T00:00:00Z", "Jan 2024");
    const key2 = createDeduplicationKey("uuid-2", "2024-01-01T00:00:00Z", "Jan 2024");
    const key3 = createDeduplicationKey("uuid-1", "2024-02-01T00:00:00Z", "Jan 2024");
    const key4 = createDeduplicationKey("uuid-1", "2024-01-01T00:00:00Z", "Feb 2024");

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).not.toBe(key4);
  });
});

describe("deduplicateObservations", () => {
  it("should remove duplicates keeping last occurrence", () => {
    const observations = [
      { id: 1, key: "a" },
      { id: 2, key: "b" },
      { id: 3, key: "a" }, // Duplicate of first
      { id: 4, key: "c" },
    ];

    const { unique, duplicateCount } = deduplicateObservations(observations, (obs) => obs.key);

    expect(duplicateCount).toBe(1);
    expect(unique).toHaveLength(3);
    // Last occurrence of "a" should be kept (id: 3)
    expect(unique.find((o) => o.key === "a")?.id).toBe(3);
  });

  it("should handle empty array", () => {
    const { unique, duplicateCount } = deduplicateObservations([], (obs: { key: string }) => obs.key);
    expect(unique).toHaveLength(0);
    expect(duplicateCount).toBe(0);
  });

  it("should handle array with no duplicates", () => {
    const observations = [
      { id: 1, key: "a" },
      { id: 2, key: "b" },
      { id: 3, key: "c" },
    ];

    const { unique, duplicateCount } = deduplicateObservations(observations, (obs) => obs.key);

    expect(duplicateCount).toBe(0);
    expect(unique).toHaveLength(3);
  });
});

describe("processObservations", () => {
  it("should process observations with full pipeline", () => {
    const observations = [
      { date: "2024-01-01", value: "100", indicatorId: "a" },
      { date: "2024-01-02", value: ".", indicatorId: "a" }, // Missing
      { date: "2024-01-03", value: "102", indicatorId: "a" },
      { date: "invalid", value: "104", indicatorId: "a" }, // Invalid date
    ];

    const { observations: result, stats } = processObservations(observations);

    expect(result).toHaveLength(2);
    expect(stats.totalReceived).toBe(4);
    expect(stats.validCount).toBe(2);
    expect(stats.skippedCount).toBe(2);
    expect(stats.skippedReasons["Missing value"]).toBe(1);
  });

  it("should deduplicate when key function provided", () => {
    const observations = [
      { date: "2024-01-01", value: "100" },
      { date: "2024-01-01", value: "101" }, // Same date, different value
      { date: "2024-01-02", value: "102" },
    ];

    const { observations: result, stats } = processObservations(
      observations,
      {},
      (obs) => obs.date
    );

    expect(result).toHaveLength(2);
    expect(stats.duplicateCount).toBe(1);
  });

  it("should detect outliers when configured", () => {
    const observations = [
      { date: "2024-01-01", value: "100" },
      { date: "2024-01-02", value: "102" },
      { date: "2024-01-03", value: "98" },
      { date: "2024-01-04", value: "101" },
      { date: "2024-01-05", value: "99" },
      { date: "2024-01-06", value: "10000" }, // Extreme outlier
    ];

    const { observations: result, stats } = processObservations(
      observations,
      { outlierStdDevs: 2 }
    );

    expect(result).toHaveLength(5);
    expect(stats.outlierCount).toBe(1);
  });
});

describe("fredObservationSchema", () => {
  it("should validate correct FRED observations", () => {
    const result = fredObservationSchema.safeParse({
      date: "2024-01-15",
      value: "123.45",
    });
    expect(result.success).toBe(true);
  });

  it("should allow missing value indicator", () => {
    const result = fredObservationSchema.safeParse({
      date: "2024-01-15",
      value: ".",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid date format", () => {
    const result = fredObservationSchema.safeParse({
      date: "01/15/2024",
      value: "123.45",
    });
    expect(result.success).toBe(false);
  });
});
