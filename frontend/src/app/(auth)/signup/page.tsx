import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { AuthSliderCard } from '@/components/auth/AuthSliderCard';

export const metadata: Metadata = {
  title: 'Create Account —CareUp Healthcare',
  description: 'Create an account to book verified doctor consultations and manage healthcare.',
};

export default function SignupPage() {
  return (
    <main className="min-h-screen min-h-[100dvh] w-full bg-[#eaeff8] flex flex-col items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      <Suspense fallback={<div className="text-slate-400 font-semibold text-sm">Loading registration…</div>}>
        <AuthSliderCard initialMode="signup" />
      </Suspense>
    </main>
  );
}
