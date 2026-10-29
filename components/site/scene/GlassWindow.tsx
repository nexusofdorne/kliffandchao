'use client';

import type { CSSProperties, ReactNode, Ref } from 'react';
import { stageBox, type GlassWindowSpec } from '@/config/glass-windows';

// The frosted window both folders open: a milky glass body with a set-in plate,
// a row of tabs (the raised one joins the body) and three traffic lights. It is
// all CSS (`.gw*` in app/globals.css), laid out in the mockup's pixels.
//
// The layers fade with `--win-o` instead of `opacity` on the window itself: an
// element that is not fully opaque (or has a filter) stops its children's
// backdrop-filter from seeing the meadow, so the glass would flatten while it
// opens and snap frosted at the end. Animate `--win-o` and `transform` only.

export type GlassTab = {
  id: string;
  label: string;
  /** The id of the panel this tab shows, for assistive tech. */
  controls?: string;
};

/** How far a tab reaches down over the body's top edge, in mockup px. */
const OVERLAP = 4;

type Vars = CSSProperties & Record<`--${string}`, string>;

const px = (n: number) => `calc(var(--px) * ${n})`;

export function GlassWindow({
  ref,
  spec,
  label,
  tabs,
  selected,
  onSelect,
  onClose,
  children,
}: {
  ref?: Ref<HTMLDivElement>;
  spec: GlassWindowSpec;
  /** The dialog's accessible name. */
  label: string;
  tabs: readonly GlassTab[];
  /** The raised tab's index, or -1 for none. */
  selected: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  /** The window's content, laid out in % of the window's box. */
  children?: ReactNode;
}) {
  const { box, body, inset } = spec;
  const bottom = body.y0 - box.y + OVERLAP;
  const tabVars = {
    '--t-idle': px(spec.tabTop.idle - box.y),
    '--t-on': px(spec.tabTop.on - box.y),
    '--t-bottom': px(bottom),
  };
  const place = (x0: number, x1: number): Vars => ({
    left: px(x0 - box.x),
    width: px(x1 - x0),
    ...tabVars,
  });
  const stage = stageBox(spec);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="gw"
      style={{
        left: `${stage.x}%`,
        top: `${stage.y}%`,
        width: `${stage.w}%`,
        height: `${stage.h}%`,
        visibility: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        className="gw-shell"
        style={{
          left: px(body.x0 - box.x),
          top: px(body.y0 - box.y),
          width: px(body.x1 - body.x0),
          height: px(body.y1 - body.y0),
        }}
      />
      <div
        aria-hidden="true"
        className="gw-plate"
        style={{
          left: px(body.x0 + inset - box.x),
          top: px(body.y0 + inset - box.y),
          width: px(body.x1 - body.x0 - inset * 2),
          height: px(body.y1 - body.y0 - inset * 2),
        }}
      />

      <div className="gw-seg gw-seg--lights" style={place(...spec.lights)}>
        <button
          type="button"
          aria-label="Close window"
          className="gw-light gw-light--r"
          onClick={onClose}
        />
        <i aria-hidden="true" className="gw-light gw-light--y" />
        <i aria-hidden="true" className="gw-light gw-light--g" />
      </div>

      <div role="tablist" aria-label={label} className="gw-tabs">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected === i}
            aria-controls={tab.controls}
            onClick={() => onSelect(i)}
            className="gw-seg gw-tab"
            style={place(...spec.tabs[i])}
          >
            <i aria-hidden="true" className="gw-dot" />
            <span className="gw-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {spec.trail ? (
        <div
          aria-hidden="true"
          className="gw-seg gw-seg--trail"
          style={place(...spec.trail)}
        />
      ) : null}

      <div className="gw-content">{children}</div>
    </div>
  );
}
