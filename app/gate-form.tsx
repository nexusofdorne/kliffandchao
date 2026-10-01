'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

// Unstyled for Phase 2 — components/site/gate/GateScreen.tsx replaces this
// in Phase 4 (styling, the 0-100 loader, the audio gesture).
export function GateForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch('/api/gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      router.push(next);
      return;
    }

    setPending(false);
    setError('Wrong password.');
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="password">PASSWORD</label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button type="submit" disabled={pending}>
        ENTER
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
