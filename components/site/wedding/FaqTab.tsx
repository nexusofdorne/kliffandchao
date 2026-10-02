import { faqEntries } from '@/content/faq';
import { siteConfig } from '@/config/site';

// No content was designed for this tab (docs/PLAN.md); this is structure
// only — an accordion, built from <details> so the open/close state,
// keyboard handling and ARIA all come from the browser for free.
export function FaqTab() {
  return (
    <div>
      <div className="mb-[1.2vh] text-[clamp(12px,1.9vh,20px)] font-medium tracking-[-.01em]">FAQ</div>
      <div className="mx-auto mt-[5vh] flex max-w-[660px] flex-col gap-[9px] text-left">
        {faqEntries.map((entry, index) => (
          <details
            key={entry.question}
            open={index === 0}
            className="glass-light rounded-[22px] px-[clamp(14px,1.6vw,22px)]"
          >
            <summary className="flex cursor-pointer list-none justify-between gap-[16px] py-[2.3vh] text-[clamp(10px,1.4vh,14px)] tracking-[.1em] after:font-semibold after:text-[var(--green)] after:content-['+'] open:after:content-['–'] focus-visible:rounded-[.31em] focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--green)] [&::-webkit-details-marker]:hidden">
              {entry.question}
            </summary>
            <p className="pb-[2.5vh] text-[clamp(10px,1.3vh,13px)] leading-[1.95] text-[#4a5140]">
              {'isDesignCredit' in entry ? (
                <>
                  Chao did. She runs{' '}
                  <a
                    href={siteConfig.chaodesignUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-b border-[rgba(79,122,34,.4)] font-semibold text-[var(--green)] no-underline transition-colors duration-200 hover:border-[var(--green)] focus-visible:border-[var(--green)]"
                  >
                    chaodesign.ph
                  </a>{' '}
                  — stationery, styling and brand design for weddings and events. Say hello if you have something
                  coming up. <i>Placeholder wording — swap for her own.</i>
                </>
              ) : (
                entry.answer
              )}
            </p>
          </details>
        ))}
      </div>
      <p className="mt-[3vh] text-[11px] leading-[2] tracking-[.14em] text-[rgba(0,0,0,.5)]">
        No content was designed for this tab — structure only.
      </p>
    </div>
  );
}
