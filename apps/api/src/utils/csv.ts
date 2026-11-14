/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes (""), commas and newlines
 * inside quotes, CRLF or LF line endings. Yields one record per row as string arrays.
 */
export function* parseCsv(text: string): Generator<string[]> {
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let fieldStarted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
      fieldStarted = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      record.push(field);
      if (record.length > 1 || record[0] !== '') {
        yield record;
      }
      record = [];
      field = '';
      fieldStarted = false;
    } else {
      field += char;
      fieldStarted = true;
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    yield record;
  }
}

/** Parses CSV with a header row into objects keyed by lower-cased, trimmed header names. */
export function* parseCsvWithHeader(text: string): Generator<Record<string, string>> {
  const rows = parseCsv(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  const first = rows.next();
  if (first.done === true) {
    return;
  }
  const header = first.value.map((name) => name.trim().toLowerCase());
  for (const row of rows) {
    const record: Record<string, string> = {};
    header.forEach((name, index) => {
      record[name] = (row[index] ?? '').trim();
    });
    yield record;
  }
}
