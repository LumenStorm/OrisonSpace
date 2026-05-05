export type CursorPayload = {
  ts: string;
  id: string;
};

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
};

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor?: string): CursorPayload | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<CursorPayload>;
    if (!parsed.ts || !parsed.id) return null;
    return { ts: parsed.ts, id: parsed.id };
  } catch {
    return null;
  }
}

export function paginateRows<T extends Record<string, unknown>, R>(
  rows: T[],
  limit: number,
  mapRow: (row: T) => R,
  cursorFromRow: (row: T) => CursorPayload
): PaginatedResult<R> {
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(mapRow),
    nextCursor: rows.length > limit && last ? encodeCursor(cursorFromRow(last)) : null
  };
}
