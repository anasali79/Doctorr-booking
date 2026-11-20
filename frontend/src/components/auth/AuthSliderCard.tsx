'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Stethoscope,
  Sparkles,
  Loader2,
  AlertCircle,
  MailCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { loginSchema, LoginInput, signupSchema, SignupInput } from '@/lib/schemas/auth';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { cn } from '@/lib/utils';

interface AuthSliderCardProps {
  initialMode?: 'signin' | 'signup';
}

export function AuthSliderCard({ initialMode = 'signin' }: AuthSliderCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next');
  const urlMode = searchParams.get('mode');

  // Mode state: 'signin' | 'signup'
  const [mode, setMode] = useState<'signin' | 'signup'>(() => {
    if (urlMode === 'signup' || initialMode === 'signup') return 'signup';
    return 'signin';
  });

  // Mobile viewport detection for responsive sliding
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Common & UI states
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Sign In states
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Sign Up states
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'PATIENT' | 'DOCTOR'>('PATIENT');
  const [registeredUser, setRegisteredUser] = useState<{ email: string; name: string } | null>(null);
  const [resendingSignupVerification, setResendingSignupVerification] = useState(false);

  // Sign In Form Hook
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    setValue: setLoginValue,
    formState: { errors: loginErrors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Sign Up Form Hook
  const {
    register: registerSignup,
    handleSubmit: handleSignupSubmit,
    setValue: setSignupValue,
    formState: { errors: signupErrors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', role: 'PATIENT' },
  });

  // Load remembered email
  useEffect(() => {
    try {
      const saved = localStorage.getItem('careup_remember_email');
      if (saved) {
        setLoginValue('email', saved);
      }
    } catch { }
  }, [setLoginValue]);

  // Mode toggle handler
  const toggleMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setShowPassword(false);
    setLoginError(null);
    setSignupError(null);
    setUnverifiedEmail(null);
    setRegisteredUser(null);
    try {
      const nextParam = nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : '';
      window.history.replaceState(null, '', `/${newMode === 'signup' ? 'signup' : 'login'}${nextParam}`);
    } catch { }
  };

  // Sign In Submit Handler
  const onLoginSubmit = async (data: LoginInput) => {
    try {
      setLoginLoading(true);
      setLoginError(null);
      setUnverifiedEmail(null);

      if (rememberMe) {
        try {
          localStorage.setItem('careup_remember_email', data.email);
        } catch { }
      } else {
        try {
          localStorage.removeItem('careup_remember_email');
        } catch { }
      }

      const res = await clientAxios.post<{
        success: boolean;
        message: string;
        token?: string;
        user: { id: string; email: string; role: 'DOCTOR' | 'PATIENT' | 'ADMIN' | 'RECEPTIONIST' };
      }>('/api/auth/login', data);

      if (res.data.token) {
        document.cookie = `jwt=${res.data.token}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `token=${res.data.token}; path=/; max-age=604800; SameSite=Lax`;
      }

      toast.success(res.data.message || 'Welcome back!');

      const role = (res.data.user?.role as string) || '';
      if (nextUrl) {
        router.push(nextUrl);
      } else if (role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else if (role === 'DOCTOR') {
        router.push('/doctor/dashboard');
      } else if (role === 'RECEPTIONIST') {
        router.push('/receptionist/dashboard');
      } else {
        router.push('/patient/dashboard');
      }
      router.refresh();
    } catch (err: unknown) {
      const respData = (err as { response?: { data?: { code?: string; error?: string; email?: string } } })?.response?.data;
      const isUnverified = respData?.code === 'EMAIL_NOT_VERIFIED' || respData?.error?.includes('verify your email');

      if (isUnverified) {
        setUnverifiedEmail(respData?.email || data.email);
        setLoginError(null);
      } else {
        const msg = extractErrorMessage(err);
        setLoginError(msg);
        toast.error(msg);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Sign Up Submit Handler
  const onSignupSubmit = async (data: SignupInput) => {
    try {
      setSignupLoading(true);
      setSignupError(null);

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
      setSignupError(msg);
      toast.error(msg);
    } finally {
      setSignupLoading(false);
    }
  };

  // Resend Verification Handlers
  const handleResendLoginVerification = async () => {
    if (!unverifiedEmail) return;
    try {
      setResendingVerification(true);
      const res = await clientAxios.post<{ message: string }>('/api/auth/resend-verification', {
        email: unverifiedEmail,
      });
      toast.success(res.data.message || 'Verification link sent! Check your inbox.');
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err));
    } finally {
      setResendingVerification(false);
    }
  };

  const handleResendSignupVerification = async () => {
    if (!registeredUser) return;
    try {
      setResendingSignupVerification(true);
      const res = await clientAxios.post<{ message: string }>('/api/auth/resend-verification', {
        email: registeredUser.email,
      });
      toast.success(res.data.message || 'Fresh verification link sent!');
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err));
    } finally {
      setResendingSignupVerification(false);
    }
  };

  // Demo Autofill Helper
  const handleDemoFill = (role: 'DOCTOR' | 'PATIENT') => {
    if (role === 'DOCTOR') {
      setLoginValue('email', 'doctor@schedula.com');
      setLoginValue('password', 'Doctor@1234');
    } else {
      setLoginValue('email', 'patient@schedula.com');
      setLoginValue('password', 'Patient@1234');
    }
    setLoginError(null);
    setUnverifiedEmail(null);
  };

  const isSignup = mode === 'signup';

  return (
    <div className="w-full flex items-center justify-center p-2 sm:p-4 md:p-6 lg:p-8">
      {/* ───────────────────────────────────────────────────────────── */}
      {/*                   MAIN HERO CONTAINER CARD                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-[440px] md:max-w-[940px] min-h-auto md:min-h-[580px] lg:min-h-[610px] rounded-[28px] md:rounded-[36px] bg-[#253fb0] shadow-[0_20px_60px_rgba(15,35,120,0.22)] md:shadow-[0_25px_70px_rgba(15,35,120,0.28)] border border-blue-400/20 relative overflow-hidden flex flex-col md:flex-row select-none">

        {/* ───────────────────────────────────────────────────────────── */}
        {/*              MOBILE TOP HERO BANNER (< 768px)                 */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="md:hidden relative w-full h-36 sm:h-44 bg-[#253fb0] overflow-hidden flex items-end justify-center">
          {/* Subtle decorative pills background */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-4 left-6 w-3 h-3 rounded-full bg-blue-300/20 blur-[1px]" />
            <div className="absolute top-8 right-8 w-4 h-4 rounded-full bg-blue-300/15" />
            <div className="absolute bottom-5 left-10 w-2 h-2 rounded-full bg-white/20" />
          </div>

          {/* Top Brand Logo & Mobile Switcher */}
          <div className="absolute top-3 inset-x-3.5 z-30 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-1.5 group">
              <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-xs">
                <div className="w-3.5 h-1.5 rounded-full border border-white flex overflow-hidden -rotate-45">
                  <span className="w-1/2 bg-white" />
                  <span className="w-1/2 bg-transparent" />
                </div>
              </div>
              <span className="text-white font-extrabold text-sm tracking-tight drop-shadow-xs">
                Care<span className="text-blue-200">UP</span>
              </span>
            </Link>

            {/* Mobile Mode Switcher Pills */}
            <div className="flex items-center bg-white/15 backdrop-blur-md rounded-full p-0.5 border border-white/20 shadow-xs">
              <button
                type="button"
                onClick={() => toggleMode('signin')}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer',
                  !isSignup ? 'bg-white text-[#253fb0] shadow-xs' : 'text-white/80 hover:text-white',
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => toggleMode('signup')}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer',
                  isSignup ? 'bg-white text-[#253fb0] shadow-xs' : 'text-white/80 hover:text-white',
                )}
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Doctor with Flashlight (Mirrored on Signup Mode) */}
          <motion.div
            animate={{
              scaleX: isSignup ? -1 : 1,
            }}
            transition={{
              type: 'spring',
              stiffness: 240,
              damping: 26,
              mass: 0.85,
            }}
            className="w-full h-full flex items-end justify-center pointer-events-none"
            style={{ transformOrigin: 'center center' }}
          >
            <img
              src="/images/auth.png"
              alt="Doctor exploring medical records with flashlight"
              className="w-full h-full object-cover object-[30%_62%] select-none pointer-events-none"
            />
          </motion.div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/*        DESKTOP SLIDING DOCTOR & FLASHLIGHT ILLUSTRATION       */}
        {/* ───────────────────────────────────────────────────────────── */}
        <motion.div
          animate={{
            x: isSignup ? '100%' : '0%',
          }}
          transition={{
            type: 'spring',
            stiffness: 240,
            damping: 26,
            mass: 0.85,
          }}
          className="hidden md:block w-1/2 h-full absolute inset-y-0 left-0 z-10 pointer-events-none overflow-hidden"
        >
          {/* Top Brand Logo Overlay */}
          <div className="absolute top-6 left-7 sm:top-8 sm:left-9 z-30 flex items-center gap-2.5 pointer-events-auto">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <div className="w-4 h-2 rounded-full border border-white flex overflow-hidden -rotate-45">
                  <span className="w-1/2 bg-white" />
                  <span className="w-1/2 bg-transparent" />
                </div>
              </div>
              <span className="text-white font-extrabold text-sm sm:text-base tracking-tight drop-shadow-xs">
                Care<span className="text-blue-200">UP</span>
              </span>
            </Link>
          </div>

          {/* Authentic Doctor with Flashlight (Mirrored on Signup Mode) */}
          <motion.div
            animate={{
              scaleX: isSignup ? -1 : 1,
            }}
            transition={{
              type: 'spring',
              stiffness: 240,
              damping: 26,
              mass: 0.85,
            }}
            className="w-full h-full"
            style={{ transformOrigin: 'center center' }}
          >
            <img
              src="/images/auth.png"
              alt="Doctor exploring medical records with flashlight"
              className="w-full h-full object-cover select-none pointer-events-none"
            />
          </motion.div>
        </motion.div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/*                  WHITE CARD CONTAINER                         */}
        {/* ───────────────────────────────────────────────────────────── */}
        <motion.div
          animate={isMobile ? { x: 0 } : { x: isSignup ? '0%' : '100%' }}
          transition={{
            type: 'spring',
            stiffness: 240,
            damping: 26,
            mass: 0.85,
          }}
          className="w-full md:w-1/2 h-auto md:h-full md:min-h-[580px] lg:min-h-[610px] md:absolute md:inset-y-0 md:left-0 z-20 p-0 md:p-3 sm:md:p-4 flex flex-col max-md:[transform:none!important]"
        >
          {/* ── Inner White Floating Box ── */}
          <div className="w-full h-full bg-white rounded-t-[28px] md:rounded-[30px] shadow-[0_15px_45px_rgba(0,0,0,0.12)] md:shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-5 sm:p-7 md:p-8 lg:p-11 flex flex-col justify-center relative overflow-hidden">
            <AnimatePresence mode="wait">
              {!isSignup ? (
                /* ─────────────────────────────────────────────────────────── */
                /*                      SIGN IN FORM VIEW                      */
                /* ─────────────────────────────────────────────────────────── */
                <motion.div
                  key="signin-view"
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="w-full max-w-sm mx-auto flex flex-col"
                >
                  {/* Title */}
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#1a2d6b] tracking-tight text-center mb-5 sm:mb-6">
                    Welcome!
                  </h1>

                  {/* Unverified Email Alert */}
                  {unverifiedEmail ? (
                    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <div className="flex-1 space-y-2">
                          <p className="font-semibold text-amber-950">Email verification required</p>
                          <p className="text-amber-800 leading-relaxed text-[11px]">
                            Your email (<span className="font-medium text-amber-950">{unverifiedEmail}</span>) has not been verified yet.
                          </p>
                          <button
                            type="button"
                            disabled={resendingVerification}
                            onClick={handleResendLoginVerification}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100/70 cursor-pointer shadow-2xs"
                          >
                            {resendingVerification ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Sending link…
                              </>
                            ) : (
                              <>
                                <MailCheck className="h-3 w-3 text-amber-700" />
                                Resend verification email
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : loginError ? (
                    <div className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      <div className="flex-1 leading-relaxed">{loginError}</div>
                    </div>
                  ) : null}

                  {/* Form */}
                  <form onSubmit={handleLoginSubmit(onLoginSubmit)} className="space-y-3 sm:space-y-3.5">
                    {/* Email Input (Capsule Shape) */}
                    <div>
                      <div
                        className={cn(
                          'relative flex items-center rounded-full bg-[#f1f3f9] border border-transparent px-4 py-2.5 sm:py-3.5 transition-all focus-within:bg-white focus-within:border-[#0066cc] focus-within:ring-2 focus-within:ring-[#0066cc]/20',
                          loginErrors.email && 'border-rose-400 bg-rose-50/50',
                        )}
                      >
                        <Mail className="w-4 h-4 text-slate-400 shrink-0 mr-3" />
                        <input
                          {...registerLogin('email')}
                          type="email"
                          autoComplete="email"
                          placeholder="YOUR E-MAIL"
                          className="w-full bg-transparent text-base sm:text-xs font-bold uppercase tracking-wider text-slate-800 placeholder:text-slate-400 placeholder:font-semibold focus:outline-hidden"
                        />
                      </div>
                      {loginErrors.email && (
                        <p className="mt-1 ml-4 text-[11px] text-rose-600 font-medium">
                          {loginErrors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Password Input (Capsule Shape) */}
                    <div>
                      <div
                        className={cn(
                          'relative flex items-center rounded-full bg-[#f1f3f9] border border-transparent px-4 py-2.5 sm:py-3.5 transition-all focus-within:bg-white focus-within:border-[#0066cc] focus-within:ring-2 focus-within:ring-[#0066cc]/20',
                          loginErrors.password && 'border-rose-400 bg-rose-50/50',
                        )}
                      >
                        <Lock className="w-4 h-4 text-slate-400 shrink-0 mr-3" />
                        <input
                          {...registerLogin('password')}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="YOUR PASSWORD"
                          className="w-full bg-transparent text-base sm:text-xs font-bold uppercase tracking-wider text-slate-800 placeholder:text-slate-400 placeholder:font-semibold focus:outline-hidden pr-2"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-400 hover:text-slate-700 p-1.5 cursor-pointer transition-colors"
                          aria-label="Toggle password visibility"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {loginErrors.password && (
                        <p className="mt-1 ml-4 text-[11px] text-rose-600 font-medium">
                          {loginErrors.password.message}
                        </p>
                      )}
                    </div>

                    {/* Options Row: Remember Me & Forgot Password */}
                    <div className="flex items-center justify-between gap-2 text-xs pt-1 px-1 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0',
                            rememberMe
                              ? 'border-[#0066cc] bg-white'
                              : 'border-slate-300 bg-slate-100',
                          )}
                        >
                          {rememberMe && <span className="w-2 h-2 rounded-full bg-[#0066cc]" />}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600 hover:text-slate-900">
                          Remember my password
                        </span>
                      </label>

                      <Link
                        href="/forgot-password"
                        className="text-[11px] font-bold text-[#0066cc] hover:underline underline-offset-4 transition-colors"
                      >
                        Forgot your password?
                      </Link>
                    </div>

                    {/* LOGIN Button (Theme Royal Blue Capsule) */}
                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full mt-3 sm:mt-4 py-3 sm:py-3.5 rounded-full bg-[#0066cc] hover:bg-[#0052a3] active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm uppercase tracking-widest shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {loginLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>LOGGING IN…</span>
                        </>
                      ) : (
                        <span>LOGIN</span>
                      )}
                    </button>
                  </form>

                  {/* Demo Quick-Fill Access Strip */}
                  <div className="mt-4 sm:mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#0066cc]" />
                      Quick demo:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDemoFill('PATIENT')}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-[#0066cc] transition-colors cursor-pointer"
                      >
                        Patient
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDemoFill('DOCTOR')}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-[#0066cc] transition-colors cursor-pointer"
                      >
                        Doctor
                      </button>
                    </div>
                  </div>

                  {/* Bottom Toggle to Create Account */}
                  <div className="mt-3.5 sm:mt-4 text-center">
                    <p className="text-xs text-slate-500 font-medium">
                      Don&apos;t have an account?{' '}
                      <button
                        type="button"
                        onClick={() => toggleMode('signup')}
                        className="font-extrabold text-[#0066cc] hover:text-[#0052a3] transition-colors cursor-pointer ml-1"
                      >
                        Create account
                      </button>
                    </p>
                  </div>
                </motion.div>
              ) : (
                /* ─────────────────────────────────────────────────────────── */
                /*                      SIGN UP FORM VIEW                      */
                /* ─────────────────────────────────────────────────────────── */
                <motion.div
                  key="signup-view"
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="w-full max-w-sm mx-auto flex flex-col"
                >
                  {registeredUser ? (
                    /* Verification Sent Card */
                    <div className="space-y-4 text-center py-2">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#0066cc] border border-blue-100 shadow-inner">
                        <MailCheck className="h-7 w-7 text-[#0066cc]" />
                      </div>

                      <div className="space-y-1">
                        <h2 className="text-xl font-black text-[#1a2d6b]">
                          Check your email!
                        </h2>
                        <p className="text-xs text-slate-500">
                          Activation link sent to:
                        </p>
                        <div className="inline-block rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-800 break-all">
                          {registeredUser.email}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3 text-left text-[11px] text-slate-600 space-y-1.5">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#0066cc] shrink-0 mt-0.5" />
                          <span>Click the link in your email to activate.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#0066cc] shrink-0 mt-0.5" />
                          <span>Link is valid for 24 hours. Check spam if missing.</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleMode('signin')}
                        className="w-full py-3.5 rounded-full bg-[#0066cc] hover:bg-[#0052a3] text-white font-extrabold text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer"
                      >
                        Proceed to Sign In
                      </button>

                      <button
                        type="button"
                        disabled={resendingSignupVerification}
                        onClick={handleResendSignupVerification}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                      >
                        {resendingSignupVerification ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Resending…
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3" />
                            Didn&apos;t get email? Resend
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    /* Create Account Inputs */
                    <>
                      {/* Title */}
                      <h1 className="text-2xl sm:text-3xl font-black text-[#1a2d6b] tracking-tight text-center mb-3 sm:mb-4">
                        Create Account
                      </h1>

                      {/* Role Selector Pills */}
                      <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-[#f1f3f9] mb-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRole('PATIENT');
                            setSignupValue('role', 'PATIENT');
                          }}
                          className={cn(
                            'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-bold transition-all cursor-pointer',
                            selectedRole === 'PATIENT'
                              ? 'bg-[#0066cc] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900',
                          )}
                        >
                          <User className="w-3.5 h-3.5" />
                          Patient
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRole('DOCTOR');
                            setSignupValue('role', 'DOCTOR');
                          }}
                          className={cn(
                            'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-bold transition-all cursor-pointer',
                            selectedRole === 'DOCTOR'
                              ? 'bg-[#0066cc] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900',
                          )}
                        >
                          <Stethoscope className="w-3.5 h-3.5" />
                          Doctor
                        </button>
                      </div>

                      {signupError && (
                        <div className="mb-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                          <div className="flex-1 leading-relaxed">{signupError}</div>
                        </div>
                      )}

                      <form onSubmit={handleSignupSubmit(onSignupSubmit)} className="space-y-2.5 sm:space-y-3">
                        {/* Name Input */}
                        <div>
                          <div
                            className={cn(
                              'relative flex items-center rounded-full bg-[#f1f3f9] border border-transparent px-4 py-2.5 sm:py-3 transition-all focus-within:bg-white focus-within:border-[#0066cc] focus-within:ring-2 focus-within:ring-[#0066cc]/20',
                              signupErrors.name && 'border-rose-400 bg-rose-50/50',
                            )}
                          >
                            <User className="w-4 h-4 text-slate-400 shrink-0 mr-3" />
                            <input
                              {...registerSignup('name')}
                              type="text"
                              autoComplete="name"
                              placeholder="YOUR FULL NAME"
                              className="w-full bg-transparent text-base sm:text-xs font-bold uppercase tracking-wider text-slate-800 placeholder:text-slate-400 placeholder:font-semibold focus:outline-hidden"
                            />
                          </div>
                          {signupErrors.name && (
                            <p className="mt-1 ml-4 text-[11px] text-rose-600 font-medium">
                              {signupErrors.name.message}
                            </p>
                          )}
                        </div>

                        {/* Email Input */}
                        <div>
                          <div
                            className={cn(
                              'relative flex items-center rounded-full bg-[#f1f3f9] border border-transparent px-4 py-2.5 sm:py-3 transition-all focus-within:bg-white focus-within:border-[#0066cc] focus-within:ring-2 focus-within:ring-[#0066cc]/20',
                              signupErrors.email && 'border-rose-400 bg-rose-50/50',
                            )}
                          >
                            <Mail className="w-4 h-4 text-slate-400 shrink-0 mr-3" />
                            <input
                              {...registerSignup('email')}
                              type="email"
                              autoComplete="email"
                              placeholder="YOUR E-MAIL"
                              className="w-full bg-transparent text-base sm:text-xs font-bold uppercase tracking-wider text-slate-800 placeholder:text-slate-400 placeholder:font-semibold focus:outline-hidden"
                            />
                          </div>
                          {signupErrors.email && (
                            <p className="mt-1 ml-4 text-[11px] text-rose-600 font-medium">
                              {signupErrors.email.message}
                            </p>
                          )}
                        </div>

                        {/* Password Input */}
                        <div>
                          <div
                            className={cn(
                              'relative flex items-center rounded-full bg-[#f1f3f9] border border-transparent px-4 py-2.5 sm:py-3 transition-all focus-within:bg-white focus-within:border-[#0066cc] focus-within:ring-2 focus-within:ring-[#0066cc]/20',
                              signupErrors.password && 'border-rose-400 bg-rose-50/50',
                            )}
                          >
                            <Lock className="w-4 h-4 text-slate-400 shrink-0 mr-3" />
                            <input
                              {...registerSignup('password')}
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              placeholder="YOUR PASSWORD"
                              className="w-full bg-transparent text-base sm:text-xs font-bold uppercase tracking-wider text-slate-800 placeholder:text-slate-400 placeholder:font-semibold focus:outline-hidden pr-2"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-slate-400 hover:text-slate-700 p-1.5 cursor-pointer transition-colors"
                              aria-label="Toggle password visibility"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {signupErrors.password && (
                            <p className="mt-1 ml-4 text-[11px] text-rose-600 font-medium">
                              {signupErrors.password.message}
                            </p>
                          )}
                        </div>

                        {/* SIGN UP Button */}
                        <button
                          type="submit"
                          disabled={signupLoading}
                          className="w-full mt-2.5 sm:mt-3 py-3 sm:py-3.5 rounded-full bg-[#0066cc] hover:bg-[#0052a3] active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm uppercase tracking-widest shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                          {signupLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>CREATING ACCOUNT…</span>
                            </>
                          ) : (
                            <span>CREATE ACCOUNT</span>
                          )}
                        </button>
                      </form>

                      {/* Bottom Toggle to Sign In */}
                      <div className="mt-3.5 sm:mt-4 text-center">
                        <p className="text-xs text-slate-500 font-medium">
                          Already have an account?{' '}
                          <button
                            type="button"
                            onClick={() => toggleMode('signin')}
                            className="font-extrabold text-[#0066cc] hover:text-[#0052a3] transition-colors cursor-pointer ml-1"
                          >
                            Sign in
                          </button>
                        </p>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
