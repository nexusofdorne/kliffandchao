export const siteConfig = {
  backgrounds: {
    gate: '/img/intro.jpg',
    introVideo: '/video/intro-v2.mp4',
    introPoster: '/img/intro-poster-v2.jpg',
    journey: '/img/p1_Im0.jpg',
    wedding: '/img/p1_Im0.jpg',
    rsvp: '/img/p1_Im0.jpg',
  },
  coupleNames: 'Kliff & Chao',
  weddingDateDisplay: 'March 5, 2027',
  weddingDate: '2027-03-05',
  // Ceremony start, used by the countdown — docs/PLAN.md "DETAIL". Computed
  // client-side only; rendering a live timer on the server guarantees a
  // hydration mismatch.
  weddingDateTime: '2027-03-05T16:00:00+08:00',
  venueName: 'Jpark Island Resort & Waterpark',
  venueLocation: 'Cebu',
  venueCoordinates: { lat: 10.282, lng: 123.996444 },
  // "The Blessing (Cinematic Version)" — Kari Jobe & Cody Carnes, per
  // docs/PLAN.md "Background music". Licensed for this private, gated site.
  audioSrc: '/audio/the-blessing-v2.mp3',
  // The splash screen's recorded sounds (lib/audio/typing.ts, from 3.0/audio): typing while
  // a line types, the progress bar while it fills, the glitch while the screen tears. An empty
  // path falls back to the built-in key click (or silence). A changed file needs a new name:
  // media is cached for a week.
  terminalSounds: {
    keys: '/audio/sfx/typing.mp3',
    progress: '/audio/sfx/progress.mp3',
    glitch: '/audio/sfx/glitch.mp3',
  } as Record<'keys' | 'progress' | 'glitch', string>,
  audioTitle: 'The Blessing',
  // UTM params are load-bearing, not decoration: vercel.json sets
  // Referrer-Policy: no-referrer, so without them Instagram logs these
  // clicks as direct traffic with no idea they came from here — the UTMs
  // live in the URL itself, so they survive that header.
  chaodesignUrl:
    'https://www.instagram.com/chaodesign.ph/?utm_source=kliffandchao&utm_medium=wedding-site',
} as const;
