'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { resendVerificationSchema, ResendVerificationInput } from '@/lib/schemas/auth';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(!!token);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const hasRequestedRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResendVerificationInput>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (!token || hasRequestedRef.current) return;
    hasRequestedRef.current = true;

    async function verifyToken() {
      try {
        setVerifying(true);
        setErrorMsg(null);

        const res = await clientAxios.get<{
          success: boolean;
          message: string;
        }>(`/api/auth/verify-email?token=${encodeURIComponent(token!)}`);

        setSuccess(true);
        toast.success(res.data.message || 'Email verified successfully!');
      } catch (err: unknown) {
        const msg = extractErrorMessage(err);
        setErrorMsg(msg);
        toast.error(msg);
      } finally {
        setVerifying(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleResend = async (data: ResendVerificationInput) => {
    try {
      setResending(true);
      const res = await clientAxios.post<{
        success: boolean;
        message: string;
      }>('/api/auth/resend-verification', data);

      toast.success(res.data.message || 'Verification link sent!');
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  // State 1: In progress verifying token
  if (verifying) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#0066cc]">
          <Loader2 className="h-8 w-8 animate-spin text-[#0066cc]" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Verifying your email…</h2>
        <p className="text-xs text-slate-500">
          Please wait while we confirm your credentials with CareUp security services.
        </p>
      </div>
    );
  }

  // State 2: Verification Successful
  if (success) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-8 shadow-md text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-inner">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-slate-900">Email Verified!</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your CareUp account is now active and ready. You can sign in to book appointments or manage your clinical practice.
          </p>
        </div>
        <Button asChild className="btn-primary w-full py-2.5 text-xs font-semibold rounded-xl">
          <Link href="/login">
            Sign In to CareUp
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Link>
        </Button>
      </div>
    );
  }

  // State 3: Token invalid, expired, or missing — show friendly resend interface
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-8 shadow-md">
      <div className="mb-6 text-center">
        <Link href="/" className="mb-3 inline-flex items-center gap-2.5">
          <BrandMark size="md" />
          <div className="text-left">
            <span className="block text-base font-extrabold leading-none text-slate-900">
              Care<span className="text-[#0066cc]">Up</span>
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
              Healthcare Platform
            </span>
          </div>
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-2">
          {token ? 'Verification failed' : 'Verify your email'}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {token
            ? 'The link is invalid, expired, or has already been used.'
            : 'Enter your email to request an account activation link'}
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit(handleResend)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Registered Email address
          </label>
          <Input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={`field-input ${errors.email ? 'border-rose-400' : ''}`}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
          )}
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            disabled={resending}
            className="btn-primary w-full py-2.5 text-xs font-semibold rounded-xl"
          >
            {resending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Sending verification link…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Send New Verification Link
              </>
            )}
          </Button>
        </div>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-xs font-semibold text-[#0066cc] hover:underline underline-offset-4"
        >
          Return to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#f6f8fb] text-slate-900 relative overflow-hidden">
      <div className="w-full max-w-md animate-fade-up">
        <Suspense fallback={<p className="text-sm text-slate-500 text-center">Loading…</p>}>
          <VerifyEmailContent />
        </Suspense>

        <div className="mt-6 text-center text-[11px] text-slate-400 font-medium">
          CareUp • Secure Healthcare Portal
        </div>
      </div>
    </div>
  );
}

