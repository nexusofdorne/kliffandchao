import Link from 'next/link';
import { GuestTable } from '@/components/admin/GuestTable';
import { SiteSettingsPanel } from '@/components/admin/SiteSettingsPanel';
import { DeliveryStatus } from '@/components/admin/DeliveryStatus';
import { StatsSummary } from '@/components/admin/StatsSummary';
import { SyncNowButton } from '@/components/admin/SyncNowButton';
import { getAdminDashboardData } from '@/lib/admin/dashboard';
import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { getOutstandingDeliveries } from '@/lib/rsvp/deliveries';
import { getSiteSettings } from '@/lib/settings/site-settings';
import { signOutAdmin } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage({ searchParams }: PageProps<'/admin'>) {
  const email = await requireAdmin();
  const { tally, guests } = await getAdminDashboardData(prisma);
  const params = await searchParams;
  const requestedPage =
    typeof params.deliveriesPage === 'string'
      ? Number(params.deliveriesPage)
      : 1;
  const deliveries = await getOutstandingDeliveries(prisma, requestedPage);
  const settings = await getSiteSettings();

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Guest list</h1>
          <p className="text-sm text-muted-foreground">Signed in as {email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/seating" className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground">
            Seating plan
          </Link>
          <SyncNowButton />
          <form action={signOutAdmin}>
            <button
              type="submit"
              className="rounded-md border border-input px-3 py-1.5 text-sm text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <StatsSummary tally={tally} />
      <DeliveryStatus data={deliveries} />
      <GuestTable guests={guests} />
      <SiteSettingsPanel
        passwordOpen={settings.passwordOpen}
        rsvpClosed={settings.rsvpClosed}
        passwordFromAdmin={settings.passwordFromAdmin}
        updatedAt={settings.updatedAt}
        updatedBy={settings.updatedBy}
      />
    </div>
  );
}
