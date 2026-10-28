'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2,
  Eye,
  EyeOff,
  User,
  Stethoscope,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { signupSchema, SignupInput } from '@/lib/schemas';
import { BrandMark } from '@/components/ui/BrandMark';
import { cn } from '@/lib/utils';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'PATIENT' | 'DOCTOR'>('PATIENT');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', role: 'PATIENT' },
  });

  const handleRoleSelect = (role: 'PATIENT' | 'DOCTOR') => {
    setSelectedRole(role);
    setValue('role', role);
  };

  const onSubmit = async (data: SignupInput) => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await clientAxios.post<{
        success: boolean;
        message: string;
        token?: string;
        user: { id: string; email: string; role: 'DOCTOR' | 'PATIENT' };
      }>('/api/auth/signup', data);

      if (res.data.token) {
        document.cookie = `jwt=${res.data.token}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `token=${res.data.token}; path=/; max-age=604800; SameSite=Lax`;
      }

      toast.success(res.data.message || 'Account registered successfully!');

      if (data.role === 'DOCTOR') {
        router.push('/doctor/profile-setup');
      } else {
        router.push('/patient/profile-setup');
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 py-12 bg-[#f6f8fb] text-slate-900 relative overflow-hidden">
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
              Create an account
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Select your role to register with CareUp
            </p>
          </div>

          {/* Role Selector Tabs */}
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5 border border-slate-200">
            <button
              type="button"
              onClick={() => handleRoleSelect('PATIENT')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold transition-all',
                selectedRole === 'PATIENT'
                  ? 'bg-[#0066cc] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <User className="h-4 w-4" />
              Patient
            </button>
            <button
              type="button"
              onClick={() => handleRoleSelect('DOCTOR')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold transition-all',
                selectedRole === 'DOCTOR'
                  ? 'bg-[#0066cc] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <Stethoscope className="h-4 w-4" />
              Doctor
            </button>
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
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Full name</label>
              <input
                {...register('name')}
                type="text"
                autoComplete="name"
                placeholder={selectedRole === 'DOCTOR' ? 'Dr. Sarah Connor' : 'Jane Doe'}
                className={`field-input ${errors.name ? 'border-rose-400' : ''}`}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
              )}
            </div>

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
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min 8 characters"
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
                  Creating account…
                </>
              ) : (
                <>
                  <span>Create {selectedRole === 'DOCTOR' ? 'Doctor' : 'Patient'} Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-[#0066cc] hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-6 text-center text-[11px] text-slate-400 font-medium">
        CareUp • Secure Healthcare Portal
      </div>
    </div>
  );
}
