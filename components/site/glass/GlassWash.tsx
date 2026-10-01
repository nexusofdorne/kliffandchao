// backdrop-filter has nothing to refract over a flat fill — light glass on a
// plain colour renders as grey haze. A heavily blurred, desaturated copy of
// a photo gives `.glass-light` surfaces something to pick up while staying
// quiet enough to read body text over — prototype/index.html's #wedding::before.
// Mounted by WeddingPanel (Step 6); built now alongside the other glass
// primitives per docs/BUILD_PLAN.md Phase 4 step 3.
export function GlassWash({ imageSrc }: { imageSrc: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 opacity-[.34] [filter:blur(52px)_saturate(.6)_brightness(1.75)]"
      style={{
        backgroundImage: [
          'radial-gradient(120% 90% at 82% 6%, rgba(157,203,90,.42), transparent 58%)',
          'radial-gradient(90% 75% at 4% 98%, rgba(79,122,34,.30), transparent 56%)',
          `url(${imageSrc})`,
        ].join(', '),
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
