import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses a simple header + rows', () => {
    const rows = parseCsv('a,b\n1,2\n3,4\n');
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('handles quoted fields with embedded commas', () => {
    const rows = parseCsv('name,note\nCeline Uy,"Uses a wheelchair, needs ground-floor seating"\n');
    expect(rows[0]?.note).toBe('Uses a wheelchair, needs ground-floor seating');
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    const rows = parseCsv('name,quip\nRamon,"He said ""hello"""\n');
    expect(rows[0]?.quip).toBe('He said "hello"');
  });

  it('skips blank trailing rows', () => {
    const rows = parseCsv('a,b\n1,2\n\n');
    expect(rows).toHaveLength(1);
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('handles a file with no trailing newline', () => {
    const rows = parseCsv('a,b\n1,2');
    expect(rows).toEqual([{ a: '1', b: '2' }]);
  });
});
