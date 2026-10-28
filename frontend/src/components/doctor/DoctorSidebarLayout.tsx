'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarCheck,
  Calendar,
  Users,
  Clock,
  User,
  LogOut,
  Bell,
  Menu,
  X,
  Stethoscope,
  ChevronDown,
} from 'lucide-react';
import { Doctor, SessionUser } from '@/types';
import { clientAxios } from '@/lib/api/axios';
import { toast } from 'sonner';

interface DoctorSidebarLayoutProps {
  user: SessionUser;
  profile: Doctor | null;
  children: React.ReactNode;
}

export function DoctorSidebarLayout({
  user,
  profile,
  children,
}: DoctorSidebarLayoutProps) {
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
    } catch {
      toast.error('Failed to log out');
    } finally {
      setLoggingOut(false);
    }
  };

  const navItems = [
    {
      label: 'Dashboard',
      href: '/doctor/dashboard',
      icon: LayoutDashboard,
      active: pathname === '/doctor/dashboard',
    },
    {
      label: 'My Day',
      href: '/doctor/my-day',
      icon: CalendarCheck,
      active: pathname === '/doctor/my-day',
    },
    {
      label: 'Appointments',
      href: '/doctor/appointments',
      icon: Calendar,
      active: pathname === '/doctor/appointments',
    },
    {
      label: 'Patients',
      href: '/doctor/appointments?filter=patients',
      icon: Users,
      active: pathname.includes('patients'),
    },
    {
      label: 'Availability',
      href: '/doctor/availability',
      icon: Clock,
      active: pathname.startsWith('/doctor/availability'),
    },
    {
      label: 'Profile',
      href: '/doctor/profile',
      icon: User,
      active: pathname.startsWith('/doctor/profile'),
    },
  ];

  const doctorName = profile?.fullName || user.email?.split('@')[0] || 'Doctor';
  const specialization = profile?.specialization || 'General Physician';
  const initials = doctorName
    .replace('Dr.', '')
    .trim()
    .split(' ')
    .map((n: string) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'DR';

  const NavContent = () => (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Brand Header */}
        <div className="px-5 py-6 flex items-center gap-3 border-b border-slate-100">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#0066cc] via-[#0055b3] to-[#00408a] text-white flex items-center justify-center shadow-xs ring-1 ring-white/20">
            <span className="text-xl font-bold leading-none">+</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-extrabold tracking-tight text-slate-900 leading-none">
                Care<span className="text-[#0066cc]">Up</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Clinician Console
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  item.active
                    ? 'bg-blue-50 text-[#0066cc] font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    item.active ? 'text-[#0066cc]' : 'text-slate-500'
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Logout button at bottom */}
      <div className="p-4 border-t border-slate-100">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0 text-slate-500" />
          <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#fafafc] text-slate-900">
      {/* Desktop Sidebar (Fixed) */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 bg-white border-r border-slate-200/80 z-30 shadow-xs">
        <NavContent />
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex justify-end p-3">
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="text-slate-400">Portal</span>
              <span>/</span>
              <span className="text-slate-900 font-semibold">Doctor Console</span>
            </div>
          </div>

          {/* Right Header: Notification & Doctor Profile */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
              </button>
            </div>

            {/* Doctor Profile Info */}
            <Link
              href="/doctor/profile"
              className="flex items-center gap-3 pl-2 hover:opacity-90 transition-opacity"
            >
              <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-300 shadow-xs">
                {initials}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  Dr. {doctorName.replace(/^Dr\.\s*/i, '')}
                </div>
                <div className="text-[11px] text-slate-500 font-medium leading-tight">
                  {specialization}
                </div>
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
