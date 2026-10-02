import type { AttendanceTally } from '@/lib/admin/stats';

type StatsSummaryProps = { tally: AttendanceTally };

const STAT_LABELS: { key: keyof AttendanceTally; label: string }[] = [
  { key: 'invited', label: 'Invited' },
  { key: 'households', label: 'Households' },
  { key: 'attending', label: 'Attending' },
  { key: 'notAttending', label: 'Not attending' },
  { key: 'pending', label: 'Pending' },
];

export function StatsSummary({ tally }: StatsSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {STAT_LABELS.map(({ key, label }) => (
        <div key={key} className="rounded-lg border border-border p-4">
          <div className="text-2xl font-semibold text-foreground">{tally[key]}</div>
          <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
        </div>
      ))}
    </div>
  );
}
