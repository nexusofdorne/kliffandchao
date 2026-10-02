import { siteConfig } from '@/config/site';

type CreditProps = { prefix: string; className?: string };

// Label-sized and dimmed, so it reads as a credit rather than a pitch.
// Inherits the section's foreground colour, so the same component works on
// the light wedding panel and the dark RSVP overlay — one of the "three
// chaodesign credits" docs/BUILD_PLAN.md Phase 4 step 7 asks for (the
// other two: the motif tab's instance of this component, and the FAQ's
// plain inline link inside its "who designed this" answer, which isn't
// this component at all). prototype/index.html's .credit.
export function Credit({ prefix, className = '' }: CreditProps) {
  return (
    <a
      href={siteConfig.chaodesignUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-[7px] text-[9px] font-semibold tracking-[.14em] opacity-55 transition-opacity duration-300 hover:opacity-100 focus-visible:opacity-100 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-[12px] flex-none stroke-current"
        strokeWidth={1.6}
        fill="none"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
      </svg>
      <span>
        {prefix} BY <b className="font-semibold tracking-[.1em]">CHAODESIGN.PH</b>
      </span>
    </a>
  );
}
