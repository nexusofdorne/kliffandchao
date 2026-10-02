import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import localFont from 'next/font/local';
import { AudioProvider } from '@/components/site/AudioProvider';
import { LenisProvider } from '@/components/site/LenisProvider';
import { siteConfig } from '@/config/site';
import './globals.css';

// General Sans is the primary face (docs/PLAN.md Typography); Montserrat is
// the declared CSS fallback, so both are self-hosted to avoid a CDN request
// and layout shift if either font fails to load.
const generalSans = localFont({
  src: '../public/fonts/general-sans/GeneralSans-Variable.woff2',
  variable: '--font-general-sans',
  weight: '300 700',
  display: 'swap',
});

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${siteConfig.coupleNames} — ${siteConfig.weddingDateDisplay}`,
  description: `A private wedding site for ${siteConfig.coupleNames}.`,
};

// resizes-content: the on-screen keyboard shrinks the layout viewport
// instead of overlaying it, so 100dvh-based layouts (the gate screen)
// shrink and re-centre above the keyboard rather than being covered by
// it — the bug seen in Messenger's in-app browser. Falls back harmlessly
// where unsupported; GateScreen's own visualViewport listener covers that.
export const viewport: Viewport = {
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${generalSans.variable} ${montserrat.variable} h-full antialiased`}
    >
      {/* No className here — deliberately. `min-h-full flex flex-col` was
          generic scaffolding from Phase 0 with nothing in the site relying
          on it, and `display:flex` on body breaks GSAP ScrollTrigger's
          pin-spacer sizing: the spacer's explicit height stops being
          respected, the pinned track collapses to one screen, and nothing
          below it scrolls or responds to a jump. Confirmed by removing it
          and watching the horizontal track's full scroll budget return. */}
      <body>
        <AudioProvider>
          <LenisProvider>{children}</LenisProvider>
        </AudioProvider>
      </body>
    </html>
  );
}
