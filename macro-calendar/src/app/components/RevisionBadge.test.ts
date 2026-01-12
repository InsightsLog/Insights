import { describe, it, expect } from "vitest";
import type { RevisionRecord } from "./RevisionHistory";
import { getLatestRevision } from "./RevisionBadge";

describe("RevisionBadge", () => {
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

  describe("getLatestRevision", () => {
    it("returns null for empty array", () => {
      expect(getLatestRevision([])).toBeNull();
    });

    it("returns null for null-ish input", () => {
      // Cast to test defensive coding
      expect(getLatestRevision(null as unknown as RevisionRecord[])).toBeNull();
      expect(getLatestRevision(undefined as unknown as RevisionRecord[])).toBeNull();
    });

    it("returns the only item for single-item array", () => {
      const single: RevisionRecord[] = [mockRevisions[0]];
      const result = getLatestRevision(single);
      expect(result).toEqual(mockRevisions[0]);
    });

    it("returns the revision with latest revised_at timestamp", () => {
      const result = getLatestRevision(mockRevisions);
      expect(result).toEqual(mockRevisions[1]); // 2026-01-11 is later than 2026-01-10
    });

    it("handles revisions in reverse chronological order", () => {
      const reversed: RevisionRecord[] = [
        {
          previous_actual: "3.7",
          new_actual: "3.6",
          revised_at: "2026-01-11T09:15:00Z", // newer first
        },
        {
          previous_actual: "3.5",
          new_actual: "3.7",
          revised_at: "2026-01-10T14:30:00Z", // older second
        },
      ];

      const result = getLatestRevision(reversed);
      expect(result?.revised_at).toBe("2026-01-11T09:15:00Z");
    });

    it("handles same-day revisions correctly", () => {
      const sameDayRevisions: RevisionRecord[] = [
        {
          previous_actual: "3.5",
          new_actual: "3.6",
          revised_at: "2026-01-10T08:00:00Z", // 8am
        },
        {
          previous_actual: "3.6",
          new_actual: "3.7",
          revised_at: "2026-01-10T16:00:00Z", // 4pm
        },
        {
          previous_actual: "3.7",
          new_actual: "3.8",
          revised_at: "2026-01-10T20:00:00Z", // 8pm - should be latest
        },
      ];

      const result = getLatestRevision(sameDayRevisions);
      expect(result?.revised_at).toBe("2026-01-10T20:00:00Z");
      expect(result?.new_actual).toBe("3.8");
    });

    it("handles multiple revisions across different years", () => {
      const multiYearRevisions: RevisionRecord[] = [
        {
          previous_actual: "2.0",
          new_actual: "2.1",
          revised_at: "2024-06-15T10:00:00Z",
        },
        {
          previous_actual: "2.1",
          new_actual: "2.5",
          revised_at: "2025-03-20T12:00:00Z",
        },
        {
          previous_actual: "2.5",
          new_actual: "2.8",
          revised_at: "2026-01-05T08:00:00Z", // Most recent
        },
      ];

      const result = getLatestRevision(multiYearRevisions);
      expect(result?.revised_at).toBe("2026-01-05T08:00:00Z");
    });

    it("does not mutate the original array", () => {
      const original = [...mockRevisions];
      getLatestRevision(mockRevisions);
      expect(mockRevisions).toEqual(original);
    });
  });

  describe("RevisionBadge component behavior", () => {
    // Note: Full component rendering tests would require a React testing library
    // Here we test the logic functions that the component depends on

    it("getLatestRevision provides correct data for tooltip display", () => {
      const revisions: RevisionRecord[] = [
        {
          previous_actual: "100",
          new_actual: "105",
          revised_at: "2026-01-15T12:00:00Z",
        },
      ];

      const latest = getLatestRevision(revisions);
      
      // Verify the latest revision has all fields needed for tooltip
      expect(latest).not.toBeNull();
      expect(latest?.previous_actual).toBe("100");
      expect(latest?.new_actual).toBe("105");
      expect(latest?.revised_at).toBeDefined();
    });

    it("getLatestRevision handles negative values correctly", () => {
      const revisions: RevisionRecord[] = [
        {
          previous_actual: "-0.5",
          new_actual: "0.2",
          revised_at: "2026-01-10T14:30:00Z",
        },
      ];

      const latest = getLatestRevision(revisions);
      expect(latest?.previous_actual).toBe("-0.5");
      expect(latest?.new_actual).toBe("0.2");
    });

    it("getLatestRevision handles large values correctly", () => {
      const revisions: RevisionRecord[] = [
        {
          previous_actual: "1,234,567",
          new_actual: "1,234,890",
          revised_at: "2026-01-10T14:30:00Z",
        },
      ];

      const latest = getLatestRevision(revisions);
      expect(latest?.previous_actual).toBe("1,234,567");
      expect(latest?.new_actual).toBe("1,234,890");
    });
  });
});
