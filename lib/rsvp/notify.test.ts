import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRsvpNotification, notifyCouple } from './notify';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RSVP email delivery', () => {
  const payload = buildRsvpNotification(
    'couple@example.com',
    'Test family',
    'See you!',
  );
  it('snapshots the complete email so configuration changes cannot change a retry', () => {
    expect(payload).toEqual({
      from: 'RSVP <onboarding@resend.dev>',
      to: 'couple@example.com',
      subject: 'New RSVP from Test family',
      text: 'Test family responded.\n\nMessage: See you!',
    });
  });
  it('sends the stable idempotency key and a bounded request', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: 'email-1' }));
    vi.stubGlobal('fetch', fetch);
    await notifyCouple(payload, 'delivery-1');
    const [, options] = fetch.mock.calls[0];
    expect(new Headers(options.headers).get('Idempotency-Key')).toBe(
      'delivery-1',
    );
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body)).toEqual(payload);
  });
  it('surfaces the SDK returned error so the task stays retryable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { name: 'validation_error', message: 'Rejected' },
            { status: 422 },
          ),
        ),
    );
    await expect(notifyCouple(payload, 'delivery-2')).rejects.toThrow(
      'Email delivery failed',
    );
  });
  it('keeps an ambiguous network failure retryable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connection lost')),
    );
    await expect(notifyCouple(payload, 'delivery-3')).rejects.toThrow(
      'Email delivery failed',
    );
  });
});
