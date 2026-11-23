import type { Metadata, Viewport } from 'next';
import { DM_Sans, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';

const body = DM_Sans({ subsets: ['latin'], variable: '--font-body' });
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: { default: 'Baby Wardrobe', template: '%s · Baby Wardrobe' },
  description: 'Track what your baby owns, plan what they will need, and shop for the gaps.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
