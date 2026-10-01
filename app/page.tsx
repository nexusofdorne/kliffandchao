import { GateScreen } from '@/components/site/gate/GateScreen';
import { isSafeNextPath } from '@/lib/auth/safe-next';

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedNext = typeof params.next === 'string' ? params.next : undefined;
  const next = requestedNext && isSafeNextPath(requestedNext) ? requestedNext : '/story';

  return <GateScreen next={next} />;
}
