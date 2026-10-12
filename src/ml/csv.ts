/**
 * Minimal RFC-4180 CSV reader/writer (quoted fields, escaped quotes, CRLF).
 */
export type RawRow = Record<string, string>;

export function parseCsvRecords(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

/** Parses CSV text into objects keyed by snake_cased header names. */
export function parseCsv(text: string): RawRow[] {
  const records = parseCsvRecords(text);
  if (records.length === 0) return [];
  const header = records[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: RawRow[] = [];
  for (let r = 1; r < records.length; r++) {
    const record = records[r];
    if (record.length === 1 && record[0].trim() === "") continue;
    const row: RawRow = {};
    header.forEach((name, j) => {
      row[name] = record[j] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows: Record<string, unknown>[], columns: readonly string[]): string {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => escape(row[c])).join(","));
  return lines.join("\n") + "\n";
}
