'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
  MailCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { signupSchema, SignupInput } from '@/lib/schemas';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'PATIENT' | 'DOCTOR'>('PATIENT');
  const [registeredUser, setRegisteredUser] = useState<{ email: string; name: string } | null>(null);
  const [resending, setResending] = useState(false);

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
        requiresVerification?: boolean;
        token?: string;
        user: { id: string; email: string; name: string; role: 'DOCTOR' | 'PATIENT' };
      }>('/api/auth/signup', data);

      toast.success(res.data.message || 'Account created! Please check your email.');
      setRegisteredUser({
        email: data.email,
        name: data.name,
      });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!registeredUser) return;
    try {
      setResending(true);
      const res = await clientAxios.post<{ message: string }>('/api/auth/resend-verification', {
        email: registeredUser.email,
      });
      toast.success(res.data.message || 'Fresh verification link sent!');
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err));
    } finally {
      setResending(false);
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
              {registeredUser ? 'Verify your email' : 'Create an account'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {registeredUser
                ? 'We sent a verification link to your email'
                : 'Select your role to register with CareUp'}
            </p>
          </div>

          {registeredUser ? (
            /* Post-registration Verification Prompt Card */
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#0066cc] border border-blue-100 shadow-inner">
                <MailCheck className="h-8 w-8 text-[#0066cc]" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  Verification email sent!
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We have dispatched an activation link to:
                </p>
                <div className="inline-block rounded-lg bg-slate-50 px-3 py-1.5 border border-slate-200 font-mono text-xs font-semibold text-slate-800 break-all">
                  {registeredUser.email}
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-left text-xs text-slate-600 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#0066cc] shrink-0 mt-0.5" />
                  <span>Click the link in the email to activate your account.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#0066cc] shrink-0 mt-0.5" />
                  <span>For security reasons, this link is valid for <strong>24 hours</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#0066cc] shrink-0 mt-0.5" />
                  <span>Be sure to check your spam/junk folder if you don't see it in your inbox.</span>
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <Button
                  asChild
                  className="btn-primary w-full py-2.5 text-xs font-semibold rounded-xl"
                >
                  <Link href="/login">
                    Proceed to Sign In
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resending}
                  onClick={handleResendVerification}
                  className="w-full rounded-xl text-xs font-medium text-slate-600 border-slate-200 hover:bg-slate-50 h-9 gap-1.5"
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Resending link…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                      Didn't get the email? Resend verification
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Signup Form */
            <>
              {/* Role Selector Tabs */}
              <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5 border border-slate-200">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleRoleSelect('PATIENT')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold transition-all h-auto',
                    selectedRole === 'PATIENT'
                      ? 'bg-[#0066cc] text-white shadow-xs hover:bg-[#0055b3] hover:text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60',
                  )}
                >
                  <User className="h-4 w-4" />
                  Patient
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleRoleSelect('DOCTOR')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg py-2 px-3 text-xs font-semibold transition-all h-auto',
                    selectedRole === 'DOCTOR'
                      ? 'bg-[#0066cc] text-white shadow-xs hover:bg-[#0055b3] hover:text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60',
                  )}
                >
                  <Stethoscope className="h-4 w-4" />
                  Doctor
                </Button>
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
                  <Input
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

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
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

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-2.5 text-xs font-semibold rounded-xl"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating account…
                      </>
                    ) : (
                      <>
                        Register as {selectedRole === 'DOCTOR' ? 'Doctor' : 'Patient'}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>

              <p className="mt-6 text-center text-xs text-slate-500">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-[#0066cc] hover:underline underline-offset-4">
                  Sign in
                </Link>
              </p>
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
