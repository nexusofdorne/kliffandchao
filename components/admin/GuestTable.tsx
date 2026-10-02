import Link from 'next/link';
import type { AdminGuestRow } from '@/lib/admin/dashboard';

type GuestTableProps = { guests: AdminGuestRow[] };

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_LABEL: Record<string, string> = {
  ATTENDING: 'Attending',
  NOT_ATTENDING: 'Not attending',
};

const STATUS_CLASSNAME: Record<string, string> = {
  ATTENDING: 'bg-emerald-100 text-emerald-800',
  NOT_ATTENDING: 'bg-rose-100 text-rose-800',
};

export function GuestTable({ guests }: GuestTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Guest</th>
            <th className="px-4 py-3 font-medium">Household</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Answered by</th>
            <th className="px-4 py-3 font-medium">Responded</th>
          </tr>
        </thead>
        <tbody>
          {guests.map((guest) => (
            <tr key={guest.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-foreground">{guest.displayName}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/parties/${guest.partyId}`} className="text-foreground underline underline-offset-2">
                  {guest.partyLabel}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    guest.status ? STATUS_CLASSNAME[guest.status] : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {guest.status ? STATUS_LABEL[guest.status] : 'Pending'}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{guest.answeredByDisplayName ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {guest.respondedAt ? DATE_FORMAT.format(guest.respondedAt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
