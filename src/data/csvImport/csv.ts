export interface CsvRow {
  row: number;
  values: string[];
}

/** A quoted record can span physical lines; errors retain its starting line. */
function* tokenizeChunks(text: string, separator: string): Generator<void, CsvRow[]> {
  const rows: CsvRow[] = [];
  let values: string[] = [],
    field = '',
    quoted = false,
    closed = false;
  let line = 1,
    start = 1;
  const push = () => {
    values.push(field);
    if (values.some((value) => value.trim())) rows.push({ row: start, values });
    values = [];
    field = '';
    closed = false;
    start = line + 1;
  };
  for (let i = 0; i < text.length; i++) {
    if (i && i % 32768 === 0) yield;
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        field += char;
        if (char === '\n') line++;
      }
    } else if (char === '"') {
      if (field || closed) throw new Error(`Row ${start}: unexpected quote.`);
      quoted = true;
    } else if (char === separator) {
      values.push(field);
      field = '';
      closed = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      push();
      line++;
    } else {
      if (closed && char.trim()) throw new Error(`Row ${start}: text after a closing quote.`);
      if (!closed) field += char;
    }
  }
  if (quoted) throw new Error(`Row ${start}: quoted field is not closed.`);
  if (field || values.length) push();
  return rows;
}
export function tokenizeCsv(text: string, separator: string): CsvRow[] {
  const chunks = tokenizeChunks(text, separator);
  let next = chunks.next();
  while (!next.done) next = chunks.next();
  return next.value;
}
async function tokenizeAsync(text: string, separator: string): Promise<CsvRow[]> {
  const chunks = tokenizeChunks(text, separator);
  let next = chunks.next();
  while (!next.done) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    next = chunks.next();
  }
  return next.value;
}

export function readCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  text = text.replace(/^\uFEFF/, '');
  if (!text.trim())
    throw new Error('This CSV is empty. Export your workout history and try again.');
  const candidates = [',', ';'].flatMap((separator) => {
    try {
      const rows = tokenizeCsv(text, separator);
      return [{ rows }];
    } catch {
      return [];
    }
  });
  return chooseCsv(candidates);
}
function chooseCsv(candidates: { rows: CsvRow[] }[]): { headers: string[]; rows: CsvRow[] } {
  candidates.sort((a, b) => (b.rows[0]?.values.length ?? 0) - (a.rows[0]?.values.length ?? 0));
  if (!candidates.length)
    throw new Error(
      'The CSV has malformed quoted fields. Export it again without editing its quoting.',
    );
  const [heading, ...rows] = candidates[0].rows;
  const headers = heading.values.map((value) => value.trim().toLowerCase());
  if (
    headers.length < 2 ||
    headers.some((value) => !value) ||
    new Set(headers).size !== headers.length
  )
    throw new Error('The CSV needs a header row with distinct, nonempty column names.');
  if (!rows.length) throw new Error('This CSV has headers but no workouts.');
  return { headers, rows };
}
export async function readCsvAsync(text: string): Promise<{ headers: string[]; rows: CsvRow[] }> {
  text = text.replace(/^\uFEFF/, '');
  if (!text.trim())
    throw new Error('This CSV is empty. Export your workout history and try again.');
  const candidates: { rows: CsvRow[] }[] = [];
  for (const separator of [',', ';']) {
    try {
      candidates.push({ rows: await tokenizeAsync(text, separator) });
    } catch {
      /* Try the other supported delimiter. */
    }
  }
  return chooseCsv(candidates);
}
