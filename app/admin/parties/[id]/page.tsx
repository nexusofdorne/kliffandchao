import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PartyHistory } from '@/components/admin/PartyHistory';
import { getPartyHistory } from '@/lib/admin/dashboard';
import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminPartyHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const history = await getPartyHistory(prisma, id);
  if (!history) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link href="/admin" className="text-sm text-muted-foreground underline underline-offset-2">
          ← Back to guest list
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">{history.partyLabel}</h1>
      </div>

      <PartyHistory history={history} />
    </div>
  );
}
