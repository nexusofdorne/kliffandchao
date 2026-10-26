'use client';

import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { SceneId } from '@/lib/scene/machine';
import { useScene } from './SceneProvider';

const HIDDEN: CSSProperties = { visibility: 'hidden', opacity: 0 };

/** One full-screen scene. Hidden until a transition shows it; z orders the stack. */
export function SceneRoot({
  id,
  visible = false,
  z,
  rootRef,
  children,
}: {
  id: SceneId | 'arrival';
  visible?: boolean;
  z?: number;
  rootRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const { registerScene } = useScene();
  return (
    <section
      ref={(el) => {
        if (rootRef) rootRef.current = el;
        if (id !== 'arrival') registerScene(id, el);
      }}
      data-scene={id}
      aria-label={id}
      className="scene-root"
      style={{ ...(visible ? undefined : HIDDEN), zIndex: z }}
    >
      {children}
    </section>
  );
}
