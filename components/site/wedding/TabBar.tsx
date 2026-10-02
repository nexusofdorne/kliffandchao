'use client';

import { useLayoutEffect, useRef, useState } from 'react';

export type WeddingTab = 'detail' | 'timeline' | 'motif' | 'entourage' | 'faq';

const TABS: { id: WeddingTab; label: string }[] = [
  { id: 'detail', label: 'DETAIL' },
  { id: 'timeline', label: 'TIMELINE' },
  { id: 'motif', label: 'MOTIF' },
  { id: 'entourage', label: 'ENTOURAGE' },
  { id: 'faq', label: 'FAQ' },
];

type TabBarProps = {
  activeTab: WeddingTab;
  onSelectTab: (tab: WeddingTab) => void;
};

// Deliberately not the same object as the top bar's section nav: no
// surface, no capsule — bare labels on a hairline, with opacity carrying
// the active state and a solid underline sliding between them. Two
// identical glass pills stacked 40px apart would read as one broken
// control — prototype/index.html's .tabrow / moveInd().
export function TabBar({ activeTab, onSelectTab }: TabBarProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const row = rowRef.current;
    function measure() {
      const active = row?.querySelector<HTMLButtonElement>(`[data-tab="${activeTab}"]`);
      if (active) setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeTab]);

  return (
    <div className="flex flex-none flex-col items-center px-[4vw]">
      <div ref={rowRef} className="wedding-tab-row">
        <div
          aria-hidden="true"
          className="wedding-tab-indicator"
          style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
        />
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-tab={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`relative whitespace-nowrap px-px py-0.5 text-[clamp(8.5px,1.1vh,12px)] tracking-[.14em] text-[#14180d] transition-opacity duration-[.28s] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--green)] focus-visible:outline-offset-[3px] max-[768px]:text-[8px] max-[768px]:tracking-[.09em] ${
              activeTab === tab.id ? 'font-semibold opacity-100' : 'opacity-40 hover:opacity-[.72]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
