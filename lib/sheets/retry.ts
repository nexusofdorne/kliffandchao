const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);
const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;

async function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RetryOptions = {
  maxAttempts?: number;
  // Injectable so tests don't wait out real backoff delays.
  sleep?: (ms: number) => Promise<void>;
};

// Exponential backoff with jitter, retrying only 429/500/502/503 —
// docs/PLAN.md "Reading + caching": never retry any other 4xx, since a 400
// means a malformed range and retrying just burns quota against a request
// that will never succeed.
export async function withRetry(fetchOnce: () => Promise<Response>, options: RetryOptions = {}): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const sleep = options.sleep ?? defaultSleep;

  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetchOnce();
    if (response.ok || !RETRYABLE_STATUSES.has(response.status)) {
      return response;
    }
    lastResponse = response;
    if (attempt < maxAttempts - 1) {
      await sleep(BASE_DELAY_MS * 2 ** attempt + Math.random() * BASE_DELAY_MS);
    }
  }
  // maxAttempts is never 0 in practice (the default is 3, and no caller
  // passes 0), so the loop above always runs at least once and sets this.
  return lastResponse as Response;
}
