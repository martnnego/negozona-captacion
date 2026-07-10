export function parseCSV(text) {
  if (!text) return [];

  // Detect delimiter: count commas vs semicolons in the first line
  const firstLine = text.split(/\r?\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const lines = [];
  let row = [""];
  lines.push(row);
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      row.push("");
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++; // skip LF
      }
      row = [""];
      lines.push(row);
    } else {
      row[row.length - 1] += c;
    }
  }

  // Filter out completely empty lines and trim whitespace from fields
  return lines
    .map(r => r.map(val => val.trim()))
    .filter(r => r.length > 1 || r[0] !== "");
}
