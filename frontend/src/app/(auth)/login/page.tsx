import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { AuthSliderCard } from '@/components/auth/AuthSliderCard';

export const metadata: Metadata = {
  title: 'Sign In — CareUp Healthcare',
  description: 'Sign in to access your doctor appointments, queue tokens, and medical records.',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen min-h-[100dvh] w-full bg-[#eaeff8] flex flex-col items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      <Suspense fallback={<div className="text-slate-400 font-semibold text-sm">Loading authentication…</div>}>
        <AuthSliderCard initialMode="signin" />
      </Suspense>
    </main>
  );
}
