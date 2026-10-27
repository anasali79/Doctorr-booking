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
  CheckCircle2,
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
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 py-12" style={{ background: 'var(--background, #f8fafb)' }}>
      {/* Multi-layer ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_30%,rgba(13,148,136,0.08),transparent)]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[radial-gradient(circle,rgba(6,182,212,0.05),transparent_70%)]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[radial-gradient(circle,rgba(99,102,241,0.03),transparent_70%)]" />
      </div>

      <div className="w-full max-w-md animate-fade-up">
        <div className="card-premium p-8" style={{ boxShadow: '0 20px 50px rgba(15,23,42,0.08), 0 4px 12px rgba(13,148,136,0.04)' }}>
          <div className="mb-7 text-center">
            <Link href="/" className="mb-4 inline-block">
              <BrandMark size="lg" className="mx-auto" />
            </Link>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Choose your profile type to get started
            </p>
          </div>

          {/* Role Selector */}
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl p-1.5 border border-slate-200/70" style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
            <button
              type="button"
              onClick={() => handleRoleSelect('PATIENT')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all duration-200',
                selectedRole === 'PATIENT'
                  ? 'bg-white text-blue-800 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <User className="h-4 w-4 text-blue-600" />
              I am a Patient
            </button>
            <button
              type="button"
              onClick={() => handleRoleSelect('DOCTOR')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all duration-200',
                selectedRole === 'DOCTOR'
                  ? 'bg-white text-blue-800 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <Stethoscope className="h-4 w-4 text-blue-600" />
              I am a Doctor
            </button>
          </div>

          {/* Role description */}
          <div className="mb-6 rounded-xl border border-slate-200/60 p-3 text-xs text-slate-600 flex items-start gap-2" style={{ background: 'linear-gradient(135deg, #f8fafb, #f1f5f9)' }}>
            <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              {selectedRole === 'PATIENT'
                ? 'Book verified doctor slots, track your live queue position, and get real-time appointment updates.'
                : 'Manage clinic availability, configure consultation slots, and track incoming patients in real-time.'}
            </span>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800 animate-scale-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input type="hidden" {...register('role')} />

            <div>
              <label className="field-label">Full Name</label>
              <input
                {...register('name')}
                type="text"
                placeholder={selectedRole === 'DOCTOR' ? 'Dr. Ananya Sharma' : 'Rahul Verma'}
                className={`field-input ${errors.name ? 'border-rose-400 focus:ring-rose-200' : ''}`}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="field-label">Email Address</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                className={`field-input ${errors.email ? 'border-rose-400 focus:ring-rose-200' : ''}`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="field-label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className={`field-input pr-10 ${errors.password ? 'border-rose-400 focus:ring-rose-200' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
              className="btn-primary w-full py-3 text-sm font-semibold mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Complete Registration
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800 hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-400 font-medium">
          By signing up you agree to Schedula Terms and Medical Privacy Guidelines
        </div>
      </div>
    </div>
  );
}
