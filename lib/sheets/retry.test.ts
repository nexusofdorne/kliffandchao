import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './retry';

function response(status: number): Response {
  return new Response(null, { status });
}

describe('withRetry', () => {
  const noopSleep = async () => {};

  it('returns immediately on a successful response, without retrying', async () => {
    const fetchOnce = vi.fn().mockResolvedValue(response(200));
    const result = await withRetry(fetchOnce, { sleep: noopSleep });
    expect(result.status).toBe(200);
    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 up to maxAttempts, then returns the last response', async () => {
    const fetchOnce = vi.fn().mockResolvedValue(response(429));
    const result = await withRetry(fetchOnce, { maxAttempts: 3, sleep: noopSleep });
    expect(result.status).toBe(429);
    expect(fetchOnce).toHaveBeenCalledTimes(3);
  });

  it('succeeds once a retry attempt returns ok', async () => {
    const fetchOnce = vi
      .fn()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));
    const result = await withRetry(fetchOnce, { sleep: noopSleep });
    expect(result.status).toBe(200);
    expect(fetchOnce).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable 4xx', async () => {
    const fetchOnce = vi.fn().mockResolvedValue(response(400));
    const result = await withRetry(fetchOnce, { sleep: noopSleep });
    expect(result.status).toBe(400);
    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });

  it('waits with increasing backoff between attempts', async () => {
    const fetchOnce = vi.fn().mockResolvedValue(response(500));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await withRetry(fetchOnce, { maxAttempts: 3, sleep });
    expect(sleep).toHaveBeenCalledTimes(2);
    const [firstDelay] = sleep.mock.calls[0];
    const [secondDelay] = sleep.mock.calls[1];
    expect(secondDelay).toBeGreaterThan(firstDelay);
  });
});
