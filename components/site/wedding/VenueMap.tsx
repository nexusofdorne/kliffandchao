'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { siteConfig } from '@/config/site';

const MAP_ZOOM = 15;
const INVALIDATE_DELAY_MS = 150;

type VenueMapProps = { active: boolean };

// Leaflet + plain OpenStreetMap tiles — no API key, no billing account.
// docs/PLAN.md "The map is embedded, not a link out": the keyless Google
// Maps Embed form silently rendered a blank box, and CARTO's basemaps now
// return an "API KEY REQUIRED" watermark tile that still passes every
// naive "did it load" check (HTTP 200, a valid image, non-zero size).
export function VenueMap({ active }: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Initialise lazily, only once the DETAIL tab has actually been shown:
  // Leaflet mis-measures a container that was hidden at init and renders a
  // quarter-map. Once created, the map is never destroyed on a later tab
  // switch — WeddingPanel keeps every tab mounted and only toggles CSS
  // display, exactly like prototype/index.html's initMap(), so recreating
  // it here would be wasted work for no visible difference.
  useEffect(() => {
    if (!active || initializedRef.current) return;
    const container = containerRef.current;
    if (!container || !container.clientWidth) return;

    // Marked only once the import actually resolves, not before: React
    // Strict Mode's dev-only mount→cleanup→remount runs the cleanup
    // synchronously, long before this promise settles. Flagging
    // "initialized" up front meant the mount that started the real import
    // got cancelled by its own cleanup, while the remount saw the flag
    // already set and skipped entirely — the map never got created at
    // all. Checking the flag again inside the resolved callback is what
    // lets whichever mount survives actually win the race.
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || initializedRef.current) return;
      initializedRef.current = true;
      const { lat, lng } = siteConfig.venueCoordinates;
      // Page scroll must not zoom the map — dragging still works.
      const map = L.map(container, { scrollWheelZoom: false }).setView([lat, lng], MAP_ZOOM);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        crossOrigin: 'anonymous',
      }).addTo(map);
      L.marker([lat, lng], {
        icon: L.divIcon({ className: 'venue-pin', html: '<span></span>', iconSize: [15, 15], iconAnchor: [8, 8] }),
      })
        .addTo(map)
        .bindPopup(`<b>${siteConfig.venueName}</b><br>${siteConfig.weddingDateDisplay}`);
      setTimeout(() => map.invalidateSize(), INVALIDATE_DELAY_MS);
    });

    return () => {
      cancelled = true;
    };
  }, [active]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Map showing ${siteConfig.venueName}, ${siteConfig.venueLocation}`}
      className="aspect-[5/2] w-full rounded-[24px] bg-[#e7e9e2] [&_.leaflet-container]:font-sans [&_.leaflet-tile-pane]:[filter:grayscale(.85)_contrast(.92)_brightness(1.04)] max-[768px]:aspect-[4/3]"
    />
  );
}
