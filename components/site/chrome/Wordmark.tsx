import type { CSSProperties, HTMLAttributes } from 'react';

// The couple's marks (3.0 elements): the "KLIFF & CHAO" wordmark and the flourish monogram.
// Each is a white silhouette used as a CSS mask over `currentColor`, so like an inline SVG it
// takes the colour of whatever it sits in (white on the scenes, dark on light chrome).
const MARKS = {
  names: { src: '/img/brand/kc-names.webp', aspect: 900 / 373 },
  icon: { src: '/img/brand/kc-icon.webp', aspect: 900 / 511 },
} as const;

type MarkProps = HTMLAttributes<HTMLSpanElement> & {
  /** Hidden from assistive tech (the default); set false where the mark is the only name shown. */
  decorative?: boolean;
};

function Mark({
  kind,
  decorative = true,
  style,
  ...props
}: MarkProps & { kind: keyof typeof MARKS }) {
  const mark = MARKS[kind];
  const maskStyle: CSSProperties = {
    display: 'block',
    aspectRatio: String(mark.aspect),
    backgroundColor: 'currentColor',
    maskImage: `url(${mark.src})`,
    maskSize: '100% 100%',
    maskRepeat: 'no-repeat',
    WebkitMaskImage: `url(${mark.src})`,
    WebkitMaskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    ...style,
  };
  return decorative ? (
    <span aria-hidden="true" style={maskStyle} {...props} />
  ) : (
    <span role="img" aria-label="Kliff and Chao" style={maskStyle} {...props} />
  );
}

/** "KLIFF & CHAO". */
export function Wordmark(props: MarkProps) {
  return <Mark kind="names" {...props} />;
}

/** The flourish monogram. */
export function Monogram(props: MarkProps) {
  return <Mark kind="icon" {...props} />;
}
