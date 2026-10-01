export type Verse = { text: string; ref: string };

// Confirmed by the client — docs/PLAN.md "The verse is its own layer".
// Natural case; the all-caps look on screen comes from CSS (`uppercase` on
// VerseCycler's button), not from the data.
export const verses: Verse[] = [
  {
    text: '"For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, plans to give you hope and a future."',
    ref: 'Jeremiah 29:11',
  },
  {
    text: 'For nothing will be impossible with God.',
    ref: 'Luke 1:37',
  },
  {
    text: 'It is not good for the man to be alone. I will make a helper suitable for him.',
    ref: 'Genesis 2:18',
  },
  {
    text: 'Though one may be overpowered, two can defend themselves. A cord of three strands is not quickly broken.',
    ref: 'Ecclesiastes 4:12',
  },
  {
    text: 'And over all these virtues put on love, which binds them all together in perfect unity.',
    ref: 'Colossians 3:14',
  },
];
