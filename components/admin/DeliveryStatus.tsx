'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import type { getOutstandingDeliveries } from '@/lib/rsvp/deliveries';

type DeliveryData = Awaited<ReturnType<typeof getOutstandingDeliveries>>;

export function DeliveryStatus({ data }: { data: DeliveryData }) {
  const router = useRouter();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function retry(deliveryId: string) {
    setRetryingId(deliveryId);
    setMessage('');
    try {
      const response = await fetch('/api/admin/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId }),
      });
      setMessage(
        response.ok
          ? 'Delivery completed.'
          : 'Delivery did not complete. Check its status and try again later.',
      );
    } catch {
      setMessage(
        'Connection lost. Refresh to check the delivery before retrying.',
      );
    } finally {
      setRetryingId(null);
      router.refresh();
    }
  }

  return (
    <section className="space-y-3 rounded-md border border-input p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">RSVP deliveries</h2>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-sm underline"
        >
          Refresh status
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        {data.total === 0
          ? 'No outstanding deliveries.'
          : `${data.total} outstanding. RSVP answers are saved even if an email or spreadsheet update fails.`}
      </p>
      {data.records.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Household</th>
                <th className="p-2">Destination</th>
                <th className="p-2">Status</th>
                <th className="p-2">Attempts</th>
                <th className="p-2">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((record) => (
                <tr key={record.id} className="border-t border-input">
                  <td className="p-2">{record.partyLabel}</td>
                  <td className="p-2">
                    {record.channel === 'EMAIL' ? 'Email' : 'Sheets'}
                  </td>
                  <td className="p-2">
                    {record.status === 'REVIEW'
                      ? 'Check Resend before sending manually'
                      : record.status.toLowerCase()}
                  </td>
                  <td className="p-2">{record.attempts}</td>
                  <td className="p-2">
                    {record.retryable && (
                      <button
                        type="button"
                        disabled={retryingId !== null}
                        onClick={() => void retry(record.id)}
                        className="rounded-md border border-input px-3 py-1 disabled:opacity-50"
                      >
                        {retryingId === record.id ? 'Retrying...' : 'Retry'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.pages > 1 && (
        <nav
          aria-label="Delivery pages"
          className="flex items-center gap-4 text-sm"
        >
          {data.page > 1 && (
            <Link
              href={`/admin?deliveriesPage=${data.page - 1}`}
              className="underline"
            >
              Previous
            </Link>
          )}
          <span>
            Page {data.page} of {data.pages}
          </span>
          {data.page < data.pages && (
            <Link
              href={`/admin?deliveriesPage=${data.page + 1}`}
              className="underline"
            >
              Next
            </Link>
          )}
        </nav>
      )}
      <p role="status" className="text-sm text-muted-foreground">
        {message}
      </p>
    </section>
  );
}
