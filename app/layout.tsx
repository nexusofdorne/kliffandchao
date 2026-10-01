import type { Metadata } from 'next';
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

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${generalSans.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AudioProvider>
          <LenisProvider>{children}</LenisProvider>
        </AudioProvider>
      </body>
    </html>
  );
}
