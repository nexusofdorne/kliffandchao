import type { GuestSearchResult } from './GuestSearch';

type IdentityCheckProps = {
  guest: GuestSearchResult;
  onConfirm: () => void;
  onCancel: () => void;
};

// Asked between picking a name and seeing the party, so a guest who taps someone else's name
// by accident (a relative with the same surname, the row above) doesn't answer for them: the
// RSVP is recorded as submitted by whoever is chosen here.
export function IdentityCheck({
  guest,
  onConfirm,
  onCancel,
}: IdentityCheckProps) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="identity-check-title"
      aria-describedby="identity-check-note"
      className="glass mt-[3vh] rounded-[26px] px-[clamp(18px,3vw,32px)] py-[3.4vh] text-center"
    >
      <p className="m-0 text-[11px] tracking-[.14em] opacity-60">
        JUST CHECKING
      </p>
      <h4
        id="identity-check-title"
        className="mx-0 mb-0 mt-[1.4vh] text-[clamp(16px,2.4vh,24px)] font-medium tracking-[.02em]"
      >
        Are you {guest.displayName}?
      </h4>
      <p
        id="identity-check-note"
        className="mx-auto mb-0 mt-[1.4vh] max-w-[380px] text-[12px] leading-[1.8] opacity-70"
      >
        Please RSVP under your own name. Your answers will be saved as sent by{' '}
        {guest.displayName}.
      </p>
      <div className="mt-[3vh] flex flex-wrap justify-center gap-[10px]">
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className="h-[48px] min-w-[180px] rounded-full bg-[var(--lime)] px-[24px] text-[12px] font-semibold tracking-[.12em] text-[#1c2610] transition-colors duration-200 hover:bg-[#aedc68]"
        >
          YES, THAT&apos;S ME
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="glass h-[48px] min-w-[180px] rounded-full px-[24px] text-[12px] tracking-[.12em] transition-colors duration-300 hover:bg-white/[.22]"
        >
          NO, SEARCH AGAIN
        </button>
      </div>
    </div>
  );
}
