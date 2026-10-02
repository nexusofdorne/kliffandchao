export type EntourageGroup = {
  role: string;
  names: string[];
};

// No content was designed for this tab (docs/PLAN.md) — structure only.
// Parent names are confirmed; every other role is still a placeholder dash,
// exactly as the couple left it in prototype/index.html's markup.
export const entourageGroups: EntourageGroup[] = [
  { role: 'PARENTS OF THE GROOM', names: ['Mr. & Mrs. Kho', '—'] },
  { role: 'PARENTS OF THE BRIDE', names: ['Mr. & Mrs. Bulawin', '—'] },
  { role: 'PRINCIPAL SPONSORS', names: ['—', '—', '—'] },
  { role: 'BEST MAN', names: ['—'] },
  { role: 'MAID OF HONOR', names: ['—'] },
  { role: 'GROOMSMEN', names: ['—', '—', '—'] },
  { role: 'BRIDESMAIDS', names: ['—', '—', '—'] },
  { role: 'RING / COIN / BIBLE', names: ['—', '—', '—'] },
];
