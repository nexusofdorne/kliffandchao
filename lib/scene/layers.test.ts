import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sceneAssets } from '../../config/scene-layers.generated';
import { journeyMedia } from '../../config/journey-media.generated';
import { worldLayers } from '../../config/world-layers.generated';
import { isInsideStage, type SceneLayer } from './layers';

const publicDir = join(process.cwd(), 'public');

/** Every image the manifest names, wherever it sits in the structure. */
function allSources(): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.src === 'string') out.push(record.src);
      Object.values(record).forEach(walk);
    }
  };
  walk(sceneAssets);
  return out;
}

describe('scene layer manifest', () => {
  it('only names files that exist under public/', () => {
    const sources = allSources();
    expect(sources.length).toBeGreaterThan(10);
    for (const src of sources) {
      const file = join(publicDir, src);
      expect(existsSync(file), src).toBe(true);
      expect(statSync(file).size, src).toBeGreaterThan(0);
    }
  });

  it('keeps every placed layer inside the stage, apart from the sky margin', () => {
    const placed = Object.entries(sceneAssets).filter(
      ([, v]) => 'src' in v && 'w' in v && 'h' in v && 'x' in v,
    ) as [string, SceneLayer][];
    expect(placed.length).toBeGreaterThan(10);
    for (const [key, layer] of placed) {
      if (key === 's01_sky') continue; // padded on purpose so clouds can drift
      expect(isInsideStage(layer), key).toBe(true);
    }
  });

  it('has the films and photos of the five chapters on disk, in order', () => {
    expect(journeyMedia).toHaveLength(5);
    expect(journeyMedia[3].photos).toHaveLength(9);
    for (const chapter of journeyMedia) {
      const files = [
        ...(chapter.film ? [chapter.film] : []),
        ...chapter.photos,
      ];
      for (const item of files)
        expect(existsSync(join(publicDir, item.src)), item.src).toBe(true);
    }
  });
});

describe('world layers', () => {
  it('has the depth layers for the meadow and the river, all on disk', () => {
    const depth = ['sky', 'far', 'mid', 'near', 'fore'];
    expect(worldLayers.journey.layers.map((l) => l.kind)).toEqual(depth);
    // the river also has its ripple highlights
    expect(worldLayers.wedding.layers.map((l) => l.kind)).toEqual([
      ...depth,
      'glint',
    ]);
    for (const scene of [worldLayers.journey, worldLayers.wedding]) {
      for (const layer of scene.layers) {
        const file = join(publicDir, layer.src);
        expect(existsSync(file), layer.src).toBe(true);
        expect(statSync(file).size, layer.src).toBeGreaterThan(0);
      }
    }
  });
});

describe('isInsideStage', () => {
  it('accepts boxes on the edge and rejects ones that spill over', () => {
    expect(isInsideStage({ x: 0, y: 0, w: 100, h: 100 })).toBe(true);
    expect(isInsideStage({ x: -1, y: 0, w: 50, h: 50 })).toBe(false);
    expect(isInsideStage({ x: 60, y: 0, w: 41, h: 10 })).toBe(false);
  });
});
