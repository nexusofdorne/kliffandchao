import { siteConfig } from '@/config/site';
import { CHAODESIGN_HANDLE, faqEntries } from '@/content/faq';

// The couple's questions and answers as an accordion, built from <details> so the
// open/close state, keyboard handling and ARIA all come from the browser for free.
export function FaqTab() {
  return (
    <div>
      <div className="mb-[1.2vh] text-[clamp(12px,1.9vh,20px)] font-medium tracking-[-.01em]">
        FAQ
      </div>
      <div className="mx-auto mt-[3vh] flex max-w-[680px] flex-col gap-[9px] text-left">
        {faqEntries.map((entry, index) => (
          <details
            key={entry.question}
            open={index === 0}
            className="glass-light rounded-[22px] px-[clamp(14px,1.6vw,22px)]"
          >
            <summary className="flex cursor-pointer list-none justify-between gap-[16px] py-[2.1vh] text-[clamp(10px,1.4vh,14px)] font-medium tracking-[.04em] after:font-semibold after:text-[var(--green)] after:content-['+'] open:after:content-['–'] focus-visible:rounded-[.31em] focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--green)] [&::-webkit-details-marker]:hidden">
              <span>
                {String(index + 1).padStart(2, '0')}. {entry.question}
              </span>
            </summary>
            <div className="pb-[2.3vh] text-[clamp(10px,1.3vh,13px)] leading-[1.8] text-[#4a5140]">
              {entry.answer.map((paragraph) => (
                <p
                  key={paragraph}
                  className="m-0 mb-[1.1vh] whitespace-pre-line last:mb-0"
                >
                  {withStudioLink(paragraph)}
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/** The paragraph with Chao's studio handle turned into a link. */
function withStudioLink(paragraph: string) {
  const parts = paragraph.split(CHAODESIGN_HANDLE);
  if (parts.length === 1) return paragraph;
  return parts.map((part, i) => (
    <span key={i}>
      {i > 0 ? (
        <a
          href={siteConfig.chaodesignUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-[rgba(79,122,34,.4)] font-semibold text-[var(--green)] no-underline transition-colors duration-200 hover:border-[var(--green)] focus-visible:border-[var(--green)]"
        >
          {CHAODESIGN_HANDLE}
        </a>
      ) : null}
      {part}
    </span>
  ));
}
