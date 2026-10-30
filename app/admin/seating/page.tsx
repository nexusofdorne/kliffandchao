import { SeatingPlanner } from '@/components/admin/seating/SeatingPlanner';
import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { loadSeating } from '@/lib/seating/store';

export const dynamic = 'force-dynamic';

export default async function SeatingPage() {
  await requireAdmin();
  const { state, guests } = await loadSeating(prisma);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <SeatingPlanner initialState={state} initialGuests={guests} />
    </div>
  );
}
