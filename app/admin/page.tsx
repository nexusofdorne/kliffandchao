import { GuestTable } from '@/components/admin/GuestTable';
import { StatsSummary } from '@/components/admin/StatsSummary';
import { getAdminDashboardData } from '@/lib/admin/dashboard';
import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { signOutAdmin } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const email = await requireAdmin();
  const { tally, guests } = await getAdminDashboardData(prisma);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Guest list</h1>
          <p className="text-sm text-muted-foreground">Signed in as {email}</p>
        </div>
        <form action={signOutAdmin}>
          <button type="submit" className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground">
            Sign out
          </button>
        </form>
      </header>

      <StatsSummary tally={tally} />
      <GuestTable guests={guests} />
    </div>
  );
}
