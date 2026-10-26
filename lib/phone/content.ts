import { journeyChapters } from '@/content/chapters';
import { entourageGroups } from '@/content/entourage';
import { faqEntries } from '@/content/faq';
import { motifGroups } from '@/content/motif';
import { terminalCopy } from '@/content/terminal';
import { verses } from '@/content/verses';
import { daySchedule, timelineIntroLines, venueAddressLines } from '@/content/wedding';
import { sceneAssets } from '@/config/scene-layers.generated';
import { siteConfig } from '@/config/site';

// The words the phone design (public/m, from prototype-mobile/) shows. The public part ships in
// the page itself; the rest is only served to a signed-in guest, by /api/phone-content.

export function phonePublicContent() {
  return {
    siteConfig: { audioSrc: siteConfig.audioSrc },
    terminalCopy,
    verses,
  };
}

export function phoneContent() {
  return {
    siteConfig,
    terminalCopy,
    verses,
    journeyChapters,
    photos: sceneAssets.chapters,
    daySchedule,
    timelineIntroLines,
    venueAddressLines,
    motifGroups,
    entourageGroups,
    faqEntries,
  };
}
