import { journeyMedia } from '../config/journey-media.generated';

// The five chapters of the journey: titles and paragraphs are the couple's final copy
// (3.0/instructions.txt). Each chapter's film and photos are in
// config/journey-media.generated.ts, in the same order (scripts/design/prepare_journey_media.py).
export type JourneyChapter = {
  /** Tab label, shown in the journey window and (uppercased) on phones. */
  title: string;
  /** The tab label with a forced line break, where the window needs one (defaults to `title`). */
  tabLabel?: string;
  paragraphs: readonly string[];
};

export const journeyChapters: readonly JourneyChapter[] = [
  {
    title: 'It started with a wedding',
    tabLabel: 'It started\nwith a wedding',
    paragraphs: [
      "They met at a wedding. There to celebrate someone else's love story, with no idea that their own would begin that day.",
      "Neither of them saw it coming. But looking back, it's quite a fitting place for their story to start.",
    ],
  },
  {
    title: "It shouldn't have happened",
    tabLabel: "It shouldn't\nhave happened",
    paragraphs: [
      "There were more reasons why it wouldn't work than reasons why it would.",
      'They came from different places, held different beliefs, and saw certain things in completely different ways.',
      'There were questions, doubts, and things neither of them knew how to navigate. From where they stood, it was hard to imagine a future where things could actually work out.',
    ],
  },
  {
    title: 'But it did',
    paragraphs: [
      'Then came Favor Conference.',
      'Not every question was answered, and not everything suddenly made sense.',
      'But something began to change.',
      'What they once thought was impossible started to look a little different. And slowly, they began to understand that this was never just their story.',
    ],
  },
  {
    title: 'Meet the family & friends',
    tabLabel: 'Meet the family\n& friends',
    paragraphs: [
      'What started between two people slowly became part of the lives of those closest to them.',
      'There were families to meet, friends to get to know, and two different worlds beginning to come together.',
      'And somewhere along the way, their story became one that more people got to be part of.',
    ],
  },
  {
    title: "We're engaged!",
    paragraphs: [
      'Little did Chao know, Kliff had been planning this for quite some time.',
      "He'd had the ring for months and had already asked her parents for permission before proposing.",
      "And a little detail that makes it even more special? The ring was a gift from Kliff's mom.",
      'So when the moment finally came, he asked. And she said yes.',
    ],
  },
];

// --- the phone layout's shape -------------------------------------------
// Phones still show one photocard per story, so they are derived from the
// chapters above (one story per paragraph) rather than kept as a second copy.

export type Story = { image: string; caption: string; paragraph: string };

export type Chapter = {
  number: string;
  title: string;
  label: string;
  stories: Story[];
};

export const chapters: Chapter[] = journeyChapters.map((chapter, index) => {
  const { photos } = journeyMedia[index];
  return {
    number: `CHAPTER ${index + 1}`,
    title: chapter.title.toUpperCase(),
    label: chapter.title,
    stories: chapter.paragraphs.map((paragraph, i) => ({
      image: photos[i % photos.length].src,
      caption: '',
      paragraph,
    })),
  };
});

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
