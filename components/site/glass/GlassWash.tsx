type GlassWashProps = {
  imageSrc: string;
  gradients?: string[];
  filter?: string;
  opacity?: number;
  fixed?: boolean;
};

// backdrop-filter has nothing to refract over a flat fill — light glass on a
// plain colour renders as grey haze. A heavily blurred, desaturated copy of
// a photo gives glass surfaces something to pick up while staying quiet
// enough to read body text over — prototype/index.html's #wedding::before
// and #rsvp::before, which use the same technique with different filter
// values (the RSVP overlay's wash is darker and more desaturated, to sit
// behind the dark `.glass` tint instead of `.glass-light`).
export function GlassWash({
  imageSrc,
  gradients = [
    'radial-gradient(120% 90% at 82% 6%, rgba(157,203,90,.42), transparent 58%)',
    'radial-gradient(90% 75% at 4% 98%, rgba(79,122,34,.30), transparent 56%)',
  ],
  filter = 'blur(52px) saturate(.6) brightness(1.75)',
  opacity = 0.34,
  fixed = false,
}: GlassWashProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none inset-0 z-0 ${fixed ? 'fixed' : 'absolute'}`}
      style={{
        opacity,
        filter,
        backgroundImage: [...gradients, `url(${imageSrc})`].join(', '),
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
