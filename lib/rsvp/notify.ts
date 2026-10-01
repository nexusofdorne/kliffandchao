import 'server-only';
import { Resend } from 'resend';
import { env } from '../env';

// Fire-and-forget per docs/PLAN.md "Email mirror": losing the spreadsheet
// (or, for now, before Phase 6 exists at all) still leaves a complete
// record in the couple's inbox. A failure here must never fail the RSVP
// itself — the database write already committed, that's the source of
// truth — so errors are logged, not thrown.
export async function notifyCouple(partyLabel: string, message: string | null): Promise<void> {
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      // resend.dev is Resend's own sandbox sender; swap for a verified
      // domain before launch (Phase 8).
      from: 'RSVP <onboarding@resend.dev>',
      to: env.COUPLE_NOTIFY_EMAIL,
      subject: `New RSVP from ${partyLabel}`,
      text: message ? `${partyLabel} responded.\n\nMessage: ${message}` : `${partyLabel} responded.`,
    });
  } catch (error) {
    console.error('Resend notification failed', error);
  }
}
