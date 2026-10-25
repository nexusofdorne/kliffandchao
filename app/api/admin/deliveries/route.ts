import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { deliverRsvpDelivery } from '@/lib/rsvp/deliveries';
import { retryDeliverySchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const parsed = retryDeliverySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  try {
    const outcome = await deliverRsvpDelivery(prisma, parsed.data.deliveryId);
    const status =
      outcome === 'missing'
        ? 404
        : outcome === 'failed'
          ? 502
          : outcome === 'busy' || outcome === 'review'
            ? 409
            : 200;
    return NextResponse.json({ outcome }, { status });
  } catch {
    console.error('Admin delivery retry interrupted', {
      deliveryId: parsed.data.deliveryId,
    });
    return NextResponse.json({ error: 'retry_failed' }, { status: 500 });
  }
}
