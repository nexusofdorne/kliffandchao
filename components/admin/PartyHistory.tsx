import type { PartyHistory as PartyHistoryData } from '@/lib/admin/dashboard';

type PartyHistoryProps = { history: PartyHistoryData };

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const STATUS_LABEL: Record<string, string> = {
  ATTENDING: 'Attending',
  NOT_ATTENDING: 'Not attending',
};

// Newest first, every submission the party has ever made — the point of
// keeping RsvpSubmission as immutable history (docs/BUILD_PLAN.md) is that
// nothing here is ever overwritten, so a dispute or a mistaken edit is
// always recoverable from this view.
export function PartyHistory({ history }: PartyHistoryProps) {
  if (history.submissions.length === 0) {
    return <p className="text-sm text-muted-foreground">No submissions yet.</p>;
  }

  return (
    <div className="space-y-4">
      {history.submissions.map((submission, index) => (
        <div key={submission.id} className="rounded-lg border border-border p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {index === 0 ? 'Latest submission' : 'Earlier submission'} — {submission.submittedByDisplayName}
            </span>
            <span className="text-muted-foreground">{DATE_TIME_FORMAT.format(submission.createdAt)}</span>
          </div>
          <ul className="space-y-1 text-sm">
            {submission.responses.map((response) => (
              <li key={response.guestDisplayName} className="flex justify-between text-foreground">
                <span>{response.guestDisplayName}</span>
                <span className="text-muted-foreground">{STATUS_LABEL[response.status]}</span>
              </li>
            ))}
          </ul>
          {submission.message && (
            <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground italic">
              &ldquo;{submission.message}&rdquo;
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
