export type Swatch = { hex: string; name: string };
export type Sample = { hex: string; label: string };

export type MotifGroup = {
  name: string;
  note: string;
  swatches: Swatch[];
  samples: Sample[];
};

// Guests first: the two groups that cover almost everyone lead, then the
// entourage roles. `samples` are the attire examples shown when a group
// expands — all placeholder, waiting on real outfit photography.
// prototype/index.html's MOTIF.
export const motifGroups: MotifGroup[] = [
  {
    name: 'FOR THE LADIES',
    note: 'Long dress in any shade below.',
    swatches: [
      { hex: '#6B7F52', name: 'SAGE' },
      { hex: '#A8B894', name: 'MOSS' },
      { hex: '#D9D2C2', name: 'SAND' },
      { hex: '#F2EFE8', name: 'IVORY' },
    ],
    samples: [
      { hex: '#6B7F52', label: 'Floor-length, sage' },
      { hex: '#A8B894', label: 'Wrap dress, moss' },
      { hex: '#D9D2C2', label: 'Satin slip, sand' },
      { hex: '#F2EFE8', label: 'Ivory, sleeved' },
      { hex: '#8A9C70', label: 'Chiffon, olive-grey' },
      { hex: '#C6D0B2', label: 'Tea length, leaf' },
    ],
  },
  {
    name: 'FOR THE GENTLEMEN',
    note: 'Barong tagalog or a dark suit; no white.',
    swatches: [
      { hex: '#14180D', name: 'CHARCOAL' },
      { hex: '#2A4300', name: 'OLIVE' },
      { hex: '#4A5B33', name: 'FERN' },
    ],
    samples: [
      { hex: '#E8E3D6', label: 'Piña barong, natural' },
      { hex: '#14180D', label: 'Charcoal suit' },
      { hex: '#2A4300', label: 'Olive suit, no tie' },
      { hex: '#4A5B33', label: 'Fern, knit tie' },
      { hex: '#3A4030', label: 'Dark slacks + barong' },
      { hex: '#D9D2C2', label: 'Linen, sand' },
    ],
  },
  {
    name: 'PRINCIPAL SPONSORS',
    note: 'Formal — barong tagalog and long gown.',
    swatches: [
      { hex: '#2A4300', name: 'OLIVE' },
      { hex: '#4A5B33', name: 'FERN' },
      { hex: '#D9D2C2', name: 'SAND' },
    ],
    samples: [
      { hex: '#2A4300', label: 'Long gown, olive' },
      { hex: '#E8E3D6', label: 'Formal barong' },
      { hex: '#4A5B33', label: 'Gown, fern' },
    ],
  },
  {
    name: 'SECONDARY SPONSORS',
    note: 'Formal, one shade lighter than the principals.',
    swatches: [
      { hex: '#6B7F52', name: 'SAGE' },
      { hex: '#A8B894', name: 'MOSS' },
      { hex: '#E8E3D6', name: 'LINEN' },
    ],
    samples: [
      { hex: '#6B7F52', label: 'Gown, sage' },
      { hex: '#E8E3D6', label: 'Barong, linen' },
      { hex: '#A8B894', label: 'Gown, moss' },
    ],
  },
  {
    name: 'BEARERS & FLOWER GIRLS',
    note: 'Ivory and soft moss; comfort first.',
    swatches: [
      { hex: '#F2EFE8', name: 'IVORY' },
      { hex: '#C6D0B2', name: 'LEAF' },
      { hex: '#D9D2C2', name: 'SAND' },
    ],
    samples: [
      { hex: '#F2EFE8', label: 'Ivory, tulle' },
      { hex: '#C6D0B2', label: 'Leaf sash' },
      { hex: '#D9D2C2', label: 'Shorts + suspenders' },
    ],
  },
];
