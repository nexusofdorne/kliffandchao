'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type SyncResult = { partiesUpserted: number; guestsUpserted: number; archived: number };

// The admin-triggered full pull — docs/BUILD_PLAN.md "Sheet -> DB": the
// only place a guest removed from the sheet gets archived, since the
// Apps Script webhook's onEdit never fires on row deletion.
export function SyncNowButton() {
  const router = useRouter();
  const [state, setState] = useState<{ status: 'idle' } | { status: 'syncing' } | { status: 'done'; result: SyncResult } | { status: 'error'; message: string }>({ status: 'idle' });

  async function handleClick() {
    setState({ status: 'syncing' });
    const response = await fetch('/api/admin/sync', { method: 'POST' });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setState({ status: 'error', message: body?.message ?? body?.error ?? 'Sync failed.' });
      return;
    }
    const result = (await response.json()) as SyncResult;
    setState({ status: 'done', result });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={state.status === 'syncing'}
        className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
      >
        {state.status === 'syncing' ? 'Syncing…' : 'Sync now'}
      </button>
      {state.status === 'done' && (
        <span className="text-xs text-muted-foreground">
          {state.result.guestsUpserted} guests, {state.result.archived} archived
        </span>
      )}
      {state.status === 'error' && <span className="text-xs text-destructive">{state.message}</span>}
    </div>
  );
}
