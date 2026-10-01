import type { ReactNode } from 'react';
import { requireGate } from '@/lib/auth/require-gate';

export default async function GatedLayout({ children }: { children: ReactNode }) {
  await requireGate();
  return children;
}
