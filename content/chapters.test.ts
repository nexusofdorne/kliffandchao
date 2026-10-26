import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chapters, journeyChapters, stories } from './chapters';

describe('journey chapters', () => {
  it('has the five chapters the window has tabs for', () => {
    expect(journeyChapters).toHaveLength(5);
    for (const chapter of journeyChapters) {
      expect(chapter.title.length).toBeGreaterThan(0);
      expect(chapter.paragraphs.length).toBeGreaterThan(0);
    }
  });

  it('derives one phone story per paragraph, with an image that exists', () => {
    const paragraphs = journeyChapters.flatMap((c) => c.paragraphs);
    expect(stories.map((s) => s.paragraph)).toEqual(paragraphs);
    for (const story of stories) {
      expect(existsSync(join(process.cwd(), 'public', story.image))).toBe(true);
    }
  });

  it('numbers phone chapters from 1 and tags each story with its chapter', () => {
    expect(chapters.map((c) => c.number)).toEqual([
      'CHAPTER 1',
      'CHAPTER 2',
      'CHAPTER 3',
      'CHAPTER 4',
      'CHAPTER 5',
    ]);
    expect(stories[0]).toMatchObject({ chapterIndex: 0, storyIndexInChapter: 0 });
    expect(stories.at(-1)).toMatchObject({ chapterIndex: 4 });
  });
});
