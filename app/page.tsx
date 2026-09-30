import { siteConfig } from '@/config/site';

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        {siteConfig.coupleNames}
      </h1>
      <p className="text-muted-foreground">{siteConfig.weddingDateDisplay}</p>
    </div>
  );
}
