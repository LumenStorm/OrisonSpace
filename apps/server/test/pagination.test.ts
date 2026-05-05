import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, paginateRows } from '../src/modules/task/repositories/pagination';

describe('pagination cursor', () => {
  it('encodes and decodes a cursor payload roundtrip', () => {
    const payload = { ts: '2026-05-05T01:02:03.000Z', id: 'task_1' };
    const cursor = encodeCursor(payload);
    expect(decodeCursor(cursor)).toEqual(payload);
  });

  it('returns null for missing or malformed cursors', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('not-base64-or-json')).toBeNull();
    const partial = Buffer.from(JSON.stringify({ ts: '2026-05-05T00:00:00.000Z' }), 'utf8').toString('base64url');
    expect(decodeCursor(partial)).toBeNull();
  });
});

describe('paginateRows', () => {
  type Row = { task_id: string; created_at: string };
  const rowsAt = (n: number): Row[] =>
    Array.from({ length: n }, (_, i) => ({
      task_id: `task_${i + 1}`,
      created_at: `2026-05-05T00:00:0${i}Z`,
    }));
  const mapRow = (row: Row) => ({ id: row.task_id });
  const cursorFromRow = (row: Row) => ({ ts: row.created_at, id: row.task_id });

  it('returns nextCursor when there are more rows than the limit', () => {
    const result = paginateRows(rowsAt(3), 2, mapRow, cursorFromRow);
    expect(result.items).toEqual([{ id: 'task_1' }, { id: 'task_2' }]);
    expect(result.nextCursor).toBeTypeOf('string');
    expect(decodeCursor(result.nextCursor!)).toEqual({
      ts: '2026-05-05T00:00:01Z',
      id: 'task_2',
    });
  });

  it('omits nextCursor when result fills exactly the limit', () => {
    const result = paginateRows(rowsAt(2), 2, mapRow, cursorFromRow);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('omits nextCursor when no rows are returned', () => {
    const result = paginateRows([], 50, mapRow, cursorFromRow);
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});
