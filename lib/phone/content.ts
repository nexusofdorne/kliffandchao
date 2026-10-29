import { journeyChapters } from '@/content/chapters';
import { entourageGroups } from '@/content/entourage';
import { CHAODESIGN_HANDLE, faqEntries } from '@/content/faq';
import { finalNote } from '@/content/final-note';
import { guestMotif, sponsorGroups } from '@/content/motif';
import { terminalCopy } from '@/content/terminal';
import { verses } from '@/content/verses';
import {
  daySchedule,
  timelineIntroLines,
  venueAddressLines,
} from '@/content/wedding';
import { journeyMedia } from '@/config/journey-media.generated';
import { siteConfig } from '@/config/site';

// The words the phone design (public/m, from prototype-mobile/) shows. The public part ships in
// the page itself; the rest is only served to a signed-in guest, by /api/phone-content.

export function phonePublicContent() {
  return {
    siteConfig: {
      audioSrc: siteConfig.audioSrc,
      terminalSounds: siteConfig.terminalSounds,
    },
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
    journeyMedia,
    daySchedule,
    timelineIntroLines,
    venueAddressLines,
    sponsorGroups,
    guestMotif,
    entourageGroups,
    faqEntries,
    chaodesignHandle: CHAODESIGN_HANDLE,
    finalNote,
  };
}
