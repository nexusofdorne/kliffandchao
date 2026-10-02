export const siteConfig = {
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
  audioSrc: '/audio/the-blessing.mp3',
  audioTitle: 'The Blessing',
  // UTM params are load-bearing, not decoration: vercel.json sets
  // Referrer-Policy: no-referrer, so without them Instagram logs these
  // clicks as direct traffic with no idea they came from here — the UTMs
  // live in the URL itself, so they survive that header.
  chaodesignUrl: 'https://www.instagram.com/chaodesign.ph/?utm_source=kliffandchao&utm_medium=wedding-site',
} as const;
