'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { resetPasswordSchema, ResetPasswordInput } from '@/lib/schemas/auth';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) {
      setErrorMessage('Missing password reset token. Please request a new link.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await clientAxios.post<{
        success: boolean;
        message: string;
      }>('/api/auth/reset-password', {
        token,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });

      toast.success(res.data.message || 'Password reset successfully!');
      setIsSuccess(true);
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-8 shadow-md text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
          <AlertCircle className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Missing Reset Token</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          This password reset link is invalid or incomplete. Please request a new password reset email.
        </p>
        <Button asChild className="btn-primary w-full py-2.5 text-xs font-semibold rounded-xl mt-2">
          <Link href="/forgot-password">
            Request New Reset Link
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Link>
        </Button>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-8 shadow-md text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-inner">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-900">Password Reset Complete</h2>
          <p className="text-xs text-slate-500">
            Your password has been securely updated. You can now log in with your new credentials.
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
          Set new password
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Enter your new password below to regain access to your account
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            New Password
          </label>
          <div className="relative">
            <Input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              className={`field-input pr-10 ${errors.password ? 'border-rose-400' : ''}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-transparent"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Confirm New Password
          </label>
          <div className="relative">
            <Input
              {...register('confirmPassword')}
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className={`field-input pr-10 ${errors.confirmPassword ? 'border-rose-400' : ''}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-transparent"
              aria-label="Toggle password visibility"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-rose-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 text-xs font-semibold rounded-xl"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Updating password…
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-1.5" />
                Update Password
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#f6f8fb] text-slate-900 relative overflow-hidden">
      <div className="w-full max-w-md animate-fade-up">
        <Suspense fallback={<p className="text-sm text-slate-500 text-center">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>

        <div className="mt-6 text-center text-[11px] text-slate-400 font-medium">
          CareUp • Secure Healthcare Portal
        </div>
      </div>
    </div>
  );
}

