import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  Prisma,
  PrismaClient,
  RsvpDelivery,
} from '../../generated/prisma/client';
import { buildRsvpNotification } from './notify';
import { deliverRsvpDelivery } from './deliveries';

afterEach(() => vi.restoreAllMocks());

function databaseFixture(overrides: Partial<RsvpDelivery> = {}) {
  const record = {
    id: 'delivery-1',
    submissionId: 'submission-1',
    channel: 'EMAIL',
    status: 'PENDING',
    payload: buildRsvpNotification('couple@example.com', {
      partyLabel: 'Original family label',
      submitterName: 'A Guest',
      answers: [],
      message: null,
    }),
    attempts: 0,
    firstAttemptAt: null,
    claimToken: null,
    leaseUntil: null,
    deliveredAt: null,
    sheetId: null,
    sheetStartRow: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    submission: {
      id: 'submission-1',
      partyId: 'party-1',
      submittedByGuestId: 'guest-1',
      message: null,
      ipHash: null,
      createdAt: new Date(),
      responses: [{ guestId: 'guest-1', status: 'ATTENDING' as const }],
    },
  } satisfies RsvpDelivery & { submission: object };
  const updateMany = vi.fn(
    async ({ where, data }: Prisma.RsvpDeliveryUpdateManyArgs) => {
      if (
        (typeof where?.attempts === 'number' &&
          where.attempts !== record.attempts) ||
        (typeof where?.claimToken === 'string' &&
          where.claimToken !== record.claimToken) ||
        (typeof where?.status === 'string' && where.status !== record.status)
      )
        return { count: 0 };
      const attempts =
        typeof data.attempts === 'object'
          ? record.attempts + (data.attempts.increment ?? 0)
          : record.attempts;
      Object.assign(record, data, { attempts });
      return { count: 1 };
    },
  );
  const db = {
    rsvpDelivery: {
      findUnique: vi.fn(async () => structuredClone(record)),
      updateMany,
    },
    $queryRaw: vi.fn(async () => [{ nextRow: 15 }]),
    $transaction: transaction,
  };
  async function transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return callback(db as unknown as Prisma.TransactionClient);
  }
  return {
    db: db as unknown as PrismaClient,
    record,
    updateMany,
    query: db.$queryRaw,
  };
}

function deliveryServices() {
  return {
    notify: vi.fn(async () => {}),
    mirror: vi.fn(async () => {}),
    nextRow: vi.fn(async () => 14),
    markGuests: vi.fn(async () => {}),
  };
}

describe('persisted delivery recovery', () => {
  it('sends the saved email once and skips an already completed task', async () => {
    const { db, record } = databaseFixture();
    const services = deliveryServices();
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe(
      'delivered',
    );
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe('complete');
    expect(services.notify).toHaveBeenCalledExactlyOnceWith(
      record.payload,
      record.id,
    );
    expect(record.status).toBe('SUCCEEDED');
    expect(record.attempts).toBe(1);
  });
  it('preserves a failed task and retries with the same email payload and key', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { db, record } = databaseFixture();
    const services = deliveryServices();
    services.notify.mockRejectedValueOnce(new Error('Provider unavailable'));
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe('failed');
    expect(record.status).toBe('FAILED');
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe(
      'delivered',
    );
    expect(services.notify.mock.calls[0]).toEqual(
      services.notify.mock.calls[1],
    );
    expect(record.attempts).toBe(2);
  });
  it('does not send while another worker owns the lease', async () => {
    const { db, record } = databaseFixture({
      status: 'PROCESSING',
      leaseUntil: new Date(Date.now() + 60_000),
    });
    const services = deliveryServices();
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe('busy');
    expect(services.notify).not.toHaveBeenCalled();
  });
  it('does not send if another worker wins the atomic claim', async () => {
    const { db, record, updateMany } = databaseFixture();
    updateMany.mockResolvedValueOnce({ count: 0 });
    const services = deliveryServices();
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe('busy');
    expect(services.notify).not.toHaveBeenCalled();
  });
  it('reuses the reserved Sheets range when the first write loses its response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { db, record, query } = databaseFixture({
      channel: 'SHEETS',
      payload: {},
    });
    const services = deliveryServices();
    services.mirror.mockRejectedValueOnce(new Error('Response lost'));
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe('failed');
    expect(record.sheetStartRow).toBe(14);
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe(
      'delivered',
    );
    expect(services.mirror.mock.calls[0]).toEqual(
      services.mirror.mock.calls[1],
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(services.nextRow).toHaveBeenCalledTimes(1);
  });
  it("marks the guests' answers in the Guests tab after the RSVP log", async () => {
    const { db, record } = databaseFixture({ channel: 'SHEETS', payload: {} });
    const services = deliveryServices();
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe('delivered');
    expect(services.markGuests).toHaveBeenCalledExactlyOnceWith(db, ['guest-1']);
    expect(services.mirror.mock.invocationCallOrder[0]).toBeLessThan(
      services.markGuests.mock.invocationCallOrder[0],
    );
  });
  it('retries the whole Sheets delivery when marking the Guests tab fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { db, record } = databaseFixture({ channel: 'SHEETS', payload: {} });
    const services = deliveryServices();
    services.markGuests.mockRejectedValueOnce(new Error('Sheets busy'));
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe('failed');
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe('delivered');
    expect(services.markGuests).toHaveBeenCalledTimes(2);
    // the log rows go back into the same reserved range
    expect(services.mirror.mock.calls[0]).toEqual(services.mirror.mock.calls[1]);
  });
  it('moves expired email attempts to review without sending again', async () => {
    const { db, record } = databaseFixture({
      status: 'FAILED',
      firstAttemptAt: new Date(0),
    });
    const services = deliveryServices();
    expect(await deliverRsvpDelivery(db, record.id, services)).toBe('review');
    expect(record.status).toBe('REVIEW');
    expect(services.notify).not.toHaveBeenCalled();
  });
});
