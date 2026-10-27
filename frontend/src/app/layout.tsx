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
  title: 'Schedula — Book doctor appointments',
  description: 'Find doctors, book slots, and track your queue in one place.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col bg-neutral-50 font-sans text-neutral-900 antialiased">
        <Toaster position="top-right" closeButton expand={false} />
        {children}
      </body>
    </html>
  );
}
