import { describe, expect, it, vi } from 'vitest';
import {
  buildRsvpLogRows,
  isRsvpLogRangeAvailable,
  mirrorRsvpToSheet,
  readRsvpLogNextRow,
} from './mirror';

describe('buildRsvpLogRows', () => {
  const createdAt = new Date('2026-06-01T12:00:00.000Z');

  it('builds one row per guest response, in the RSVP_Log column order', () => {
    const rows = buildRsvpLogRows({
      submissionId: 'sub_1',
      submittedByGuestId: 'g01',
      partyId: 'p01',
      responses: [
        { guestId: 'g01', status: 'ATTENDING' },
        { guestId: 'g02', status: 'NOT_ATTENDING' },
      ],
      message: 'See you there!',
      ipHash: 'hash123',
      createdAt,
    });

    expect(rows).toEqual([
      [
        createdAt.toISOString(),
        'sub_1',
        'g01',
        'p01',
        'g01',
        'ATTENDING',
        'See you there!',
        'hash123',
      ],
      [
        createdAt.toISOString(),
        'sub_1',
        'g01',
        'p01',
        'g02',
        'NOT_ATTENDING',
        'See you there!',
        'hash123',
      ],
    ]);
  });

  it('writes empty strings for a null message and ip hash', () => {
    const [row] = buildRsvpLogRows({
      submissionId: 'sub_2',
      submittedByGuestId: 'g01',
      partyId: 'p01',
      responses: [{ guestId: 'g01', status: 'ATTENDING' }],
      message: null,
      ipHash: null,
      createdAt,
    });
    expect(row[6]).toBe('');
    expect(row[7]).toBe('');
  });

  it('escapes a message that would read as a formula', () => {
    const [row] = buildRsvpLogRows({
      submissionId: 'sub_3',
      submittedByGuestId: 'g01',
      partyId: 'p01',
      responses: [{ guestId: 'g01', status: 'ATTENDING' }],
      message: '=1+1',
      ipHash: null,
      createdAt,
    });
    expect(row[6]).toBe("'=1+1");
  });

  it('returns no rows for an empty response list', () => {
    expect(
      buildRsvpLogRows({
        submissionId: 'sub_4',
        submittedByGuestId: 'g01',
        partyId: 'p01',
        responses: [],
        message: null,
        ipHash: null,
        createdAt,
      }),
    ).toEqual([]);
  });
});

describe('retry-safe Sheets delivery', () => {
  const input = {
    submissionId: 'sub-1',
    submittedByGuestId: 'g1',
    partyId: 'p1',
    responses: [{ guestId: 'g1', status: 'ATTENDING' as const }],
    message: null,
    ipHash: null,
    createdAt: new Date('2026-10-25T00:00:00Z'),
  };
  function metadata(rowCount = 1000) {
    return Response.json({
      sheets: [
        {
          properties: {
            sheetId: 1,
            title: 'RSVP_Log',
            gridProperties: { rowCount },
          },
        },
      ],
    });
  }
  it('reuses identical cells after a lost write response instead of appending', async () => {
    const writes: { path: string; body: string }[] = [];
    const fetchSheet = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.startsWith('?')) return metadata();
      if (init?.method !== 'PUT') return Response.json({});
      writes.push({ path, body: String(init?.body) });
      if (writes.length === 1)
        throw new Error('Response lost after the sheet accepted the write');
      return Response.json({});
    });
    await expect(mirrorRsvpToSheet(input, 42, fetchSheet)).rejects.toThrow();
    await mirrorRsvpToSheet(input, 42, fetchSheet);
    expect(writes).toHaveLength(2);
    expect(writes[0]).toEqual(writes[1]);
    expect(writes[0].path).toBe(
      '/values/RSVP_Log!A42:H42?valueInputOption=RAW',
    );
  });
  it('reserves after existing content and leaves row 1 available for headers', async () => {
    expect(
      await readRsvpLogNextRow(async () =>
        Response.json({ values: [['header'], ['old row']] }),
      ),
    ).toBe(3);
    expect(await readRsvpLogNextRow(async () => Response.json({}))).toBe(2);
  });
  it('grows the sheet before writing beyond its current grid', async () => {
    const calls: string[] = [];
    const fetchSheet = vi.fn(async (path: string, init?: RequestInit) => {
      calls.push(path);
      if (path === ':batchUpdate')
        expect(
          JSON.parse(String(init?.body)).requests[0].appendDimension,
        ).toEqual({ sheetId: 1, dimension: 'ROWS', length: 1 });
      return path.startsWith('?') ? metadata(10) : Response.json({});
    });
    await mirrorRsvpToSheet(input, 11, fetchSheet);
    expect(calls).toContain(':batchUpdate');
  });
  it('rejects a missing log tab or permanent API rejection for admin recovery', async () => {
    await expect(
      mirrorRsvpToSheet(input, 2, async () => Response.json({ sheets: [] })),
    ).rejects.toThrow('RSVP log tab missing');
    await expect(
      mirrorRsvpToSheet(
        input,
        2,
        async () => new Response('', { status: 403 }),
      ),
    ).rejects.toThrow();
  });
  it('refuses to overwrite another submission or duplicate rows that were moved', () => {
    const planned = buildRsvpLogRows(input);
    const header = ['header'];
    expect(isRsvpLogRangeAvailable([header], planned, 2)).toBe(true);
    expect(isRsvpLogRangeAvailable([header, planned[0]], planned, 2)).toBe(
      true,
    );
    expect(
      isRsvpLogRangeAvailable(
        [header, ['timestamp', 'other-submission']],
        planned,
        2,
      ),
    ).toBe(false);
    expect(isRsvpLogRangeAvailable([header, [], planned[0]], planned, 2)).toBe(
      false,
    );
  });
});
