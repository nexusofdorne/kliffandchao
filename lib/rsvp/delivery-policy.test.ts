import { describe, expect, it } from 'vitest';
import {
  DELIVERY_LEASE_MS,
  EMAIL_RETRY_WINDOW_MS,
  getDeliveryAction,
} from './delivery-policy';

describe('delivery recovery policy', () => {
  const now = new Date('2026-10-25T00:00:00Z');
  const base = {
    channel: 'EMAIL' as const,
    status: 'PENDING' as const,
    firstAttemptAt: null,
    leaseUntil: null,
  };
  it('allows first delivery and failed email retries within the provider window', () => {
    expect(getDeliveryAction(base, now)).toBe('send');
    expect(
      getDeliveryAction(
        { ...base, status: 'FAILED', firstAttemptAt: now },
        now,
      ),
    ).toBe('send');
  });
  it('does not resend successful deliveries', () => {
    expect(getDeliveryAction({ ...base, status: 'SUCCEEDED' }, now)).toBe(
      'complete',
    );
  });
  it('does not steal an active claim but recovers an expired one', () => {
    expect(
      getDeliveryAction(
        {
          ...base,
          status: 'PROCESSING',
          leaseUntil: new Date(now.getTime() + DELIVERY_LEASE_MS),
        },
        now,
      ),
    ).toBe('busy');
    expect(
      getDeliveryAction(
        { ...base, status: 'PROCESSING', leaseUntil: now },
        now,
      ),
    ).toBe('send');
  });
  it('requires review once email idempotency can no longer be trusted', () => {
    expect(
      getDeliveryAction(
        {
          ...base,
          status: 'FAILED',
          firstAttemptAt: new Date(now.getTime() - EMAIL_RETRY_WINDOW_MS),
        },
        now,
      ),
    ).toBe('review');
    expect(getDeliveryAction({ ...base, status: 'REVIEW' }, now)).toBe(
      'review',
    );
  });
  it('allows Sheets recovery after the email retry window', () => {
    expect(
      getDeliveryAction(
        {
          ...base,
          channel: 'SHEETS',
          status: 'FAILED',
          firstAttemptAt: new Date(0),
        },
        now,
      ),
    ).toBe('send');
  });
});
