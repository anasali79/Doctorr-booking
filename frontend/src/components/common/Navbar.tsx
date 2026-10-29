'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  LogOut,
  Menu,
  X,
  Phone,
  ChevronDown,
  User,
  CheckCircle2,
  Calendar,
  CreditCard,
  LayoutDashboard,
  Stethoscope,
  ChevronRight,
} from 'lucide-react';
import { SessionUser } from '@/types';
import { toast } from 'sonner';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';

interface NavbarProps {
  user?: SessionUser | null;
  unreadCount?: number;
}

export function Navbar({ user, unreadCount = 0 }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadState, setUnreadState] = useState<number>(unreadCount);

  useEffect(() => {
    setUnreadState(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => {
      clientAxios
        .get<{ data: { unreadCount: number } }>('/api/notifications/unread-count')
        .then((res) => {
          if (res.data?.data?.unreadCount !== undefined) {
            setUnreadState(res.data.data.unreadCount);
          }
        })
        .catch(() => {});
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('notification_updated', fetchUnread);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('notification_updated', fetchUnread);
      }
    };
  }, [user]);

  // Close mobile drawer and dropdown when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await clientAxios.post('/api/auth/logout');
      document.cookie = 'jwt=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      toast.success('Signed out successfully');
      router.push('/login');
      router.refresh();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoggingOut(false);
    }
  };

  const isDoctor = user?.role === 'DOCTOR';
  const closeMobile = () => setMobileMenuOpen(false);

  // Role display label matching user prompt: "patient" or doctor
  const roleLabel = user?.role ? user.role.toLowerCase() : 'patient';

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-all duration-200">
        <div className="page-container">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* ── Logo & Brand (CareUp) ── */}
            <div className="flex items-center gap-6 sm:gap-8">
              <Link href="/" className="flex items-center gap-2.5 group">
                <BrandMark size="sm" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[1.125rem] leading-[1.15] font-extrabold tracking-tight text-slate-900 group-hover:text-[#0066cc] transition-colors">
                      Care<span className="text-[#0066cc]">Up</span>
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-[#0066cc] border border-blue-200">
                      HEALTH
                    </span>
                  </div>
                  <span className="text-[0.6875rem] leading-[1.25] font-medium tracking-[0.06em] text-slate-500 uppercase">
                    Doctor Appointments
                  </span>
                </div>
              </Link>

              {/* ── Center Navigation Links ── */}
              <nav className="hidden items-center gap-2 md:flex">
                {user ? (
                  <>
                    <Link
                      href="/doctors"
                      className={cn(
                        'relative px-4 py-2 text-xs font-semibold transition-all duration-200',
                        pathname === '/doctors' || pathname === '/'
                          ? 'text-[#0066cc]'
                          : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      <span>Book a visit</span>
                      {(pathname === '/doctors' || pathname === '/') && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
                      )}
                    </Link>
                    <Link
                      href={isDoctor ? '/doctor/appointments' : '/patient/appointments'}
                      className={cn(
                        'relative px-4 py-2 text-xs font-semibold transition-all duration-200',
                        pathname.includes('appointments')
                          ? 'text-[#0066cc]'
                          : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      <span>Appointments</span>
                      {pathname.includes('appointments') && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
                      )}
                    </Link>
                    <Link
                      href={isDoctor ? '/doctor/dashboard' : '/patient/dashboard'}
                      className={cn(
                        'relative px-4 py-2 text-xs font-semibold transition-all duration-200',
                        pathname.includes('dashboard')
                          ? 'text-[#0066cc]'
                          : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      <span>Dashboard</span>
                      {pathname.includes('dashboard') && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
                      )}
                    </Link>
                    {!isDoctor && (
                      <Link
                        href="/patient/payments"
                        className={cn(
                          'relative px-4 py-2 text-xs font-semibold transition-all duration-200',
                          pathname.startsWith('/patient/payments')
                            ? 'text-[#0066cc]'
                            : 'text-slate-600 hover:text-slate-900',
                        )}
                      >
                        <span>Payments</span>
                        {pathname.startsWith('/patient/payments') && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
                        )}
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <Link
                      href="/#doctors-section"
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-[#0066cc] transition-colors"
                    >
                      Our doctors
                    </Link>
                    <Link
                      href="/#how-it-works"
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-[#0066cc] transition-colors"
                    >
                      How it works
                    </Link>
                  </>
                )}
              </nav>
            </div>

            {/* ── Right Side: Phone + Bell/Auth (Desktop) ── */}
            <div className="hidden items-center gap-3.5 md:flex">
              {/* Phone Number: 0131 496 0280 */}
              <a
                href="tel:01314960280"
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-slate-700 hover:text-[#0066cc] transition-colors"
              >
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                <span>0131 496 0280</span>
              </a>

              {user ? (
                <>
                  {/* Notification Bell */}
                  <Link
                    href={isDoctor ? '/doctor/notifications' : '/patient/notifications'}
                    className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-[#0066cc] transition-colors border border-slate-200"
                    title="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadState > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#0066cc] text-[10px] font-bold text-white shadow-xs">
                        {unreadState > 9 ? '9+' : unreadState}
                      </span>
                    )}
                  </Link>

                  {/* User Profile Dropdown Pill */}
                  <div className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-xs font-semibold text-slate-900 transition-all hover:bg-slate-50 hover:border-slate-300 shadow-xs h-auto"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#18191f] text-xs font-bold text-white">
                        {(user?.email?.[0] || 'R').toUpperCase()}
                      </div>
                      <span>{user?.email?.split('@')[0] || 'Raj'}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </Button>

                    {userMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5 z-50">
                        <div className="px-4 py-2 border-b border-slate-100">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {user?.email?.split('@')[0] || 'User'}
                          </p>
                          <p className="text-[10px] text-slate-500 capitalize">{roleLabel}</p>
                        </div>
                        <Link
                          href={isDoctor ? '/doctor/profile' : '/patient/profile'}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>Profile</span>
                        </Link>
                        {!isDoctor && (
                          <Link
                            href="/patient/payments"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                            <span>Payments & Receipts</span>
                          </Link>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleLogout}
                          disabled={loggingOut}
                          className="flex w-full items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left h-auto font-normal rounded-none justify-start"
                        >
                          <LogOut className="h-3.5 w-3.5 text-rose-500" />
                          <span>{loggingOut ? 'Signing out...' : 'Sign out'}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-[#0066cc] transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/doctors"
                    className="inline-flex items-center justify-center rounded-full bg-[#0066cc] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0052a3] transition-all"
                  >
                    Book an appointment
                  </Link>
                </>
              )}
            </div>

            {/* ── Mobile Header Actions (Notifications + Hamburger Toggle) ── */}
            <div className="flex items-center gap-1.5 md:hidden">
              {user && (
                <Link
                  href={isDoctor ? '/doctor/notifications' : '/patient/notifications'}
                  className="relative rounded-full p-2 text-slate-700 hover:bg-slate-100 hover:text-[#0066cc] transition-colors"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadState > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#0066cc] text-[10px] font-bold text-white shadow-xs">
                      {unreadState > 9 ? '9+' : unreadState}
                    </span>
                  )}
                </Link>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-full p-2 text-slate-700 hover:bg-slate-100 transition-colors h-9 w-9"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer Backdrop (Outside header so fixed positioning is viewport-relative) ── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 md:hidden transition-opacity duration-300"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile Slide-Over Drawer (from Right Side, 100vh height) ── */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] h-full h-[100dvh] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out md:hidden',
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-label="Mobile Navigation Drawer"
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <BrandMark size="sm" />
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-slate-900 leading-none">
                Care<span className="text-[#0066cc]">Up</span>
              </span>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mt-0.5">
                Health Portal
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={closeMobile}
            className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 h-9 w-9"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 bg-white">
          {user ? (
            <div className="flex flex-col space-y-3">
              {/* User Profile Card */}
              <Link
                href={isDoctor ? '/doctor/profile' : '/patient/profile'}
                onClick={closeMobile}
                className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-50/90 via-slate-50 to-indigo-50/40 border border-blue-100 p-3.5 shadow-xs hover:border-blue-200 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0066cc] text-sm font-bold text-white shadow-xs ring-2 ring-blue-100 group-hover:scale-105 transition-transform">
                    {(user?.email?.[0] || 'U').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {user?.email?.split('@')[0] || 'User'}
                      </p>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#0066cc] uppercase tracking-wider">
                        {roleLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </Link>

              {/* Navigation Items */}
              <div className="space-y-1">
                <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Menu
                </p>

                {/* Dashboard */}
                <Link
                  href={isDoctor ? '/doctor/dashboard' : '/patient/dashboard'}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                    pathname.includes('dashboard')
                      ? 'bg-blue-50 text-[#0066cc] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className="h-4 w-4 text-[#0066cc]" />
                    <span>Dashboard</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>

                {/* Book a visit */}
                <Link
                  href="/doctors"
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                    pathname === '/doctors' || pathname === '/'
                      ? 'bg-blue-50 text-[#0066cc] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Stethoscope className="h-4 w-4 text-[#0066cc]" />
                    <span>Book a visit</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>

                {/* Appointments */}
                <Link
                  href={isDoctor ? '/doctor/appointments' : '/patient/appointments'}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                    pathname.includes('appointments')
                      ? 'bg-blue-50 text-[#0066cc] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-[#0066cc]" />
                    <span>Appointments</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>

                {/* Payments & Receipts (Patients) */}
                {!isDoctor && (
                  <Link
                    href="/patient/payments"
                    onClick={closeMobile}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                      pathname.startsWith('/patient/payments')
                        ? 'bg-blue-50 text-[#0066cc] font-semibold'
                        : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-[#0066cc]" />
                      <span>Payments</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </Link>
                )}

                {/* Notifications with Bell Icon */}
                <Link
                  href={isDoctor ? '/doctor/notifications' : '/patient/notifications'}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                    pathname.includes('notifications')
                      ? 'bg-blue-50 text-[#0066cc] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Bell className="h-4 w-4 text-[#0066cc]" />
                    <span>Notifications</span>
                  </div>
                  {unreadState > 0 ? (
                    <span className="rounded-full bg-[#0066cc] px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      {unreadState > 9 ? '9+' : unreadState} new
                    </span>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  )}
                </Link>

                {/* Profile */}
                <Link
                  href={isDoctor ? '/doctor/profile' : '/patient/profile'}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                    pathname.includes('profile')
                      ? 'bg-blue-50 text-[#0066cc] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-[#0066cc]" />
                    <span>Profile</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
              </div>

              {/* Help & Desk Support */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <a
                  href="tel:01314960280"
                  className="flex items-center justify-between text-xs font-semibold text-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-[#0066cc] shadow-xs">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-slate-500">CareUp Desk</p>
                      <p className="text-xs font-bold text-slate-800">0131 496 0280</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#0066cc] bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/60">
                    Call
                  </span>
                </a>
              </div>
            </div>
          ) : (
            /* Logged Out View */
            <div className="flex flex-col space-y-4">
              <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50/40 p-4 border border-blue-100/80 shadow-xs">
                <p className="text-sm font-bold text-slate-900">Welcome to CareUp</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Book certified doctor appointments and consult online or in clinic.
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/login"
                    onClick={closeMobile}
                    className="flex-1 rounded-xl bg-white border border-slate-200 py-2 text-center text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50 transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/doctors"
                    onClick={closeMobile}
                    className="flex-1 rounded-xl bg-[#0066cc] py-2 text-center text-xs font-semibold text-white shadow-xs hover:bg-[#0052a3] transition-colors"
                  >
                    Book visit
                  </Link>
                </div>
              </div>

              <div className="space-y-1">
                <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Explore
                </p>
                <Link
                  href="/#doctors-section"
                  onClick={closeMobile}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Stethoscope className="h-4 w-4 text-[#0066cc]" />
                    <span>Our doctors</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
                <Link
                  href="/#how-it-works"
                  onClick={closeMobile}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-[#0066cc]" />
                    <span>How it works</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <a
                  href="tel:01314960280"
                  className="flex items-center justify-between text-xs font-semibold text-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-[#0066cc] shadow-xs">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-slate-500">Contact Desk</p>
                      <p className="text-xs font-bold text-slate-800">0131 496 0280</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#0066cc] bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/60">
                    Call
                  </span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Bottom Footer (Logout for logged in user) */}
        {user && (
          <div className="p-4 border-t border-slate-100 shrink-0 bg-slate-50/70">
            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-rose-200 bg-rose-50/80 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors shadow-xs h-auto"
            >
              <LogOut className="h-4 w-4" />
              <span>{loggingOut ? 'Signing out...' : 'Sign out'}</span>
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
