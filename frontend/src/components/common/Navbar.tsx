'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { SessionUser } from '@/types';
import { toast } from 'sonner';
import { BrandMark } from '@/components/ui/BrandMark';
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
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-all duration-200">
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
                    href="/patient/appointments"
                    className={cn(
                      'relative px-4 py-2 text-xs font-semibold transition-all duration-200',
                      pathname.startsWith('/patient/appointments')
                        ? 'text-[#0066cc]'
                        : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    <span>Appointments</span>
                    {pathname.startsWith('/patient/appointments') && (
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

          {/* ── Right Side: Phone + Bell/Auth ── */}
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
                  href="/patient/notifications"
                  className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-[#0066cc] transition-colors border border-slate-200"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#0066cc] text-[10px] font-bold text-white shadow-xs">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* User Profile Dropdown Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-xs font-semibold text-slate-900 transition-all hover:bg-slate-50 hover:border-slate-300 shadow-xs"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#18191f] text-xs font-bold text-white">
                      {(user?.email?.[0] || 'R').toUpperCase()}
                    </div>
                    <span>{user?.email?.split('@')[0] || 'Raj'}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>

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
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex w-full items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left"
                      >
                        <LogOut className="h-3.5 w-3.5 text-rose-500" />
                        <span>{loggingOut ? 'Signing out...' : 'Sign out'}</span>
                      </button>
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

          {/* ── Mobile Menu Toggle Button ── */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-full p-2 text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu Drawer ── */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-1.5">
            <Link
              href="/doctors"
              onClick={closeMobile}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Book a visit
            </Link>
            <Link
              href="/patient/appointments"
              onClick={closeMobile}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Appointments
            </Link>
            <Link
              href="/patient/dashboard"
              onClick={closeMobile}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Dashboard
            </Link>
            <Link
              href="/#good-to-know"
              onClick={closeMobile}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Contact
            </Link>

            <div className="my-2 border-t border-slate-100 pt-2">
              <a
                href="tel:01314390280"
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                <span>Desk: 0131 439 0280</span>
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
