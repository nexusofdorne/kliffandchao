// Minimal RFC 4180 parser: quoted fields, embedded commas, "" as an escaped
// quote. Good enough for the small, hand-maintained CSVs this project reads
// (the guest list sync in a later phase, the seed data here) — not meant to
// replace a real CSV library for arbitrary/untrusted input.
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];

  const [header, ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])));
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
