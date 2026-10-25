// Resend retains idempotency keys for 24 hours. Leave a safety margin and
// require human review afterward rather than risk a second email.
export const EMAIL_RETRY_WINDOW_MS = 23 * 60 * 60 * 1_000;
export const DELIVERY_LEASE_MS = 5 * 60 * 1_000;

type DeliveryState = {
  channel: 'EMAIL' | 'SHEETS';
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REVIEW';
  firstAttemptAt: Date | null;
  leaseUntil: Date | null;
};

export function getDeliveryAction(
  delivery: DeliveryState,
  now: Date,
): 'send' | 'busy' | 'complete' | 'review' {
  if (delivery.status === 'SUCCEEDED') return 'complete';
  if (delivery.status === 'REVIEW') return 'review';
  if (
    delivery.status === 'PROCESSING' &&
    delivery.leaseUntil &&
    delivery.leaseUntil > now
  )
    return 'busy';
  if (
    delivery.channel === 'EMAIL' &&
    delivery.firstAttemptAt &&
    now.getTime() - delivery.firstAttemptAt.getTime() >= EMAIL_RETRY_WINDOW_MS
  )
    return 'review';
  return 'send';
}
