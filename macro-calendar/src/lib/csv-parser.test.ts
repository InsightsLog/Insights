import { describe, it, expect } from "vitest";
import { parseCSV, parseCSVLine } from "@/lib/csv-parser";

describe("parseCSVLine", () => {
  it("parses simple unquoted fields", () => {
    const result = parseCSVLine("a,b,c");
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields", () => {
    const result = parseCSVLine('"hello","world"');
    expect(result).toEqual(["hello", "world"]);
  });

  it("handles quoted fields containing commas", () => {
    const result = parseCSVLine('"hello, world",test');
    expect(result).toEqual(["hello, world", "test"]);
  });

  it("handles escaped quotes (doubled quotes)", () => {
    const result = parseCSVLine('"She said ""hello""",other');
    expect(result).toEqual(['She said "hello"', "other"]);
  });

  it("handles empty fields", () => {
    const result = parseCSVLine("a,,c");
    expect(result).toEqual(["a", "", "c"]);
  });

  it("handles empty quoted fields", () => {
    const result = parseCSVLine('"",b,""');
    expect(result).toEqual(["", "b", ""]);
  });

  it("handles mixed quoted and unquoted fields", () => {
    const result = parseCSVLine('plain,"quoted",another,"with,comma"');
    expect(result).toEqual(["plain", "quoted", "another", "with,comma"]);
  });

  it("handles trailing empty field", () => {
    const result = parseCSVLine("a,b,");
    expect(result).toEqual(["a", "b", ""]);
  });

  it("handles leading empty field", () => {
    const result = parseCSVLine(",b,c");
    expect(result).toEqual(["", "b", "c"]);
  });

  it("handles single field", () => {
    const result = parseCSVLine("single");
    expect(result).toEqual(["single"]);
  });

  it("handles empty string", () => {
    const result = parseCSVLine("");
    expect(result).toEqual([""]);
  });

  it("handles complex escaped quotes", () => {
    const result = parseCSVLine('"""quoted"""');
    expect(result).toEqual(['"quoted"']);
  });

  it("handles only escaped quotes", () => {
    const result = parseCSVLine('""""');
    expect(result).toEqual(['"']);
  });
});

describe("parseCSV", () => {
  it("parses simple CSV with headers", () => {
    const csv = "name,value\nalice,100\nbob,200";
    const result = parseCSV(csv);
    expect(result).toEqual([
      { name: "alice", value: "100" },
      { name: "bob", value: "200" },
    ]);
  });

  it("returns empty array for header-only CSV", () => {
    const csv = "name,value";
    const result = parseCSV(csv);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    const csv = "";
    const result = parseCSV(csv);
    expect(result).toEqual([]);
  });

  it("returns empty array for single line (no data rows)", () => {
    const csv = "header1,header2";
    const result = parseCSV(csv);
    expect(result).toEqual([]);
  });

  it("handles quoted fields in data rows", () => {
    const csv = 'name,description\n"Test","Has, comma"';
    const result = parseCSV(csv);
    expect(result).toEqual([{ name: "Test", description: "Has, comma" }]);
  });

  it("handles escaped quotes in data rows", () => {
    const csv = 'name,quote\nPerson,"He said ""hello"""';
    const result = parseCSV(csv);
    expect(result).toEqual([{ name: "Person", quote: 'He said "hello"' }]);
  });

  it("handles empty fields in data rows", () => {
    const csv = "a,b,c\n1,,3\n,5,";
    const result = parseCSV(csv);
    expect(result).toEqual([
      { a: "1", b: "", c: "3" },
      { a: "", b: "5", c: "" },
    ]);
  });

  it("handles Windows line endings (CRLF)", () => {
    const csv = "name,value\r\nalice,100\r\nbob,200";
    const result = parseCSV(csv);
    expect(result).toEqual([
      { name: "alice", value: "100" },
      { name: "bob", value: "200" },
    ]);
  });

  it("handles Unix line endings (LF)", () => {
    const csv = "name,value\nalice,100\nbob,200";
    const result = parseCSV(csv);
    expect(result).toEqual([
      { name: "alice", value: "100" },
      { name: "bob", value: "200" },
    ]);
  });

  it("skips empty lines", () => {
    const csv = "name,value\n\nalice,100\n\nbob,200\n";
    const result = parseCSV(csv);
    expect(result).toEqual([
      { name: "alice", value: "100" },
      { name: "bob", value: "200" },
    ]);
  });

  it("trims whitespace from headers and values", () => {
    const csv = " name , value \n alice , 100 ";
    const result = parseCSV(csv);
    expect(result).toEqual([{ name: "alice", value: "100" }]);
  });

  it("handles rows with fewer values than headers", () => {
    const csv = "a,b,c\n1";
    const result = parseCSV(csv);
    expect(result).toEqual([{ a: "1", b: "", c: "" }]);
  });

  it("handles rows with more values than headers (extra ignored)", () => {
    const csv = "a,b\n1,2,3,4";
    const result = parseCSV(csv);
    // Extra values have no header key, so they're ignored
    expect(result).toEqual([{ a: "1", b: "2" }]);
  });

  it("ignores empty header names", () => {
    const csv = "a,,c\n1,2,3";
    const result = parseCSV(csv);
    // Empty header column is skipped
    expect(result).toEqual([{ a: "1", c: "3" }]);
  });

  it("handles realistic CSV data (indicator upload format)", () => {
    const csv = `indicator_name,country_code,category,source_name,source_url,release_at,period,actual,forecast
"CPI (YoY)",US,Inflation,"Bureau of Labor Statistics",https://bls.gov,2024-01-15T08:30:00Z,Dec 2023,3.4%,3.2%
"GDP Growth",US,Growth,BEA,https://bea.gov,2024-01-25T08:30:00Z,Q4 2023,,2.5%`;
    const result = parseCSV(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      indicator_name: "CPI (YoY)",
      country_code: "US",
      category: "Inflation",
      source_name: "Bureau of Labor Statistics",
      source_url: "https://bls.gov",
      release_at: "2024-01-15T08:30:00Z",
      period: "Dec 2023",
      actual: "3.4%",
      forecast: "3.2%",
    });
    expect(result[1]).toEqual({
      indicator_name: "GDP Growth",
      country_code: "US",
      category: "Growth",
      source_name: "BEA",
      source_url: "https://bea.gov",
      release_at: "2024-01-25T08:30:00Z",
      period: "Q4 2023",
      actual: "",
      forecast: "2.5%",
    });
  });

  it("handles malformed row with unclosed quote gracefully", () => {
    // When a quote is unclosed, it consumes rest of line
    const csv = 'name,value\n"unclosed,rest';
    const result = parseCSV(csv);
    // The parser will consume everything after the unclosed quote
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("unclosed,rest");
  });

  it("handles whitespace-only lines", () => {
    const csv = "name,value\n   \nalice,100";
    const result = parseCSV(csv);
    expect(result).toEqual([{ name: "alice", value: "100" }]);
  });
});
