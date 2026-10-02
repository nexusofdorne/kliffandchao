'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

// Plain email/password, not the wedding site's glass styling: this screen
// is only ever seen by the couple, from an address bar, not linked from
// anywhere guest-facing — docs/BUILD_PLAN.md keeps app/admin generic rather
// than themed to one project.
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setSubmitting(false);
      setError('Incorrect email or password.');
      return;
    }

    // Supabase's browser client already wrote the session cookie via
    // document.cookie by the time signInWithPassword() resolves, so the
    // RSC fetch this triggers carries it the same as any other request —
    // requireAdmin() on the other end sees it immediately.
    router.push('/admin');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6">
        <h1 className="text-lg font-semibold text-foreground">Admin sign in</h1>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm text-muted-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm text-muted-foreground">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
