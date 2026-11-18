'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  CreditCard,
  LogOut,
  Clock,
  CalendarCheck,
  CalendarDays,
  Activity,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { SessionUser } from '@/types';
import { cn } from '@/lib/utils';
import { DockItem, DockIcon, DockLabel } from '@/components/ui/dock';

export interface LiquidProfileDropdownProps {
  user: SessionUser;
  userName?: string;
  isDoctor?: boolean;
  roleLabel: string;
  onLogout: () => void;
  loggingOut?: boolean;
  className?: string;
}

export interface ProfileMenuItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  isDanger?: boolean;
}

function getInitialDisplayName(user?: SessionUser, userName?: string, isDoctor?: boolean): string {
  if (userName?.trim()) return userName.trim();
  const prefix = user?.email?.split('@')[0] || '';
  if (prefix && !prefix.toLowerCase().startsWith('patient') && !prefix.toLowerCase().startsWith('doctor')) {
    return isDoctor ? `Dr. ${prefix}` : prefix;
  }
  return isDoctor ? 'Doctor' : 'Patient';
}

function getRoleMenuItems(
  user: SessionUser,
  isDoctor: boolean,
  onLogout: () => void,
  loggingOut: boolean,
): ProfileMenuItem[] {
  if (isDoctor || user.role === 'DOCTOR') {
    return [
      {
        id: 'profile',
        label: 'Doctor Profile',
        description: 'Bio, specialty & credentials',
        icon: <User className="h-4 w-4" />,
        href: '/doctor/profile',
      },
      {
        id: 'availability',
        label: 'Availability & Slots',
        description: 'OPD timings, leaves & limits',
        icon: <Clock className="h-4 w-4" />,
        href: '/doctor/availability',
      },
      {
        id: 'my-day',
        label: 'My Day Command Center',
        description: "Today's queue & patient rounds",
        icon: <CalendarDays className="h-4 w-4" />,
        href: '/doctor/my-day',
      },
      {
        id: 'logout',
        label: loggingOut ? 'Signing out...' : 'Sign out',
        description: 'End active session securely',
        icon: <LogOut className="h-4 w-4" />,
        onClick: onLogout,
        isDanger: true,
      },
    ];
  }

  if (user.role === 'PATIENT') {
    return [
      {
        id: 'profile',
        label: 'My Profile',
        description: 'Personal info & emergency contact',
        icon: <User className="h-4 w-4" />,
        href: '/patient/profile',
      },
      {
        id: 'appointments',
        label: 'My Appointments',
        description: 'Scheduled visits & live queue status',
        icon: <CalendarCheck className="h-4 w-4" />,
        href: '/patient/appointments',
      },
      {
        id: 'payments',
        label: 'Payments & History',
        description: 'Invoices, refunds & billing',
        icon: <CreditCard className="h-4 w-4" />,
        href: '/patient/payments',
      },
      {
        id: 'logout',
        label: loggingOut ? 'Signing out...' : 'Sign out',
        description: 'End active session securely',
        icon: <LogOut className="h-4 w-4" />,
        onClick: onLogout,
        isDanger: true,
      },
    ];
  }

  if (user.role === 'RECEPTIONIST') {
    return [
      {
        id: 'queue',
        label: 'Live Queue Desk',
        description: 'Tokens & patient flow',
        icon: <Activity className="h-4 w-4" />,
        href: '/receptionist/queue',
      },
      {
        id: 'appointments',
        label: 'Clinic Appointments',
        description: 'Multi-doctor schedule ledger',
        icon: <CalendarCheck className="h-4 w-4" />,
        href: '/receptionist/appointments',
      },
      {
        id: 'logout',
        label: loggingOut ? 'Signing out...' : 'Sign out',
        description: 'End active session securely',
        icon: <LogOut className="h-4 w-4" />,
        onClick: onLogout,
        isDanger: true,
      },
    ];
  }

  // Fallback / Admin
  return [
    {
      id: 'dashboard',
      label: 'Admin Dashboard',
      description: 'Clinic overview & metrics',
      icon: <ShieldCheck className="h-4 w-4" />,
      href: '/admin/dashboard',
    },
    {
      id: 'logout',
      label: loggingOut ? 'Signing out...' : 'Sign out',
      description: 'End active session securely',
      icon: <LogOut className="h-4 w-4" />,
      onClick: onLogout,
      isDanger: true,
    },
  ];
}

/**
 * Modern Frosted-Glass Profile Dropdown with:
 * - Backdrop blur & glassmorphism
 * - Shared layoutId sliding blue highlight box (from doctor sidebar)
 * - Focus + Blur on hover (hovered item in sharp focus, others softly blurred)
 * - Clean readable typography (no text reversing/rolling)
 */
export function LiquidProfileDropdown({
  user,
  userName,
  isDoctor = false,
  roleLabel,
  onLogout,
  loggingOut = false,
  className,
}: LiquidProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [resolvedName, setResolvedName] = useState<string>(() =>
    getInitialDisplayName(user, userName, isDoctor),
  );

  useEffect(() => {
    if (userName?.trim()) {
      setResolvedName(userName.trim());
      try {
        localStorage.setItem(isDoctor ? 'careup_doctor_name' : 'careup_user_name', userName.trim());
      } catch {}
    } else {
      try {
        const stored = localStorage.getItem(isDoctor ? 'careup_doctor_name' : 'careup_user_name');
        if (stored?.trim()) {
          setResolvedName(stored.trim());
        }
      } catch {}
    }
  }, [userName, isDoctor]);

  const cleanName = resolvedName.replace(/^Dr\.\s*/i, '').trim();
  const initialLetter = (cleanName[0] || (isDoctor ? 'D' : 'P')).toUpperCase();

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHoveredId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setHoveredId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const menuItems = getRoleMenuItems(user, isDoctor, onLogout, loggingOut);

  return (
    <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
      {/* ── Profile Trigger Pill ── */}
      <motion.button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'flex items-center gap-2.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer select-none',
          isOpen
            ? 'bg-blue-50/90 border-[#0066cc]/40 text-[#0066cc] shadow-xs ring-2 ring-[#0066cc]/20'
            : 'bg-white/90 hover:bg-white border-slate-200/90 text-slate-800 shadow-2xs hover:shadow-xs hover:border-slate-300',
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="relative">
          <div
            suppressHydrationWarning
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors shadow-2xs',
              isOpen ? 'bg-[#0066cc] text-white' : 'bg-[#18191f] text-white',
            )}
          >
            {initialLetter}
          </div>
          {/* Active Status Dot */}
          <span className="w-2 h-2 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5 shadow-2xs" />
        </div>

        <span
          suppressHydrationWarning
          className="text-xs font-bold text-slate-800 truncate max-w-[105px]"
        >
          {resolvedName}
        </span>

        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-slate-400 transition-transform duration-250',
            isOpen && 'rotate-180 text-[#0066cc]',
          )}
        />
      </motion.button>

      {/* ── Frosted-Glass Dropdown Window (Popping with camera-blur effect) ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            style={{ transformOrigin: 'top right' }}
            initial={{ opacity: 0, scale: 0.85, y: -12, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.88, y: -10, filter: 'blur(8px)' }}
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 24,
              mass: 0.55,
              filter: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.18, ease: 'easeOut' },
            }}
            className="absolute right-0 top-full mt-2.5 z-50 w-72 rounded-2xl bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)] p-2 select-none ring-1 ring-black/[0.04] overflow-hidden"
          >
            {/* Header: User Profile Details */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50/80 border border-slate-100/90 mb-1.5">
              <div
                suppressHydrationWarning
                className="w-9 h-9 rounded-full bg-blue-100 text-[#0066cc] font-black text-sm flex items-center justify-center shrink-0 border border-blue-200/60 shadow-2xs"
              >
                {initialLetter}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  suppressHydrationWarning
                  className="text-xs font-bold text-slate-900 truncate"
                >
                  {resolvedName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-blue-50 text-[#0066cc] font-bold text-[9px] uppercase tracking-wider border border-blue-100">
                    {roleLabel || (isDoctor ? 'Doctor' : 'Patient')}
                  </span>
                  <span
                    suppressHydrationWarning
                    className="text-[10px] text-slate-400 truncate"
                  >
                    {user.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Items with Sliding Blue Box & Focus-Blur Effect */}
            <div
              className="flex flex-col gap-0.5 relative py-0.5"
              onMouseLeave={() => setHoveredId(null)}
            >
              {menuItems.map((item) => {
                const isHovered = hoveredId === item.id;
                const isDimmed = hoveredId !== null && !isHovered;

                return (
                  <div
                    key={item.id}
                    className="relative rounded-xl"
                    onMouseEnter={() => setHoveredId(item.id)}
                  >
                    {/* Shared Sliding Highlight Box */}
                    {isHovered && (
                      <motion.div
                        layoutId="profile-dropdown-sliding-box"
                        className={cn(
                          'absolute inset-0 rounded-xl pointer-events-none z-0',
                          item.isDanger
                            ? 'bg-rose-50/90 border border-rose-200/90 shadow-2xs'
                            : 'bg-[#edf4fe] border border-[#cde0fc] shadow-2xs',
                        )}
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 30,
                          mass: 0.55,
                        }}
                      />
                    )}

                    {/* Menu Item Content */}
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => {
                          setIsOpen(false);
                          setHoveredId(null);
                        }}
                        className={cn(
                          'relative z-10 flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 select-none',
                          isHovered
                            ? item.isDanger
                              ? 'text-rose-600 font-bold'
                              : 'text-[#0066cc] font-bold'
                            : item.isDanger
                              ? 'text-rose-600 font-medium'
                              : 'text-slate-700 font-medium',
                          isDimmed && 'filter blur-[1.2px] opacity-40 scale-[0.98]',
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              'shrink-0 transition-transform duration-200',
                              isHovered ? 'scale-110' : 'scale-100',
                              item.isDanger
                                ? isHovered
                                  ? 'text-rose-600'
                                  : 'text-rose-500'
                                : isHovered
                                  ? 'text-[#0066cc]'
                                  : 'text-slate-500',
                            )}
                          >
                            {item.icon}
                          </span>
                          <div className="min-w-0 text-left">
                            <p className="truncate leading-tight">{item.label}</p>
                            {item.description && (
                              <p
                                className={cn(
                                  'text-[10px] truncate transition-colors font-normal leading-tight mt-0.5',
                                  isHovered
                                    ? item.isDanger
                                      ? 'text-rose-400'
                                      : 'text-[#0066cc]/70'
                                    : 'text-slate-400',
                                )}
                              >
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          className={cn(
                            'w-3.5 h-3.5 transition-all duration-200 shrink-0',
                            isHovered
                              ? item.isDanger
                                ? 'text-rose-500 translate-x-0.5 opacity-100'
                                : 'text-[#0066cc] translate-x-0.5 opacity-100'
                              : 'text-slate-300 opacity-0',
                          )}
                        />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          setHoveredId(null);
                          item.onClick?.();
                        }}
                        className={cn(
                          'relative z-10 flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 select-none text-left',
                          isHovered
                            ? item.isDanger
                              ? 'text-rose-600 font-bold'
                              : 'text-[#0066cc] font-bold'
                            : item.isDanger
                              ? 'text-rose-600 font-medium'
                              : 'text-slate-700 font-medium',
                          isDimmed && 'filter blur-[1.2px] opacity-40 scale-[0.98]',
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              'shrink-0 transition-transform duration-200',
                              isHovered ? 'scale-110' : 'scale-100',
                              item.isDanger
                                ? isHovered
                                  ? 'text-rose-600'
                                  : 'text-rose-500'
                                : isHovered
                                  ? 'text-[#0066cc]'
                                  : 'text-slate-500',
                            )}
                          >
                            {item.icon}
                          </span>
                          <div className="min-w-0 text-left">
                            <p className="truncate leading-tight">{item.label}</p>
                            {item.description && (
                              <p
                                className={cn(
                                  'text-[10px] truncate transition-colors font-normal leading-tight mt-0.5',
                                  isHovered
                                    ? item.isDanger
                                      ? 'text-rose-400'
                                      : 'text-[#0066cc]/70'
                                    : 'text-slate-400',
                                )}
                              >
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          className={cn(
                            'w-3.5 h-3.5 transition-all duration-200 shrink-0',
                            isHovered
                              ? item.isDanger
                                ? 'text-rose-500 translate-x-0.5 opacity-100'
                                : 'text-[#0066cc] translate-x-0.5 opacity-100'
                              : 'text-slate-300 opacity-0',
                          )}
                        />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Dock Profile Menu Item:
 * Perfectly circular dock item that opens the frosted-glass menu card below the dock on click!
 */
export function DockProfileMenu({
  item,
  user,
  userName,
  isDoctor,
  roleLabel,
  onLogout,
  loggingOut,
}: {
  item: { title: string; icon: React.ReactNode };
  user: SessionUser;
  userName?: string;
  isDoctor: boolean;
  roleLabel: string;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [resolvedName, setResolvedName] = useState<string>(() =>
    getInitialDisplayName(user, userName, isDoctor),
  );

  useEffect(() => {
    if (userName?.trim()) {
      setResolvedName(userName.trim());
      try {
        localStorage.setItem(isDoctor ? 'careup_doctor_name' : 'careup_user_name', userName.trim());
      } catch {}
    } else {
      try {
        const stored = localStorage.getItem(isDoctor ? 'careup_doctor_name' : 'careup_user_name');
        if (stored?.trim()) setResolvedName(stored.trim());
      } catch {}
    }
  }, [userName, isDoctor]);

  const cleanName = resolvedName.replace(/^Dr\.\s*/i, '').trim();
  const initialLetter = (cleanName[0] || (isDoctor ? 'D' : 'P')).toUpperCase();

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHoveredId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setHoveredId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const menuItems = getRoleMenuItems(user, isDoctor, onLogout, loggingOut);

  return (
    <div ref={containerRef} className="relative flex items-end h-full">
      {/* ── Native DockItem ── */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer flex items-end h-full"
      >
        <DockItem className="aspect-square rounded-full shadow-xs transition-colors bg-white/60 text-slate-700 hover:bg-white/90 border border-white/60">
          <DockLabel>{item.title}</DockLabel>
          <DockIcon>{item.icon}</DockIcon>
        </DockItem>
      </div>

      {/* ── Frosted-Glass Dropdown Window Below Dock (Popping with camera-blur effect) ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            style={{ transformOrigin: 'top right' }}
            initial={{ opacity: 0, scale: 0.85, y: -12, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.88, y: -10, filter: 'blur(8px)' }}
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 24,
              mass: 0.55,
              filter: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.18, ease: 'easeOut' },
            }}
            className="absolute top-full mt-3 right-0 z-[100] w-72 rounded-2xl bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)] p-2 select-none ring-1 ring-black/[0.04] overflow-hidden"
          >
            {/* Header: User Profile Details */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50/80 border border-slate-100/90 mb-1.5">
              <div
                suppressHydrationWarning
                className="w-9 h-9 rounded-full bg-blue-100 text-[#0066cc] font-black text-sm flex items-center justify-center shrink-0 border border-blue-200/60 shadow-2xs"
              >
                {initialLetter}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  suppressHydrationWarning
                  className="text-xs font-bold text-slate-900 truncate"
                >
                  {resolvedName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-blue-50 text-[#0066cc] font-bold text-[9px] uppercase tracking-wider border border-blue-100">
                    {roleLabel || (isDoctor ? 'Doctor' : 'Patient')}
                  </span>
                  <span
                    suppressHydrationWarning
                    className="text-[10px] text-slate-400 truncate"
                  >
                    {user.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Items with Sliding Blue Box & Focus-Blur Effect */}
            <div
              className="flex flex-col gap-0.5 relative py-0.5"
              onMouseLeave={() => setHoveredId(null)}
            >
              {menuItems.map((menuItem) => {
                const isHovered = hoveredId === menuItem.id;
                const isDimmed = hoveredId !== null && !isHovered;

                return (
                  <div
                    key={menuItem.id}
                    className="relative rounded-xl"
                    onMouseEnter={() => setHoveredId(menuItem.id)}
                  >
                    {/* Shared Sliding Highlight Box */}
                    {isHovered && (
                      <motion.div
                        layoutId="dock-profile-menu-sliding-box"
                        className={cn(
                          'absolute inset-0 rounded-xl pointer-events-none z-0',
                          menuItem.isDanger
                            ? 'bg-rose-50/90 border border-rose-200/90 shadow-2xs'
                            : 'bg-[#edf4fe] border border-[#cde0fc] shadow-2xs',
                        )}
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 30,
                          mass: 0.55,
                        }}
                      />
                    )}

                    {/* Menu Item Content */}
                    {menuItem.href ? (
                      <Link
                        href={menuItem.href}
                        onClick={() => {
                          setIsOpen(false);
                          setHoveredId(null);
                        }}
                        className={cn(
                          'relative z-10 flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 select-none',
                          isHovered
                            ? menuItem.isDanger
                              ? 'text-rose-600 font-bold'
                              : 'text-[#0066cc] font-bold'
                            : menuItem.isDanger
                              ? 'text-rose-600 font-medium'
                              : 'text-slate-700 font-medium',
                          isDimmed && 'filter blur-[1.2px] opacity-40 scale-[0.98]',
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              'shrink-0 transition-transform duration-200',
                              isHovered ? 'scale-110' : 'scale-100',
                              menuItem.isDanger
                                ? isHovered
                                  ? 'text-rose-600'
                                  : 'text-rose-500'
                                : isHovered
                                  ? 'text-[#0066cc]'
                                  : 'text-slate-500',
                            )}
                          >
                            {menuItem.icon}
                          </span>
                          <div className="min-w-0 text-left">
                            <p className="truncate leading-tight">{menuItem.label}</p>
                            {menuItem.description && (
                              <p
                                className={cn(
                                  'text-[10px] truncate transition-colors font-normal leading-tight mt-0.5',
                                  isHovered
                                    ? menuItem.isDanger
                                      ? 'text-rose-400'
                                      : 'text-[#0066cc]/70'
                                    : 'text-slate-400',
                                )}
                              >
                                {menuItem.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          className={cn(
                            'w-3.5 h-3.5 transition-all duration-200 shrink-0',
                            isHovered
                              ? menuItem.isDanger
                                ? 'text-rose-500 translate-x-0.5 opacity-100'
                                : 'text-[#0066cc] translate-x-0.5 opacity-100'
                              : 'text-slate-300 opacity-0',
                          )}
                        />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          setHoveredId(null);
                          menuItem.onClick?.();
                        }}
                        className={cn(
                          'relative z-10 flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 select-none text-left',
                          isHovered
                            ? menuItem.isDanger
                              ? 'text-rose-600 font-bold'
                              : 'text-[#0066cc] font-bold'
                            : menuItem.isDanger
                              ? 'text-rose-600 font-medium'
                              : 'text-slate-700 font-medium',
                          isDimmed && 'filter blur-[1.2px] opacity-40 scale-[0.98]',
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              'shrink-0 transition-transform duration-200',
                              isHovered ? 'scale-110' : 'scale-100',
                              menuItem.isDanger
                                ? isHovered
                                  ? 'text-rose-600'
                                  : 'text-rose-500'
                                : isHovered
                                  ? 'text-[#0066cc]'
                                  : 'text-slate-500',
                            )}
                          >
                            {menuItem.icon}
                          </span>
                          <div className="min-w-0 text-left">
                            <p className="truncate leading-tight">{menuItem.label}</p>
                            {menuItem.description && (
                              <p
                                className={cn(
                                  'text-[10px] truncate transition-colors font-normal leading-tight mt-0.5',
                                  isHovered
                                    ? menuItem.isDanger
                                      ? 'text-rose-400'
                                      : 'text-[#0066cc]/70'
                                    : 'text-slate-400',
                                )}
                              >
                                {menuItem.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          className={cn(
                            'w-3.5 h-3.5 transition-all duration-200 shrink-0',
                            isHovered
                              ? menuItem.isDanger
                                ? 'text-rose-500 translate-x-0.5 opacity-100'
                                : 'text-[#0066cc] translate-x-0.5 opacity-100'
                              : 'text-slate-300 opacity-0',
                          )}
                        />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Named alias
export const SmoothProfileDropdown = LiquidProfileDropdown;
