'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { SessionUser, Receptionist } from '@/types';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/button';
import {
  Headphones,
  Stethoscope,
  LogOut,
  CalendarDays,
  Clock,
  Activity,
  User,
  ShieldCheck,
  Building,
  Menu,
  X,
  ListOrdered,
} from 'lucide-react';
import { toast } from 'sonner';
import { clientAxios } from '@/lib/api/axios';
import { cn } from '@/lib/utils';

interface ReceptionistLayoutProps {
  user: SessionUser;
  receptionist: Receptionist | null;
  children: React.ReactNode;
}

export function ReceptionistLayout({
  user,
  receptionist,
  children,
}: ReceptionistLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const tick = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await clientAxios.post('/api/auth/logout');
      document.cookie = 'jwt=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
      try {
        localStorage.removeItem('careup_doctor_name');
        localStorage.removeItem('careup_user_name');
      } catch {}
      toast.success('Signed out successfully');
      window.location.href = '/login';
    } catch {
      toast.error('Logout failed');
      window.location.href = '/login';
    } finally {
      setLoggingOut(false);
    }
  };

  const doctor = receptionist?.doctor;

  const isAppointmentsActive =
    pathname === '/receptionist/appointments' || pathname === '/receptionist/dashboard';
  const isQueueActive = pathname === '/receptionist/queue';

  return (
    <div className="min-h-screen bg-[#f8fbff] text-slate-900 flex flex-col">
      {/* Top Receptionist Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Brand Logo & Receptionist Title */}
            <div className="flex items-center gap-3">
              <Link href="/receptionist/dashboard" className="flex items-center gap-2 group">
                <BrandMark size="sm" />
                <span className="text-lg font-black tracking-tight text-slate-900 group-hover:text-[#0066cc] transition-colors">
                  Care<span className="text-[#0066cc]">Up</span>
                </span>
              </Link>
              <span className="h-4 w-px bg-slate-200 hidden sm:block" />
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/70 text-[#0066cc] text-[11px] font-bold uppercase tracking-wider">
                <Headphones className="h-3 w-3" />
                <span>Front Desk Portal</span>
              </div>
            </div>

            {/* Center Navigation: 2 Options (Appointments & Live Queue) */}
            <nav className="flex items-center gap-1 sm:gap-2 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80">
              <Link
                href="/receptionist/appointments"
                className={cn(
                  'flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all',
                  isAppointmentsActive
                    ? 'bg-white text-[#0066cc] shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50',
                )}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>All Appointments</span>
              </Link>

              <Link
                href="/receptionist/queue"
                className={cn(
                  'flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all relative',
                  isQueueActive
                    ? 'bg-white text-[#0066cc] shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50',
                )}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Activity className="h-3.5 w-3.5" />
                <span>Live Queue</span>
              </Link>
            </nav>

            {/* Right Side: Doctor Badge & Clock & Receptionist Identity & Logout */}
            <div className="flex items-center gap-3">
              {doctor && (
                <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200">
                  <Stethoscope className="h-3.5 w-3.5 text-[#0066cc]" />
                  <div className="text-left text-xs leading-none">
                    <p className="font-bold text-slate-800">Dr. {doctor.fullName}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{doctor.specialization}</p>
                  </div>
                </div>
              )}

              <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono font-bold text-slate-600 bg-slate-100/80 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>{currentTime || '12:00:00 PM'}</span>
              </div>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="text-right hidden md:block">
                  <p className="text-xs font-bold text-slate-900 leading-tight">
                    {receptionist?.fullName || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">Front Desk</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="rounded-xl border-slate-200 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 h-9 gap-1.5 cursor-pointer shadow-2xs"
                  title="Sign out of Receptionist Portal"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{loggingOut ? 'Signing out...' : 'Logout'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
