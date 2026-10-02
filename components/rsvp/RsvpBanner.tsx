import type { PartyView } from '@/lib/rsvp/build-party';

type RsvpBannerProps = { party: PartyView };

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// docs/PLAN.md "Already-RSVP'd behaviour": allow edits until the deadline
// rather than hard-locking on first submission — a 17-month window means
// plans change, and a hard lock just generates the DMs to the couple this
// site exists to prevent. prototype/index.html's #banner.
export function RsvpBanner({ party }: RsvpBannerProps) {
  if (!party.hasSubmission || !party.lastRespondedAt) return null;

  const respondedOn = DATE_FORMAT.format(new Date(party.lastRespondedAt));

  return (
    <div
      className="glass mb-[3.4vh] rounded-[22px] px-[20px] py-[18px] text-[11px] leading-[1.85] tracking-[.07em] text-white"
      style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--lime)' }}
    >
      We&apos;ve got your RSVP from <b>{respondedOn}</b>.{' '}
      {party.editable
        ? 'You can still update it — your previous answers are filled in below.'
        : 'RSVPs are now closed, but these are the answers we have on file.'}
    </div>
  );
}
