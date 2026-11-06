'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  MailCheck,
  KeyRound,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { forgotPasswordSchema, ForgotPasswordInput } from '@/lib/schemas/auth';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await clientAxios.post<{
        success: boolean;
        message: string;
      }>('/api/auth/forgot-password', data);

      toast.success(res.data.message || 'Password reset link sent!');
      setSubmittedEmail(data.email);
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!submittedEmail) return;
    try {
      setResending(true);
      const res = await clientAxios.post<{
        success: boolean;
        message: string;
      }>('/api/auth/forgot-password', { email: submittedEmail });

      toast.success(res.data.message || 'Password reset link sent!');
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#f6f8fb] text-slate-900 relative overflow-hidden">
      <div className="w-full max-w-md animate-fade-up">
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
              {submittedEmail ? 'Check your email' : 'Forgot password?'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {submittedEmail
                ? 'We sent password recovery instructions to your email'
                : 'Enter your registered email and we will send you a reset link'}
            </p>
          </div>

          {submittedEmail ? (
            /* Success State */
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#0066cc] border border-blue-100 shadow-inner">
                <MailCheck className="h-8 w-8 text-[#0066cc]" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  Reset link sent
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  If an account exists with this address, instructions have been sent to:
                </p>
                <div className="inline-block rounded-lg bg-slate-50 px-3 py-1.5 border border-slate-200 font-mono text-xs font-semibold text-slate-800 break-all">
                  {submittedEmail}
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-left text-xs text-slate-600 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#0066cc] shrink-0 mt-0.5" />
                  <span>The password reset link will expire in <strong>1 hour</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#0066cc] shrink-0 mt-0.5" />
                  <span>Check your spam or junk folder if you don't see it within a few minutes.</span>
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <Button
                  asChild
                  className="btn-primary w-full py-2.5 text-xs font-semibold rounded-xl"
                >
                  <Link href="/login">
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Back to Sign In
                  </Link>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resending}
                  onClick={handleResend}
                  className="w-full rounded-xl text-xs font-medium text-slate-600 border-slate-200 hover:bg-slate-50 h-9 gap-1.5"
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Resending reset link…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                      Didn't get the email? Resend link
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Forgot Password Form */
            <>
              {errorMessage && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    disabled={loading}
                    className="btn-primary w-full py-2.5 text-xs font-semibold rounded-xl"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        Sending reset link…
                      </>
                    ) : (
                      <>
                        Send Reset Link
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-400 font-medium">
          CareUp • Secure Healthcare Portal
        </div>
      </div>
    </div>
  );
}

