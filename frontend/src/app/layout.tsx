import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'CareUp · AI-Powered Doctor Appointments & Healthcare',
  description:
    'CareUp doctor appointments. Choose your GP, pick a time that suits you and get a calendar invite. No phone queue at 8am.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="relative flex min-h-screen flex-col bg-[#f6f8fb] font-sans text-slate-900 antialiased selection:bg-[#0066cc] selection:text-white">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-ambient-light-mesh opacity-90" />
        <Toaster position="top-right" closeButton expand={false} richColors />
        {children}
      </body>
    </html>
  );
}
