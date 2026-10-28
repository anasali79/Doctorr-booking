'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff, ArrowRight, AlertCircle, Stethoscope, User, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { loginSchema, LoginInput } from '@/lib/schemas';
import { BrandMark } from '@/components/ui/BrandMark';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await clientAxios.post<{
        success: boolean;
        message: string;
        token?: string;
        user: { id: string; email: string; role: 'DOCTOR' | 'PATIENT' };
      }>('/api/auth/login', data);

      if (res.data.token) {
        document.cookie = `jwt=${res.data.token}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `token=${res.data.token}; path=/; max-age=604800; SameSite=Lax`;
      }

      toast.success(res.data.message || 'Signed in successfully');

      if (nextUrl) {
        router.push(nextUrl);
      } else if (res.data.user?.role === 'DOCTOR') {
        router.push('/doctor/dashboard');
      } else {
        router.push('/patient/dashboard');
      }
      router.refresh();
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Quick fill helper for demo convenience
  const handleDemoFill = (role: 'DOCTOR' | 'PATIENT') => {
    if (role === 'DOCTOR') {
      setValue('email', 'doctor@schedula.com');
      setValue('password', 'Doctor@1234');
    } else {
      setValue('email', 'patient@schedula.com');
      setValue('password', 'Patient@1234');
    }
    setErrorMessage(null);
  };

  return (
    <div className="w-full max-w-md animate-fade-up">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-8 shadow-md">
        <div className="mb-6 text-center">
          <Link href="/" className="mb-3 inline-flex items-center gap-2.5">
            <BrandMark size="md" />
            <div className="text-left">
              <span className="block text-base font-extrabold leading-none text-slate-900">Care<span className="text-[#0066cc]">Up</span></span>
              <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Healthcare Platform</span>
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-2">
            Welcome back
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Sign in to access appointment booking, doctor schedules, and live queue tokens
          </p>
        </div>

        {/* Demo Quick Fill */}
        <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Sparkles className="h-3.5 w-3.5 text-[#0066cc]" />
              Quick Demo Access
            </span>
            <span className="text-[10px] text-slate-400">1-click fill</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoFill('PATIENT')}
              className="flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white py-1.5 px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
            >
              <User className="h-3.5 w-3.5 text-slate-500" />
              Patient Demo
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill('DOCTOR')}
              className="flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white py-1.5 px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
            >
              <Stethoscope className="h-3.5 w-3.5 text-slate-500" />
              Doctor Demo
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Email address</label>
            <input
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700">Password</label>
            </div>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`field-input pr-10 ${errors.password ? 'border-rose-400' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 text-xs font-semibold mt-2 rounded-xl"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          New patient?{' '}
          <Link href="/signup" className="font-semibold text-[#0066cc] hover:underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#f6f8fb] text-slate-900 relative overflow-hidden">
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <LoginForm />
      </Suspense>

      <div className="mt-6 text-center text-[11px] text-slate-400 font-medium">
        CareUp • Secure Healthcare Portal
      </div>
    </div>
  );
}
