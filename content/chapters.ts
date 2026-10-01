export type Story = { image: string; caption: string; paragraph: string };

export type Chapter = {
  number: string;
  title: string;
  label: string;
  stories: Story[];
};

// Chapter titles are real, client-approved content; story captions and
// paragraphs are the placeholder set carried over from prototype/index.html
// (docs/PLAN.md "Chapters contain stories") until the couple supplies real
// photos and copy.
export const chapters: Chapter[] = [
  {
    number: 'CHAPTER 1',
    title: 'WHERE WE MET',
    label: 'How we met',
    stories: [
      {
        image: '/img/p3_Im0.jpg',
        caption: 'The night we met',
        paragraph: 'It started somewhere completely ordinary. Placeholder copy for the moment our paths first crossed.',
      },
      {
        image: '/img/p4_Im0.jpg',
        caption: 'Still just friends',
        paragraph: 'Neither of us thought much of it at the time. Placeholder copy for the weeks that followed.',
      },
      {
        image: '/img/intro.jpg',
        caption: 'One long conversation',
        paragraph: 'And then one conversation went on far too long. Placeholder copy.',
      },
    ],
  },
  {
    number: 'CHAPTER 2',
    title: 'LDR VIBES',
    label: 'LDR Vibes',
    stories: [
      {
        image: '/img/p4_Im0.jpg',
        caption: 'Different time zones',
        paragraph: 'Different time zones, terrible connections. Placeholder copy for the long-distance years.',
      },
      {
        image: '/img/p1_Im0.jpg',
        caption: 'Midnight good-mornings',
        paragraph: 'Good-morning texts that arrived at midnight. Placeholder copy.',
      },
      {
        image: '/img/p3_Im0.jpg',
        caption: 'Airport arrivals',
        paragraph: 'Counting down to the next airport arrival. Placeholder copy.',
      },
      {
        image: '/img/intro.jpg',
        caption: 'Closing the distance',
        paragraph: 'Learning that distance is mostly a logistics problem. Placeholder copy.',
      },
    ],
  },
  {
    number: 'CHAPTER 3',
    title: 'FAVOR CONFERENCE',
    label: 'Favor Conference',
    stories: [
      {
        image: '/img/p2_Im0.jpg',
        caption: 'That weekend',
        paragraph: 'The weekend that changed the shape of things. Placeholder copy.',
      },
      {
        image: '/img/p3_Im0.jpg',
        caption: 'Only one conversation',
        paragraph: 'A room full of people and somehow only one conversation. Placeholder copy.',
      },
      {
        image: '/img/p4_Im0.jpg',
        caption: 'The long way home',
        paragraph: 'We drove home the long way on purpose. Placeholder copy.',
      },
    ],
  },
  {
    number: 'CHAPTER 4',
    title: 'DATES',
    label: 'Dates',
    stories: [
      {
        image: '/img/p1_Im0.jpg',
        caption: 'Coffee, again',
        paragraph: 'Coffee runs that turned into whole afternoons. Placeholder copy.',
      },
      {
        image: '/img/intro.jpg',
        caption: 'No destination',
        paragraph: 'Long drives with no particular destination. Placeholder copy.',
      },
      {
        image: '/img/p3_Im0.jpg',
        caption: 'All the way in',
        paragraph: 'The slow ordinary business of falling all the way in. Placeholder copy.',
      },
      {
        image: '/img/p4_Im0.jpg',
        caption: 'Meeting everyone',
        paragraph: 'Meeting the families, surviving the questions. Placeholder copy.',
      },
      {
        image: '/img/p2_Im0.jpg',
        caption: 'Not a question anymore',
        paragraph: 'Somewhere in here it stopped being a question. Placeholder copy.',
      },
    ],
  },
  {
    number: 'CHAPTER 5',
    title: "WE'RE ENGAGED!",
    label: "WE'RE ENGAGED!",
    stories: [
      {
        image: '/img/intro.jpg',
        caption: 'Three weeks of nerves',
        paragraph: 'He had been carrying it around for three weeks. Placeholder copy.',
      },
      {
        image: '/img/p3_Im0.jpg',
        caption: 'Right after yes',
        paragraph: 'And then a yes, before he had finished asking. Placeholder copy.',
      },
      {
        image: '/img/p4_Im0.jpg',
        caption: 'Telling everyone',
        paragraph: 'Phone calls to everyone, in no sensible order. Placeholder copy.',
      },
      {
        image: '/img/p1_Im0.jpg',
        caption: 'March 5, 2027',
        paragraph: 'March 5, 2027. Placeholder copy for what comes next.',
      },
    ],
  },
];

export type FlatStory = Story & {
  chapterIndex: number;
  storyIndexInChapter: number;
  storyCountInChapter: number;
};

// Flattened to scroll steps — one entry per story, tagged with its chapter.
// One scroll step = one story = one photocard (docs/PLAN.md "Chapters
// contain stories").
export const stories: FlatStory[] = chapters.flatMap((chapter, chapterIndex) =>
  chapter.stories.map((story, storyIndexInChapter) => ({
    ...story,
    chapterIndex,
    storyIndexInChapter,
    storyCountInChapter: chapter.stories.length,
  })),
);
