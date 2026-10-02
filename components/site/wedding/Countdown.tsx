'use client';

import { useEffect, useState } from 'react';
import { siteConfig } from '@/config/site';
import { computeCountdown, type Countdown as CountdownValue } from '@/lib/wedding/countdown';

const TARGET = new Date(siteConfig.weddingDateTime);

const UNITS: { key: keyof CountdownValue; label: string; pad: boolean }[] = [
  { key: 'months', label: 'MONTHS', pad: false },
  { key: 'days', label: 'DAYS', pad: false },
  { key: 'hours', label: 'HOURS', pad: true },
  { key: 'minutes', label: 'MINUTES', pad: true },
  { key: 'seconds', label: 'SECONDS', pad: true },
];

function format(value: number, pad: boolean): string {
  return pad ? String(value).padStart(2, '0') : String(value);
}

// Computed client-side only, after mount — a live timer rendered on the
// server guarantees a hydration mismatch. Starts as an em dash per unit so
// there's no flash of "0" before the first tick — prototype/index.html's
// tickCountdown().
export function Countdown() {
  const [value, setValue] = useState<CountdownValue | null>(null);

  useEffect(() => {
    function tick() {
      setValue(computeCountdown(TARGET, new Date()));
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="my-[3.2vh] flex flex-wrap justify-center gap-[clamp(7px,1.1vw,16px)]">
      {UNITS.map((unit) => (
        <div
          key={unit.key}
          className="glass-light flex min-w-[clamp(58px,7.4vw,96px)] flex-col gap-[.6vh] rounded-[14px] px-[clamp(11px,1.5vw,24px)] py-[clamp(9px,1.4vh,17px)] max-[768px]:min-w-0 max-[768px]:flex-1 max-[768px]:basis-[52px] max-[768px]:px-[.5rem]"
        >
          <b className="text-[clamp(20px,3.9vh,44px)] font-semibold leading-none tracking-[-.02em] [font-variant-numeric:tabular-nums]">
            {value ? format(value[unit.key], unit.pad) : '—'}
          </b>
          <span className="text-[8.5px] tracking-[.14em] text-[rgba(0,0,0,.5)]">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}
