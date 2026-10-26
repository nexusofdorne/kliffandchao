'use client';

import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { SceneId } from '@/lib/scene/machine';
import { useScene } from './SceneProvider';

const HIDDEN: CSSProperties = { visibility: 'hidden', opacity: 0 };

/** One full-screen scene. Hidden until a transition shows it; z orders the stack. */
export function SceneRoot({
  id,
  visible = false,
  clear = false,
  ambient,
  z,
  rootRef,
  children,
}: {
  id: SceneId | 'arrival' | 'world';
  visible?: boolean;
  /** A scene that only holds interface over the world (no background of its own). */
  clear?: boolean;
  /** Colours above and below the stage, where it doesn't fill the screen (tall screens). */
  ambient?: { top: string; bottom: string };
  z?: number;
  rootRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const { registerScene } = useScene();
  return (
    <section
      ref={(el) => {
        if (rootRef) rootRef.current = el;
        if (id !== 'arrival' && id !== 'world') registerScene(id, el);
      }}
      data-scene={id}
      aria-label={id}
      className={clear ? 'scene-root scene-root--clear' : 'scene-root'}
      style={{ ...(visible ? undefined : HIDDEN), zIndex: z }}
    >
      {ambient && (
        <div
          aria-hidden
          className="scene-ambient"
          style={{ '--amb-top': ambient.top, '--amb-bottom': ambient.bottom } as CSSProperties}
        />
      )}
      {children}
    </section>
  );
}
