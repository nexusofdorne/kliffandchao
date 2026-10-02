export type FaqEntry =
  | { question: string; answer: string }
  | { question: string; isDesignCredit: true };

// No content was designed for this tab (docs/PLAN.md) — structure only.
// All copy is placeholder except the question text itself.
export const faqEntries: FaqEntry[] = [
  { question: 'What should I wear?', answer: 'Formal attire in the motif palette above. Placeholder copy.' },
  { question: 'Can I bring a plus one?', answer: 'Your invitation lists everyone in your party. Placeholder copy.' },
  { question: 'Is the ceremony indoors?', answer: 'Placeholder copy.' },
  { question: 'Where can I park?', answer: 'Placeholder copy.' },
  { question: 'Until when can I RSVP?', answer: 'Placeholder — the couple still needs to pick a deadline.' },
  { question: 'Can I bring my children?', answer: 'Placeholder copy.' },
  { question: 'Is there a gift registry?', answer: 'Placeholder copy.' },
  {
    question: 'What time should I arrive?',
    answer: 'Doors open at 3:30 PM; the ceremony starts at 4:00 PM sharp. Placeholder copy.',
  },
  { question: 'Will there be transportation?', answer: 'Placeholder copy.' },
  { question: 'Are there nearby hotels?', answer: 'Placeholder copy.' },
  { question: 'Who do I contact on the day?', answer: 'Placeholder copy.' },
  { question: 'Who designed the invitation and this site?', isDesignCredit: true },
];
