// The wedding motif (3.0 "04 - wedding 3"): what the two sponsor groups wear, and the palette and
// outfit ideas for guests. The fabric and outfit pictures are cut by scripts/design/prepare_motif.py.

export type Fabric = { src: string; name: string };
export type AttireNote = { who: string; note: string };
export type Figure = {
  src: string;
  alt: string;
  px: readonly [number, number];
};

export type SponsorGroup = {
  title: string;
  fabrics: readonly Fabric[];
  attire: readonly AttireNote[];
};

const fabric = (tone: 'brown' | 'green', n: number, name: string): Fabric => ({
  src: `/img/motif/fabric-${tone}-${n}.webp`,
  name,
});

const BROWNS = [
  fabric('brown', 1, 'Mocha'),
  fabric('brown', 2, 'Taupe'),
  fabric('brown', 3, 'Latte'),
];
const GREENS = [
  fabric('green', 1, 'Sage'),
  fabric('green', 2, 'Pale sage'),
  fabric('green', 3, 'Olive'),
];

export const sponsorGroups: readonly SponsorGroup[] = [
  {
    title: 'PRINCIPAL SPONSORS',
    fabrics: BROWNS,
    attire: [
      { who: 'Ladies', note: 'Long gown any shades of brown' },
      { who: 'Gentleman', note: 'Black or dark brown suit' },
    ],
  },
  {
    title: 'SECONDARY SPONSORS',
    fabrics: GREENS,
    attire: [
      { who: 'Ladies', note: 'Long gown any shades of olive' },
      { who: 'Gentleman', note: 'Black or dark brown suit/long sleeve' },
    ],
  },
];

const figure = (
  who: 'women' | 'men',
  n: number,
  alt: string,
  width: number,
): Figure => ({
  src: `/img/motif/${who}-${n}.webp`,
  alt,
  px: [width, 600],
});

export const guestMotif = {
  title: 'GUESTS',
  figures: [
    figure('women', 1, 'Sage long dress with puff sleeves', 170),
    figure('women', 2, 'Olive satin gown', 202),
    figure('women', 3, 'Caramel satin gown', 237),
    figure('women', 4, 'Brown tiered dress', 193),
    figure('women', 5, 'Olive top and wide trousers', 171),
    figure('women', 6, 'Dark brown slip dress', 189),
    figure('men', 1, 'Olive suit with a white shirt', 201),
    figure('men', 2, 'Black suit with a white shirt', 200),
    figure('men', 3, 'Brown shirt and cream trousers', 218),
    figure('men', 4, 'Sage shirt and beige trousers', 194),
  ],
  fabrics: [GREENS[2], GREENS[0], GREENS[1], BROWNS[0], BROWNS[1]],
  note: 'Muted and elegant tones that complement the palette above',
  request: '*We respectfully ask that guests avoid wearing white or ivory.',
} as const;
