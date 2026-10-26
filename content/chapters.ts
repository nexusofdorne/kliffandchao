import { sceneAssets } from '../config/scene-layers.generated';

// The five chapters of the journey. Titles and paragraphs are the client's
// final copy (the v3 mockups); the photos are stand-ins cropped from those
// mockups (public/img/scenes/journey/standin) until the originals arrive.
//
// To add a real video to a chapter, drop the file in public/video/ and set
// `video` to its path; until then the window shows an empty slot.
export type JourneyChapter = {
  /** Tab label, shown in the journey window and (uppercased) on phones. */
  title: string;
  paragraphs: readonly string[];
  video?: string;
};

export const journeyChapters: readonly JourneyChapter[] = [
  {
    title: 'It started with a wedding',
    paragraphs: [
      'They met at a wedding.',
      "There to celebrate someone else's love story, with no idea that their own would begin that day.",
      'Neither of them saw it coming.',
      "But looking back, it's quite a fitting place for their story to start.",
    ],
  },
  {
    title: "It shouldn't have happened",
    paragraphs: [
      "There were more reasons why it wouldn't work than reasons why it would.",
      'They came from different places, held different beliefs, and saw certain things in completely different ways.',
      'There were questions, doubts, and things neither of them knew how to navigate.',
      "By all accounts, this wasn't supposed to go anywhere.",
    ],
  },
  {
    title: 'But it did',
    paragraphs: [
      'Then came Favor Conference.',
      'Not every question was answered, and not everything suddenly made sense. But something began to change.',
      'What they once thought was impossible started to look a little different.',
      'And slowly, they began to understand that this was never just their story.',
    ],
  },
  {
    title: 'Meet family & friends',
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
      "He'd had the ring for months and had already asked her parents for permission a month before the proposal.",
      "And a little detail that makes it even more special is the ring was a gift from Kliff's mom.",
      'So when the moment finally came, he asked. And she said yes!!',
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

const standIns = sceneAssets.chapters;

export const chapters: Chapter[] = journeyChapters.map((chapter, index) => {
  const photos = standIns[String(index + 1) as keyof typeof standIns];
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
