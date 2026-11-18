'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { SessionUser, Receptionist } from '@/types';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/button';
import {
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
import { LiquidProfileDropdown } from '@/components/common/LiquidProfileDropdown';

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
      } catch { }
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
            {/* Brand Logo */}
            <div className="flex items-center gap-3">
              <Link href="/receptionist/dashboard" className="flex items-center gap-2 group">
                <BrandMark size="sm" />
                <span className="text-lg font-black tracking-tight text-slate-900 group-hover:text-[#0066cc] transition-colors">
                  Care<span className="text-[#0066cc]">Up</span>
                </span>
              </Link>
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
                <Activity className="h-3.5 w-3.5" />
                <span>Live Queue</span>
              </Link>
            </nav>

            {/* Right Side: Clock & Receptionist Identity & Logout */}
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono font-bold text-slate-600 bg-slate-100/80 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>{currentTime || '12:00:00 PM'}</span>
              </div>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <LiquidProfileDropdown
                  user={user}
                  userName={receptionist?.fullName || user.email?.split('@')[0]}
                  roleLabel="Front Desk"
                  onLogout={handleLogout}
                  loggingOut={loggingOut}
                />
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
