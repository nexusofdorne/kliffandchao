'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  changeSitePassword,
  setPasswordOpen,
  setRsvpClosed,
  signEveryoneOut,
  type SettingsActionState,
} from '@/app/admin/actions';

type SiteSettingsPanelProps = {
  passwordOpen: boolean;
  rsvpClosed: boolean;
  passwordFromAdmin: boolean;
  updatedAt: Date | null;
  updatedBy: string | null;
};

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground';
const buttonClass = 'rounded-md border border-input px-3 py-1.5 text-sm text-foreground disabled:opacity-50';

function Switch({
  label,
  description,
  on,
  onChange,
}: {
  label: string;
  description: string;
  on: boolean;
  onChange: (on: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useState(on);
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        disabled={pending}
        onClick={() => {
          const next = !shown;
          setShown(next);
          startTransition(() => onChange(next));
        }}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          shown ? 'bg-emerald-600' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            shown ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </label>
  );
}

function Result({ state }: { state: SettingsActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-destructive'}`}>
      {state.message}
    </p>
  );
}

// /admin's settings: the two switches (portfolio mode is both on), the site password, and
// signing every guest out. Each change saves at once; the actions are app/admin/actions.ts.
export function SiteSettingsPanel({ passwordOpen, rsvpClosed, passwordFromAdmin, updatedAt, updatedBy }: SiteSettingsPanelProps) {
  const [passwordState, savePassword, savingPassword] = useActionState(changeSitePassword, null);
  const [signOutState, setSignOutState] = useState<SettingsActionState>(null);
  const [signingOut, startSignOut] = useTransition();

  return (
    <section className="space-y-4 rounded-lg border border-border p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Site settings</h2>
        <p className="text-xs text-muted-foreground">
          Changes take effect straight away.
          {updatedAt && ` Last changed ${DATE_FORMAT.format(updatedAt)}${updatedBy ? ` by ${updatedBy}` : ''}.`}
        </p>
      </div>

      <div className="divide-y divide-border">
        <Switch
          label="Skip the password"
          description="The password screen types it in by itself and anyone can press Enter. For the portfolio, after the wedding."
          on={passwordOpen}
          onChange={setPasswordOpen}
        />
        <Switch
          label="Close RSVP submissions"
          description="Visitors can still search, see their household and fill in the form, but can't send it."
          on={rsvpClosed}
          onChange={setRsvpClosed}
        />
      </div>

      <form action={savePassword} className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-foreground">Change the site password</h3>
        <p className="text-xs text-muted-foreground">
          {passwordFromAdmin ? 'Set here.' : 'Currently the original password from the site setup.'} Not case-sensitive.
          Guests already signed in stay signed in.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input name="password" type="password" autoComplete="new-password" placeholder="New password" aria-label="New password" required className={inputClass} />
          <input name="confirm" type="password" autoComplete="new-password" placeholder="Type it again" aria-label="Type the new password again" required className={inputClass} />
          <button type="submit" disabled={savingPassword} className={buttonClass}>
            {savingPassword ? 'Saving…' : 'Save password'}
          </button>
        </div>
        <Result state={passwordState} />
      </form>

      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium text-foreground">Sign everyone out</h3>
        <p className="text-xs text-muted-foreground">
          Every guest has to enter the password again (with the gate open, they just press Enter).
        </p>
        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            if (!window.confirm('Sign every guest out? They will need the password again.')) return;
            startSignOut(async () => setSignOutState(await signEveryoneOut()));
          }}
          className={buttonClass}
        >
          {signingOut ? 'Signing out…' : 'Sign everyone out'}
        </button>
        <Result state={signOutState} />
      </div>
    </section>
  );
}
