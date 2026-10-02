import { Credit } from '@/components/site/chrome/Credit';

type ConfirmationProps = {
  attendingCount: number;
  onBackToHome: () => void;
};

// After submitting, a BACK TO HOME button closes the overlay and returns
// to the intro panel — without it the confirmation is a dead end, the only
// way out being the small CLOSE in the corner (docs/PLAN.md "Already-
// RSVP'd behaviour"). prototype/index.html's .ok.
export function Confirmation({ attendingCount, onBackToHome }: ConfirmationProps) {
  return (
    <div className="py-[9vh] text-center text-white">
      <div className="glass mx-auto mb-[3vh] grid size-[66px] place-items-center rounded-full text-[28px] text-[var(--lime)]">
        ✓
      </div>
      <h3 className="mb-[1.4vh] text-[clamp(15px,2.4vh,26px)] font-medium tracking-[.14em]">THANK YOU</h3>
      <p className="mx-auto mt-[2.4vh] max-w-[560px] text-[11px] leading-[1.9] tracking-[.12em] opacity-60">
        Your RSVP is in — {attendingCount} attending.
      </p>
      <button
        type="button"
        onClick={onBackToHome}
        className="mx-auto mt-[4vh] block h-[58px] w-full max-w-[320px] rounded-full bg-[var(--lime)] font-semibold tracking-[.14em] text-[#1c2610] shadow-[0_8px_26px_rgba(157,203,90,.22)] transition-[background,transform] duration-200 hover:-translate-y-px hover:bg-[#aedc68]"
      >
        BACK TO HOME
      </button>
      <div className="mt-[6vh]">
        <Credit prefix="SITE & STATIONERY" />
      </div>
    </div>
  );
}
