'use client';

import { useState } from 'react';
import { siteConfig } from '@/config/site';
import type { PartyView } from '@/lib/rsvp/build-party';
import { MESSAGE_MAX_LENGTH } from '@/lib/validation';

export type AttendanceChoice = 'ATTENDING' | 'NOT_ATTENDING';
export type RsvpSubmitPayload = { responses: { guestId: string; status: AttendanceChoice }[]; message: string };

type PartyFormProps = {
  party: PartyView;
  onSubmit: (payload: RsvpSubmitPayload) => void;
  submitting: boolean;
};

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });

// Prefills every control with the previous answer — a blank form for
// someone who already responded reads as "it got lost," and they
// re-submit in a panic (docs/PLAN.md "Already-RSVP'd behaviour"). The
// deadline check is enforced server-side (409); `party.editable` here only
// disables the controls so a guest can't be misled into thinking a
// doomed submit will go through.
export function PartyForm({ party, onSubmit, submitting }: PartyFormProps) {
  const [picks, setPicks] = useState<Record<string, AttendanceChoice | null>>(() =>
    Object.fromEntries(party.members.map((member) => [member.id, member.status])),
  );
  const [message, setMessage] = useState(party.message ?? '');

  const allPicked = party.members.every((member) => picks[member.id] != null);
  const ctaLabel = submitting ? 'SENDING…' : party.hasSubmission ? 'UPDATE OUR RSVP' : 'SEND OUR RSVP';

  function handlePick(guestId: string, status: AttendanceChoice) {
    setPicks((previous) => ({ ...previous, [guestId]: status }));
  }

  function handleSubmit() {
    // allPicked already guards the button, so every pick is non-null here —
    // the cast just reflects that to the type checker.
    const responses = party.members.map((member) => ({
      guestId: member.id,
      status: picks[member.id] as AttendanceChoice,
    }));
    onSubmit({ responses, message });
  }

  return (
    <div className="mt-[5vh]">
      <div className="mb-[2.6vh] text-[9.5px] tracking-[.14em] opacity-60">
        {party.members.length > 1
          ? `RESPONDING FOR ${party.label.toUpperCase()} — ${party.members.length} GUESTS`
          : 'RESPONDING FOR YOURSELF'}
      </div>

      {party.members.map((member) => {
        const respondedBy = member.respondedByGuestId
          ? party.members.find((candidate) => candidate.id === member.respondedByGuestId)
          : null;
        return (
          <div
            key={member.id}
            className="glass mb-[9px] flex flex-wrap items-center justify-between gap-[14px] rounded-[22px] px-[20px] py-[16px] text-white"
          >
            <div className="text-[13.5px] tracking-[.05em]">
              {member.firstName} {member.lastName}
              {respondedBy && member.respondedAt && (
                <em className="mt-[5px] block text-[9px] font-normal not-italic tracking-[.14em] opacity-45">
                  ANSWERED BY {respondedBy.firstName.toUpperCase()} ON{' '}
                  {DATE_FORMAT.format(new Date(member.respondedAt)).toUpperCase()}
                </em>
              )}
            </div>
            <div className="flex flex-none rounded-full border border-[var(--glass-rim-soft)] bg-black/20 p-[3px]">
              <button
                type="button"
                disabled={!party.editable}
                onClick={() => handlePick(member.id, 'ATTENDING')}
                className={`rounded-full px-[16px] py-[9px] text-[9.5px] tracking-[.14em] transition-all duration-[.18s] disabled:cursor-not-allowed ${
                  picks[member.id] === 'ATTENDING'
                    ? 'bg-[var(--lime)] font-semibold text-[#1c2610] opacity-100'
                    : 'opacity-60'
                }`}
              >
                ATTENDING
              </button>
              <button
                type="button"
                disabled={!party.editable}
                onClick={() => handlePick(member.id, 'NOT_ATTENDING')}
                className={`rounded-full px-[16px] py-[9px] text-[9.5px] tracking-[.14em] transition-all duration-[.18s] disabled:cursor-not-allowed ${
                  picks[member.id] === 'NOT_ATTENDING'
                    ? 'bg-white/90 font-semibold text-[#14180d] opacity-100'
                    : 'opacity-60'
                }`}
              >
                CAN&apos;T MAKE IT
              </button>
            </div>
          </div>
        );
      })}

      <label htmlFor="rsvp-message" className="mb-[1.3vh] mt-[4.6vh] block text-[9.5px] tracking-[.14em] opacity-65">
        A MESSAGE FOR {siteConfig.coupleNames.toUpperCase()} <span className="opacity-50">(OPTIONAL)</span>
      </label>
      <textarea
        id="rsvp-message"
        value={message}
        maxLength={MESSAGE_MAX_LENGTH}
        onChange={(event) => setMessage(event.target.value)}
        disabled={!party.editable}
        placeholder="Leave a note…"
        className="glass mt-[1.3vh] min-h-[112px] w-full resize-y rounded-[22px] px-[20px] py-[16px] text-[max(16px,13px)] leading-[1.75] text-white outline-none transition-colors duration-200 placeholder:text-white/40 focus:border-[rgba(255,255,255,.5)] disabled:opacity-50"
      />

      <button
        type="button"
        disabled={!allPicked || !party.editable || submitting}
        onClick={handleSubmit}
        className="mt-[4.4vh] h-[58px] w-full rounded-full bg-[var(--lime)] font-semibold tracking-[.14em] text-[#1c2610] shadow-[0_8px_26px_rgba(157,203,90,.22)] transition-[background,transform] duration-200 enabled:hover:-translate-y-px enabled:hover:bg-[#aedc68] disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
      >
        {ctaLabel}
      </button>
    </div>
  );
}
