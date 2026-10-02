'use client';

import { useEffect, useRef, useState } from 'react';

export type GuestSearchResult = { id: string; displayName: string };

const DEBOUNCE_MS = 150;
const MIN_QUERY_LENGTH = 2;

type GuestSearchProps = {
  onSelectGuest: (guest: GuestSearchResult) => void;
};

// Server-side search only — never ship the guest list to the client
// (docs/PLAN.md "Name matching"). Debounced 150ms with an AbortController
// per keystroke, so a fast typist's stale requests can't land out of
// order — prototype/index.html's typeahead, pointed at the real endpoint
// instead of a mock list.
export function GuestSearch({ onSelectGuest }: GuestSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GuestSearchResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // GuestSearch stays mounted for the rest of the RSVP flow (the party
  // form renders below it, not instead of it), so without this the
  // dropdown from the last search just sat there forever after a guest
  // was picked.
  function handleSelect(guest: GuestSearchResult) {
    abortRef.current?.abort();
    setQuery('');
    setResults(null);
    setFailed(false);
    onSelectGuest(guest);
  }

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      // queueMicrotask, not a direct call: react-hooks/set-state-in-effect
      // flags setState called synchronously in the effect body itself.
      queueMicrotask(() => {
        setResults(null);
        setFailed(false);
      });
      return;
    }

    const timeout = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/guests/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error('search_failed');
          return response.json() as Promise<GuestSearchResult[]>;
        })
        .then((data) => {
          setResults(data);
          setFailed(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setResults([]);
          setFailed(true);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div>
      <label htmlFor="guest-search" className="mb-[1.3vh] block text-[9.5px] tracking-[.14em] opacity-65">
        LAST NAME
      </label>
      <input
        id="guest-search"
        type="text"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="e.g. Kho"
        className="glass h-[56px] w-full rounded-full px-[24px] text-[max(16px,14px)] tracking-[.06em] text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-white/40 focus:border-[rgba(255,255,255,.55)] focus:shadow-[var(--glass-shadow),0_0_0_4px_rgba(157,203,90,.16)]"
      />
      {results && (
        <div className="mt-[9px] overflow-hidden rounded-[22px] border border-[var(--glass-rim)] bg-[rgba(18,24,12,.72)] shadow-[var(--glass-shadow)] backdrop-blur-[20px] backdrop-saturate-150">
          {results.length > 0 ? (
            results.map((guest) => (
              <button
                key={guest.id}
                type="button"
                onClick={() => handleSelect(guest)}
                className="block w-full border-t border-white/[.08] px-[22px] py-[15px] text-left text-[13px] tracking-[.05em] text-white transition-colors duration-150 first:border-t-0 hover:bg-white/10"
              >
                {guest.displayName}
              </button>
            ))
          ) : (
            <div className="px-[22px] py-[15px] text-left text-[13px] tracking-[.05em] text-white opacity-45">
              {failed ? 'Something went wrong — try again in a moment.' : 'No match — check the spelling or ask the couple'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
