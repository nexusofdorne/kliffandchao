import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import type {
  SceneBox,
  SceneImage,
  SceneLayer,
} from '@/lib/scene/layers';

/** A layer's place on the stage, as CSS. Positions are % of the 16:9 stage. */
export function boxStyle(box: SceneBox): CSSProperties {
  return {
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.w}%`,
    height: `${box.h}%`,
  };
}

/**
 * A 16:9 box that covers the viewport (cropping the long side), holding layers
 * positioned in percentages. `container-type: size` lets text inside use cqw.
 */
export function Stage({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`stage ${className}`} style={style}>
      {children}
    </div>
  );
}

// The layers are already cut and compressed offline (scripts/design), so they
// are served as they are: the optimizer would re-encode soft alpha edges.
/** An image placed on the stage from the manifest. */
export function StageLayer({
  asset,
  alt = '',
  className = '',
  style,
  priority = false,
  ...data
}: {
  asset: SceneLayer;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
} & { [K in `data-${string}`]?: string }) {
  return (
    <Image
      src={asset.src}
      alt={alt}
      width={asset.px[0]}
      height={asset.px[1]}
      unoptimized
      priority={priority}
      draggable={false}
      className={`stage-layer ${className}`}
      style={{ ...boxStyle(asset), ...style }}
      {...data}
    />
  );
}

/** A full-stage image (a background). */
export function StageFill({
  asset,
  alt = '',
  className = '',
  style,
  priority = false,
  ...data
}: {
  asset: SceneImage;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
} & { [K in `data-${string}`]?: string }) {
  return (
    <Image
      src={asset.src}
      alt={alt}
      width={asset.px[0]}
      height={asset.px[1]}
      unoptimized
      priority={priority}
      draggable={false}
      className={`stage-fill ${className}`}
      style={style}
      {...data}
    />
  );
}
