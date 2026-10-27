'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  LogOut,
  Menu,
  X,
  Calendar,
  User,
  Stethoscope,
  Activity,
  Clock,
  ChevronRight,
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

function NavLink({
  href,
  children,
  active,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'relative px-3.5 py-2 text-sm font-medium transition-all duration-200 rounded-xl',
        active
          ? 'text-blue-800 font-semibold'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
      )}
    >
      {active && (
        <span className="absolute inset-0 rounded-xl bg-blue-50/80 border border-blue-200/40" style={{ boxShadow: '0 1px 3px rgba(37,99,235,0.06)' }} />
      )}
      <span className="relative">{children}</span>
    </Link>
  );
}

export function Navbar({ user, unreadCount = 0 }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
  const isPatient = user?.role === 'PATIENT';
  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 glass-panel">
      <div className="page-container">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <BrandMark size="md" />
              <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-blue-700 transition-colors">
                Schedula
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-0.5 lg:flex">
              <NavLink href="/doctors" active={pathname === '/doctors'}>
                Find Doctors
              </NavLink>

              {isPatient && (
                <>
                  <NavLink
                    href="/patient/dashboard"
                    active={pathname === '/patient/dashboard'}
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    href="/patient/appointments"
                    active={pathname === '/patient/appointments'}
                  >
                    My Appointments
                  </NavLink>
                </>
              )}

              {isDoctor && (
                <>
                  <NavLink
                    href="/doctor/dashboard"
                    active={pathname === '/doctor/dashboard'}
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    href="/doctor/my-day"
                    active={pathname === '/doctor/my-day'}
                  >
                    My Day
                  </NavLink>
                  <NavLink
                    href="/doctor/appointments"
                    active={pathname === '/doctor/appointments'}
                  >
                    Live Queue
                  </NavLink>
                  <NavLink
                    href="/doctor/availability"
                    active={pathname === '/doctor/availability'}
                  >
                    Availability
                  </NavLink>

                </>
              )}
            </nav>
          </div>

          {/* Desktop Right Side */}
          <div className="hidden items-center gap-3 md:flex">
            {isPatient && (
              <Link
                href="/patient/notifications"
                className={cn(
                  'relative rounded-xl p-2.5 text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-800',
                  pathname === '/patient/notifications' && 'bg-blue-50 text-blue-800',
                )}
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #e11d48, #f43f5e)' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href={isDoctor ? '/doctor/profile' : '/patient/profile'}
                  className="flex items-center gap-2.5 rounded-full border border-slate-200/70 bg-white py-1 pl-1 pr-3.5 text-sm transition-all duration-200 hover:border-blue-400/40 hover:shadow-sm"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%)' }}>
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="max-w-[120px] truncate font-medium text-slate-800 text-xs">
                      {user.email.split('@')[0]}
                    </span>
                    <span className="text-[10px] font-medium text-blue-600 capitalize">
                      {user.role.toLowerCase()}
                    </span>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="rounded-xl p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
                >
                  Sign In
                </Link>
                <Link href="/signup" className="btn-primary text-sm">
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            {isPatient && unreadCount > 0 && (
              <Link
                href="/patient/notifications"
                className="relative p-2 text-slate-500"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-600" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200/70 bg-white px-4 py-5 md:hidden animate-fade-up" style={{ animationDuration: '0.2s' }}>
          <div className="flex flex-col gap-1">
            <NavLink href="/doctors" active={pathname === '/doctors'} onClick={closeMobile}>
              Find Doctors
            </NavLink>

            {isPatient && (
              <>
                <NavLink
                  href="/patient/dashboard"
                  active={pathname === '/patient/dashboard'}
                  onClick={closeMobile}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  href="/patient/appointments"
                  active={pathname === '/patient/appointments'}
                  onClick={closeMobile}
                >
                  Appointments
                </NavLink>
                <NavLink
                  href="/patient/notifications"
                  active={pathname === '/patient/notifications'}
                  onClick={closeMobile}
                >
                  Notifications ({unreadCount})
                </NavLink>
                <NavLink
                  href="/patient/profile"
                  active={pathname === '/patient/profile'}
                  onClick={closeMobile}
                >
                  Profile Details
                </NavLink>
              </>
            )}

            {isDoctor && (
              <>
                <NavLink
                  href="/doctor/dashboard"
                  active={pathname === '/doctor/dashboard'}
                  onClick={closeMobile}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  href="/doctor/my-day"
                  active={pathname === '/doctor/my-day'}
                  onClick={closeMobile}
                >
                  My Day
                </NavLink>
                <NavLink
                  href="/doctor/appointments"
                  active={pathname === '/doctor/appointments'}
                  onClick={closeMobile}
                >
                  Patient Queue
                </NavLink>
                <NavLink
                  href="/doctor/availability"
                  active={pathname === '/doctor/availability'}
                  onClick={closeMobile}
                >
                  Weekly Availability
                </NavLink>
                <NavLink
                  href="/doctor/leave"
                  active={pathname === '/doctor/leave'}
                  onClick={closeMobile}
                >
                  Leave Calendar
                </NavLink>
                <NavLink
                  href="/doctor/profile"
                  active={pathname === '/doctor/profile'}
                  onClick={closeMobile}
                >
                  Doctor Profile
                </NavLink>
              </>
            )}
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-white" style={{ background: 'linear-gradient(135deg, #1d4ed8, #0284c7)' }}>
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{user.email}</p>
                    <p className="text-xs text-blue-600 capitalize font-medium">{user.role.toLowerCase()}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="btn-danger w-full justify-center"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/login" onClick={closeMobile} className="btn-secondary justify-center">
                  Sign In
                </Link>
                <Link href="/signup" onClick={closeMobile} className="btn-primary justify-center">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
