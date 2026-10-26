import 'server-only';
import { Resend } from 'resend';
import { env } from '../env';
import type { RsvpNotification } from '../validation';

export type RsvpEmailDetails = {
  partyLabel: string;
  /** Who filled in the form. */
  submitterName: string;
  /** The answers in this submission (a guest may answer only for themselves). */
  answers: { name: string; status: 'ATTENDING' | 'NOT_ATTENDING' }[];
  message: string | null;
};

export function buildRsvpNotification(
  recipient: string,
  { partyLabel, submitterName, answers, message }: RsvpEmailDetails,
): RsvpNotification {
  const names = (status: 'ATTENDING' | 'NOT_ATTENDING') =>
    answers.filter((answer) => answer.status === status).map((answer) => `- ${answer.name}`);
  const attending = names('ATTENDING');
  const notAttending = names('NOT_ATTENDING');
  const lines = [
    `${submitterName} answered for ${partyLabel}.`,
    '',
    ...(attending.length ? ['Attending:', ...attending, ''] : []),
    ...(notAttending.length ? ["Can't make it:", ...notAttending, ''] : []),
    message ? `Message from ${submitterName}:\n${message}` : 'No message.',
  ];
  return {
    // Replace the sandbox sender with a verified domain during launch.
    from: 'RSVP <onboarding@resend.dev>',
    to: recipient,
    subject: `New RSVP from ${submitterName} (${partyLabel})`,
    text: lines.join('\n'),
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
