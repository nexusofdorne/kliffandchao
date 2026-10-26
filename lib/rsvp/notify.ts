import 'server-only';
import { Resend } from 'resend';
import { env } from '../env';
import type { RsvpNotification } from '../validation';

export function buildRsvpNotification(
  recipient: string,
  partyLabel: string,
  message: string | null,
): RsvpNotification {
  return {
    // Replace the sandbox sender with a verified domain during launch.
    from: 'RSVP <onboarding@resend.dev>',
    to: recipient,
    subject: `New RSVP from ${partyLabel}`,
    text: message
      ? `${partyLabel} responded.\n\nMessage: ${message}`
      : `${partyLabel} responded.`,
  };
}

/** A failed send, carrying only Resend's error code and HTTP status (never its message,
 *  which can quote the recipient), so the logs can say why without private data. */
export class EmailDeliveryError extends Error {
  constructor(readonly reason: string) {
    super(`Email delivery failed (${reason})`);
  }
}

// The SDK returns API errors instead of throwing; the delivery worker must
// see those failures so it can keep the task available for retry.
export async function notifyCouple(
  payload: RsvpNotification,
  deliveryId: string,
): Promise<void> {
  const resend = new Resend(env.RESEND_API_KEY);
  const options = {
    idempotencyKey: deliveryId,
    signal: AbortSignal.timeout(10_000),
  };
  const { data, error } = await resend.emails.send(payload, options);
  if (error) throw new EmailDeliveryError(`${error.name} ${error.statusCode ?? ''}`.trim());
  if (!data) throw new EmailDeliveryError('no_data');
}
