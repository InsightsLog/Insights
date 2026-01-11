import { describe, it, expect } from "vitest";
import {
  RevisionRecord,
  formatRevisionDate,
  sortRevisions,
  getRevisionCountText,
} from "./RevisionHistory";

describe("RevisionHistory", () => {
  const mockRevisions: RevisionRecord[] = [
    {
      previous_actual: "3.5",
      new_actual: "3.7",
      revised_at: "2026-01-10T14:30:00Z",
    },
    {
      previous_actual: "3.7",
      new_actual: "3.6",
      revised_at: "2026-01-11T09:15:00Z",
    },
  ];

  describe("formatRevisionDate", () => {
    it("formats ISO date string to readable format", () => {
      const result = formatRevisionDate("2026-01-10T14:30:00Z");
      // Verify it includes key parts (exact format depends on locale)
      expect(result).toContain("2026");
      expect(result).toContain("Jan");
      expect(result).toContain("10");
    });

    it("handles midnight time correctly", () => {
      const result = formatRevisionDate("2026-01-01T00:00:00Z");
      expect(result).toContain("2026");
      expect(result).toContain("Jan");
      expect(result).toContain("1");
    });

    it("formats different months correctly", () => {
      const result = formatRevisionDate("2026-12-25T08:00:00Z");
      expect(result).toContain("Dec");
      expect(result).toContain("25");
    });
  });

  describe("sortRevisions", () => {
    it("returns empty array for empty input", () => {
      expect(sortRevisions([])).toEqual([]);
    });

    it("returns empty array for null-ish input", () => {
      // Cast to test defensive coding
      expect(sortRevisions(null as unknown as RevisionRecord[])).toEqual([]);
      expect(sortRevisions(undefined as unknown as RevisionRecord[])).toEqual([]);
    });

    it("returns single item array unchanged", () => {
      const single: RevisionRecord[] = [mockRevisions[0]];
      const result = sortRevisions(single);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockRevisions[0]);
    });

    it("sorts revisions chronologically (oldest first)", () => {
      const unordered: RevisionRecord[] = [
        {
          previous_actual: "3.7",
          new_actual: "3.6",
          revised_at: "2026-01-11T09:15:00Z", // newer
        },
        {
          previous_actual: "3.5",
          new_actual: "3.7",
          revised_at: "2026-01-10T14:30:00Z", // older
        },
      ];

      const result = sortRevisions(unordered);

      expect(result[0].revised_at).toBe("2026-01-10T14:30:00Z");
      expect(result[1].revised_at).toBe("2026-01-11T09:15:00Z");
    });

    it("maintains order for already sorted revisions", () => {
      const result = sortRevisions(mockRevisions);

      expect(result[0].revised_at).toBe("2026-01-10T14:30:00Z");
      expect(result[1].revised_at).toBe("2026-01-11T09:15:00Z");
    });

    it("does not mutate the original array", () => {
      const original = [...mockRevisions];
      const originalFirst = mockRevisions[0];

      sortRevisions(mockRevisions);

      expect(mockRevisions[0]).toBe(originalFirst);
      expect(mockRevisions).toEqual(original);
    });

    it("handles same-day revisions correctly", () => {
      const sameDayRevisions: RevisionRecord[] = [
        {
          previous_actual: "3.6",
          new_actual: "3.7",
          revised_at: "2026-01-10T16:00:00Z", // 4pm
        },
        {
          previous_actual: "3.5",
          new_actual: "3.6",
          revised_at: "2026-01-10T08:00:00Z", // 8am
        },
        {
          previous_actual: "3.7",
          new_actual: "3.8",
          revised_at: "2026-01-10T20:00:00Z", // 8pm
        },
      ];

      const result = sortRevisions(sameDayRevisions);

      expect(result[0].revised_at).toBe("2026-01-10T08:00:00Z");
      expect(result[1].revised_at).toBe("2026-01-10T16:00:00Z");
      expect(result[2].revised_at).toBe("2026-01-10T20:00:00Z");
    });
  });

  describe("getRevisionCountText", () => {
    it("returns singular form for count of 1", () => {
      expect(getRevisionCountText(1)).toBe("1 revision recorded");
    });

    it("returns plural form for count of 0", () => {
      expect(getRevisionCountText(0)).toBe("0 revisions recorded");
    });

    it("returns plural form for count greater than 1", () => {
      expect(getRevisionCountText(2)).toBe("2 revisions recorded");
      expect(getRevisionCountText(5)).toBe("5 revisions recorded");
      expect(getRevisionCountText(100)).toBe("100 revisions recorded");
    });
  });

  describe("RevisionRecord type", () => {
    it("has correct shape", () => {
      const record: RevisionRecord = {
        previous_actual: "3.5",
        new_actual: "3.7",
        revised_at: "2026-01-10T14:30:00Z",
      };

      expect(record.previous_actual).toBe("3.5");
      expect(record.new_actual).toBe("3.7");
      expect(record.revised_at).toBe("2026-01-10T14:30:00Z");
    });

    it("allows string values for actuals", () => {
      // Test various actual value formats
      const numericRecord: RevisionRecord = {
        previous_actual: "3.5",
        new_actual: "3.7",
        revised_at: "2026-01-10T14:30:00Z",
      };
      expect(numericRecord.previous_actual).toBe("3.5");

      const percentRecord: RevisionRecord = {
        previous_actual: "-0.5",
        new_actual: "0.2",
        revised_at: "2026-01-10T14:30:00Z",
      };
      expect(percentRecord.previous_actual).toBe("-0.5");

      const largeRecord: RevisionRecord = {
        previous_actual: "1,234.5",
        new_actual: "1,345.6",
        revised_at: "2026-01-10T14:30:00Z",
      };
      expect(largeRecord.previous_actual).toBe("1,234.5");
    });
  });
});
