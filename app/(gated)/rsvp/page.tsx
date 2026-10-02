'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Confirmation } from '@/components/rsvp/Confirmation';
import { GuestSearch, type GuestSearchResult } from '@/components/rsvp/GuestSearch';
import { PartyForm, type RsvpSubmitPayload } from '@/components/rsvp/PartyForm';
import { RsvpBanner } from '@/components/rsvp/RsvpBanner';
import { GlassWash } from '@/components/site/glass/GlassWash';
import type { PartyView } from '@/lib/rsvp/build-party';

type Stage =
  | { kind: 'search'; error: string | null }
  | { kind: 'loading' }
  | { kind: 'party'; party: PartyView; guestId: string; error: string | null }
  | { kind: 'confirmation'; attendingCount: number };

// A full-screen overlay route, not a CSS layer toggled on top of /story —
// docs/PLAN.md "The three sections are panels on ONE page... /rsvp stays a
// real route". The persistent chrome (TopBar, AudioToggle) never renders
// here at all: it lives in story/layout.tsx, a sibling this route doesn't
// share — prototype/index.html's `body.rsvp-open .topbar{display:none}`,
// achieved structurally instead of by a body class.
export default function RsvpPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: 'search', error: null });
  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());

  const goHome = useCallback(() => {
    router.push('/story');
  }, [router]);

  async function handleSelectGuest(guest: GuestSearchResult) {
    setStage({ kind: 'loading' });
    // A fresh idempotency key per party loaded, not per submit click — a
    // retry of the same submission should reuse it, but searching again
    // for a different household starts a genuinely new one.
    setSubmissionId(crypto.randomUUID());

    const response = await fetch(`/api/party?guestId=${encodeURIComponent(guest.id)}`);
    if (!response.ok) {
      setStage({ kind: 'search', error: 'Something went wrong — please try again.' });
      return;
    }
    const party = (await response.json()) as PartyView;
    setStage({ kind: 'party', party, guestId: guest.id, error: null });
  }

  async function handleSubmit(payload: RsvpSubmitPayload) {
    if (stage.kind !== 'party') return;
    const { party, guestId } = stage;

    setSubmitting(true);
    const response = await fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submittedByGuestId: guestId,
        responses: payload.responses,
        message: payload.message || undefined,
        clientSubmissionId: submissionId,
      }),
    });
    setSubmitting(false);

    if (!response.ok) {
      setStage({ kind: 'party', party, guestId, error: 'Something went wrong — please try again.' });
      return;
    }
    const attendingCount = payload.responses.filter((response) => response.status === 'ATTENDING').length;
    setStage({ kind: 'confirmation', attendingCount });
  }

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#0a0c07] text-white">
      {/* Something has to sit behind the glass or it reads as flat grey —
          a blurred wash of the journey photo, so the RSVP shares the
          site's palette. Darker and more desaturated than the wedding
          panel's wash: it sits behind `.glass`, not `.glass-light`. */}
      <GlassWash
        imageSrc="/img/p1_Im0.jpg"
        fixed
        gradients={['radial-gradient(90% 70% at 78% 4%, rgba(79,122,34,.42), transparent 60%)']}
        filter="blur(54px) saturate(.9) brightness(.52)"
        opacity={0.85}
      />

      <button
        type="button"
        onClick={goHome}
        className="rsvp-close glass rounded-full px-[20px] py-[11px] text-[10px] tracking-[.14em] transition-colors duration-300 hover:bg-white/[.22]"
      >
        CLOSE ✕
      </button>

      <div className="rsvp-wrap relative z-[1] mx-auto max-w-[560px]">
        {stage.kind === 'confirmation' ? (
          <Confirmation attendingCount={stage.attendingCount} onBackToHome={goHome} />
        ) : (
          <>
            <h3 className="mb-[1.4vh] text-center text-[clamp(15px,2.4vh,26px)] font-medium tracking-[.14em]">RSVP</h3>
            <p className="mb-[5vh] text-center text-[11px] leading-[1.9] tracking-[.12em] opacity-60">
              Type your last name and we&apos;ll find your invitation.
            </p>

            <GuestSearch onSelectGuest={handleSelectGuest} />

            {stage.kind === 'search' && stage.error && (
              <p className="mt-[2vh] text-center text-[11px] tracking-[.1em] text-red-300">{stage.error}</p>
            )}
            {stage.kind === 'loading' && (
              <p className="mt-[3vh] text-center text-[11px] tracking-[.1em] opacity-50">Loading your party…</p>
            )}
            {stage.kind === 'party' && (
              <>
                <RsvpBanner party={stage.party} />
                <PartyForm party={stage.party} onSubmit={handleSubmit} submitting={submitting} />
                {stage.error && (
                  <p className="mt-[2vh] text-center text-[11px] tracking-[.1em] text-red-300">{stage.error}</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
