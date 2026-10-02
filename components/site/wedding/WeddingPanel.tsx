'use client';

import { useEffect, useState } from 'react';
import { GlassWash } from '@/components/site/glass/GlassWash';
import { useTrackProgress } from '@/components/site/TrackProgressProvider';
import { computeParallaxOffset } from '@/lib/track/progress';
import { DetailTab } from './DetailTab';
import { EntourageTab } from './EntourageTab';
import { FaqTab } from './FaqTab';
import { MotifTab } from './MotifTab';
import { TabBar, type WeddingTab } from './TabBar';
import { TimelineTab } from './TimelineTab';

const WEDDING_LAYER_INDEX = 2;

// Header pinned, content scrolls: the tab bar is flex:none and the active
// panel takes the remaining height and scrolls internally — a long tab
// (FAQ) scrolling the bar off the top made the gap under the top bar jump
// between tabs. Every tab stays mounted (CSS display, not conditional
// rendering) so the map, the FAQ's open/closed state and the countdown's
// interval all survive switching away and back — prototype/index.html's
// #wedding / .panel.
export function WeddingPanel() {
  const { panel } = useTrackProgress();
  const [activeTab, setActiveTab] = useState<WeddingTab>('detail');
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => setViewportWidth(window.innerWidth);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const parallaxX = computeParallaxOffset(panel, WEDDING_LAYER_INDEX, viewportWidth);

  return (
    <div className="wedding-panel relative flex h-full flex-col overflow-hidden bg-[#f5f3ed] text-[#14180d]">
      <GlassWash imageSrc="/img/p1_Im0.jpg" />

      {/* Parallax applies only to the tab bar, not the panels below it: the
          panels scroll internally, and shifting that whole column fought
          with their own scroll feel — prototype/index.html's PLX only
          pairs #wedding .tabs with the wedding panel index, not the panel
          content. */}
      <div className="relative z-[1] flex-none" style={{ transform: `translateX(${parallaxX}px)` }}>
        <TabBar activeTab={activeTab} onSelectTab={setActiveTab} />
      </div>

      <div className={`wedding-tab-panel relative z-[1] ${activeTab === 'detail' ? 'is-active' : ''}`}>
        <DetailTab active={activeTab === 'detail'} />
      </div>
      <div className={`wedding-tab-panel relative z-[1] ${activeTab === 'timeline' ? 'is-active' : ''}`}>
        <TimelineTab />
      </div>
      <div className={`wedding-tab-panel relative z-[1] ${activeTab === 'motif' ? 'is-active' : ''}`}>
        <MotifTab />
      </div>
      <div className={`wedding-tab-panel relative z-[1] ${activeTab === 'entourage' ? 'is-active' : ''}`}>
        <EntourageTab />
      </div>
      <div className={`wedding-tab-panel relative z-[1] ${activeTab === 'faq' ? 'is-active' : ''}`}>
        <FaqTab />
      </div>
    </div>
  );
}
