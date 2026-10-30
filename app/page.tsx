import { GateScreen } from '@/components/site/gate/GateScreen';
import { isSafeNextPath } from '@/lib/auth/safe-next';
import { getSiteSettings } from '@/lib/settings/site-settings';

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedNext = typeof params.next === 'string' ? params.next : undefined;
  const next = requestedNext && isSafeNextPath(requestedNext) ? requestedNext : '/story';

  // the password screen still shows if the settings can't be read (the gate just stays closed)
  const open = await getSiteSettings().then(
    (settings) => settings.passwordOpen,
    () => false,
  );

  return <GateScreen next={next} open={open} />;
}
