/**
 * CSV Parser Module
 * Handles parsing CSV text into arrays of objects.
 * Supports quoted fields, escaped quotes, and various CSV edge cases.
 */

/**
 * Parse a single CSV line, handling quoted fields.
 * Handles:
 * - Quoted fields containing commas
 * - Escaped quotes (doubled quotes within quoted fields)
 * - Mixed quoted and unquoted fields
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ",") {
        // Field separator
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  // Push last field
  result.push(current);

  return result;
}

/**
 * Parse CSV text into array of objects.
 * Uses first row as headers.
 * Handles:
 * - Windows (\r\n) and Unix (\n) line endings
 * - Empty lines (skipped)
 * - Quoted fields
 * - Escaped quotes
 */
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j].trim();
      const value = values[j]?.trim() ?? "";
      if (header) {
        row[header] = value;
      }
    }

    rows.push(row);
  }

  return rows;
}
