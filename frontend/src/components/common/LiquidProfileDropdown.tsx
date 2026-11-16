'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { User, CreditCard, LogOut, Clock } from 'lucide-react';
import { SessionUser } from '@/types';
import { cn } from '@/lib/utils';
import { DockItem, DockIcon, DockLabel } from '@/components/ui/dock';

const ease = [0.22, 1, 0.36, 1] as const;

interface LiquidProfileDropdownProps {
  user: SessionUser;
  userName?: string;
  isDoctor?: boolean;
  roleLabel: string;
  onLogout: () => void;
  loggingOut?: boolean;
}

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  isDanger?: boolean;
}

function MenuButton({
  item,
  isOpen,
  index,
}: {
  item: MenuItem;
  isOpen: boolean;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const animatingRef = useRef(false);
  const pendingLeaveRef = useRef(false);
  const chars = item.label.split('');
  const lockDuration = 30 * chars.length + 300;

  const handleEnter = useCallback(() => {
    pendingLeaveRef.current = false;
    if (hovered) return;
    setHovered(true);
    animatingRef.current = true;
    setTimeout(() => {
      animatingRef.current = false;
      if (pendingLeaveRef.current) {
        pendingLeaveRef.current = false;
        setHovered(false);
      }
    }, lockDuration);
  }, [hovered, lockDuration]);

  const handleLeave = useCallback(() => {
    if (animatingRef.current) {
      pendingLeaveRef.current = true;
    } else {
      setHovered(false);
    }
  }, []);

  const buttonContent = (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={item.onClick}
      className={cn(
        'flex items-center justify-between w-full px-4 py-2 rounded-xl transition-all cursor-pointer select-none group',
        item.isDanger
          ? 'hover:bg-rose-50 text-rose-600 hover:text-rose-700'
          : 'hover:bg-slate-100 text-slate-800 hover:text-slate-950',
      )}
    >
      {/* Icon */}
      {item.icon && (
        <span
          className={cn(
            'shrink-0 mr-3 transition-transform duration-300 group-hover:scale-115',
            item.isDanger ? 'text-rose-500' : 'text-[#0066cc] group-hover:text-[#0055b3]',
          )}
        >
          {item.icon}
        </span>
      )}

      {/* Rolling letters carousel on hover */}
      <div
        className="flex-1 flex overflow-hidden text-[16px] font-bold tracking-tight uppercase leading-none"
        style={{
          height: '1.15em',
        }}
      >
        {chars.map((char, i) => (
          <span
            key={i}
            className="inline-block overflow-hidden"
            style={{ height: '1.15em' }}
          >
            <span
              className="flex flex-col"
              style={{
                transitionProperty: 'transform',
                transitionDuration: hovered ? '700ms' : '0ms',
                transitionDelay: hovered ? `${28 * i}ms` : '0ms',
                transform: hovered ? 'translateY(-50%)' : 'translateY(0%)',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <span
                className="block text-inherit font-bold"
                style={{ height: '1.15em', lineHeight: '1.15em' }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
              <span
                className={cn(
                  'block font-black',
                  item.isDanger ? 'text-rose-700' : 'text-[#0066cc]',
                )}
                style={{ height: '1.15em', lineHeight: '1.15em' }}
                aria-hidden
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div
      animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 10 }}
      transition={{
        duration: 0.4,
        delay: isOpen ? 0.3 + 0.07 * index : 0,
        ease,
      }}
      className="w-full"
    >
      {item.href ? (
        <Link href={item.href} className="w-full block">
          {buttonContent}
        </Link>
      ) : (
        buttonContent
      )}
    </motion.div>
  );
}

/**
 * Top Navbar Liquid Profile Dropdown:
 * Pill that morphs downwards into the liquid menu card
 */
function getInitialDisplayName(user?: SessionUser, userName?: string, isDoctor?: boolean): string {
  if (userName?.trim()) return userName.trim();
  const prefix = user?.email?.split('@')[0] || '';
  if (prefix && !prefix.toLowerCase().startsWith('patient') && !prefix.toLowerCase().startsWith('doctor')) {
    return isDoctor ? `Dr. ${prefix}` : prefix;
  }
  return isDoctor ? 'Doctor' : 'Patient';
}

export function LiquidProfileDropdown({
  user,
  userName,
  isDoctor = false,
  roleLabel,
  onLogout,
  loggingOut = false,
}: LiquidProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const menuItems: MenuItem[] = [
    {
      label: 'Profile',
      icon: <User className="h-4 w-4" />,
      href: isDoctor ? '/doctor/profile' : '/patient/profile',
      onClick: () => setIsOpen(false),
    },
    ...(isDoctor
      ? [
          {
            label: 'Availability',
            icon: <Clock className="h-4 w-4" />,
            href: '/doctor/availability',
            onClick: () => setIsOpen(false),
          },
        ]
      : [
          {
            label: 'Payments',
            icon: <CreditCard className="h-4 w-4" />,
            href: '/patient/payments',
            onClick: () => setIsOpen(false),
          },
        ]),
    {
      label: loggingOut ? 'Signing out...' : 'Sign out',
      icon: <LogOut className="h-4 w-4" />,
      onClick: () => {
        setIsOpen(false);
        onLogout();
      },
      isDanger: true,
    },
  ];

  const collapsedWidth = isDoctor ? 152 : 140;
  const collapsedHeight = 38;
  const expandedWidth = 240;
  const expandedHeight = 230;

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: collapsedWidth,
        height: collapsedHeight,
      }}
    >
      <motion.div
        className="overflow-hidden flex flex-col z-50 select-none shadow-2xl border border-slate-200/90 absolute top-0 right-0 bg-white ring-1 ring-black/[0.04]"
        onClick={() => {
          if (!isOpen) setIsOpen(true);
        }}
        style={{
          cursor: isOpen ? 'default' : 'pointer',
          transformOrigin: 'top right',
        }}
        animate={{
          width: isOpen ? expandedWidth : collapsedWidth,
          height: isOpen ? expandedHeight : collapsedHeight,
          borderRadius: isOpen ? 26 : 9999,
          scale: 1,
        }}
        whileHover={isOpen ? undefined : { scale: 1.03 }}
        transition={{
          duration: 0.8,
          ease,
          height: { duration: isOpen ? 0.8 : 0.2 },
          scale: { duration: 0.25, ease },
        }}
      >
        {/* Layer 1: Base background */}
        <motion.div
          className="absolute inset-0 bg-white"
          animate={{
            borderColor: isOpen ? 'rgba(203, 213, 225, 0.9)' : 'rgba(226, 232, 240, 0.9)',
          }}
          transition={{ duration: isOpen ? 0.15 : 0.3, ease }}
          style={{
            borderWidth: 1,
            borderStyle: 'solid',
            borderRadius: 'inherit',
          }}
        />

        {/* Layer 2: Expanding Liquid Bubble from top */}
        <motion.div
          className="absolute left-1/2 bg-white"
          style={{
            width: '260%',
            height: '260%',
            borderRadius: '50%',
            x: '-50%',
          }}
          animate={{ top: isOpen ? '-18%' : '-260%' }}
          transition={{
            duration: 0.8,
            ease,
            delay: isOpen ? 0.08 : 0,
          }}
        />

        {/* Top Trigger Bar */}
        <motion.div
          className="relative z-10 flex items-center justify-between w-full shrink-0 px-2.5 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          style={{ height: collapsedHeight }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              suppressHydrationWarning
              className={cn(
                'flex items-center justify-center rounded-full font-bold shadow-xs shrink-0 transition-colors',
                isOpen
                  ? 'bg-[#0066cc] text-white ring-2 ring-blue-100 h-7 w-7 text-xs'
                  : 'bg-[#18191f] text-white h-7 w-7 text-xs',
              )}
            >
              {initialLetter}
            </div>

            <motion.span
              suppressHydrationWarning
              className="text-xs font-bold truncate max-w-[85px] text-slate-800"
            >
              {resolvedName}
            </motion.span>
          </div>

          <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
            <motion.span
              className={cn(
                'absolute block w-3.5 h-[2px] rounded-full transition-colors',
                isOpen ? 'bg-slate-700' : 'bg-slate-500',
              )}
              animate={{
                rotate: isOpen ? 45 : 0,
                y: isOpen ? 0 : -3,
              }}
              transition={{ duration: 0.4, ease }}
            />
            <motion.span
              className={cn(
                'absolute block w-3.5 h-[2px] rounded-full transition-colors',
                isOpen ? 'bg-slate-700' : 'bg-slate-500',
              )}
              animate={{
                rotate: isOpen ? -45 : 0,
                y: isOpen ? 0 : 3,
              }}
              transition={{ duration: 0.4, ease }}
            />
          </div>
        </motion.div>

        {/* Role subtitle when open */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="relative z-10 px-4 pb-2 border-b border-slate-100"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#0066cc]">
              {roleLabel} account
            </span>
          </motion.div>
        )}

        {/* Menu items */}
        <div
          className="relative z-10 flex flex-col gap-1 items-center justify-center flex-1 px-2.5 py-3"
          style={{
            pointerEvents: isOpen ? 'auto' : 'none',
            opacity: isOpen ? 1 : 0,
            overflow: 'hidden',
          }}
        >
          {menuItems.map((item, idx) => (
            <MenuButton
              key={item.label}
              item={item}
              isOpen={isOpen}
              index={idx}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Dock Profile Menu Item:
 * Perfectly circular dock item that opens the liquid menu card below the dock on click!
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

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const menuItems: MenuItem[] = [
    {
      label: 'Profile',
      icon: <User className="h-4 w-4" />,
      href: isDoctor ? '/doctor/profile' : '/patient/profile',
      onClick: () => setIsOpen(false),
    },
    ...(isDoctor
      ? [
          {
            label: 'Availability',
            icon: <Clock className="h-4 w-4" />,
            href: '/doctor/availability',
            onClick: () => setIsOpen(false),
          },
        ]
      : [
          {
            label: 'Payments',
            icon: <CreditCard className="h-4 w-4" />,
            href: '/patient/payments',
            onClick: () => setIsOpen(false),
          },
        ]),
    {
      label: loggingOut ? 'Signing out...' : 'Sign out',
      icon: <LogOut className="h-4 w-4" />,
      onClick: () => {
        setIsOpen(false);
        onLogout();
      },
      isDanger: true,
    },
  ];

  return (
    <div ref={containerRef} className="relative flex items-end h-full">
      {/* ── Native DockItem (100% inside dock pill, perfectly aligned) ── */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer flex items-end h-full"
      >
        <DockItem className="aspect-square rounded-full shadow-xs transition-colors bg-white/60 text-slate-700 hover:bg-white/90 border border-white/60">
          <DockLabel>{item.title}</DockLabel>
          <DockIcon>{item.icon}</DockIcon>
        </DockItem>
      </div>

      {/* ── Liquid Morph Menu Below Dock ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute top-full mt-4 right-0 z-[100] overflow-hidden flex flex-col shadow-2xl bg-white border border-slate-200/90 ring-1 ring-black/[0.04]"
            style={{ transformOrigin: 'top right' }}
            initial={{ width: 44, height: 44, borderRadius: 9999, opacity: 0, scale: 0.8 }}
            animate={{ width: 230, height: 225, borderRadius: 24, opacity: 1, scale: 1 }}
            exit={{ width: 44, height: 44, borderRadius: 9999, opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.65, ease }}
          >
            {/* Layer 1: Base background */}
            <div className="absolute inset-0 bg-white" />

            {/* Layer 2: Expanding Liquid Bubble from top */}
            <motion.div
              className="absolute left-1/2 bg-white"
              style={{
                width: '260%',
                height: '260%',
                borderRadius: '50%',
                x: '-50%',
              }}
              initial={{ top: '-260%' }}
              animate={{ top: '-20%' }}
              exit={{ top: '-260%' }}
              transition={{ duration: 0.7, ease, delay: 0.05 }}
            />

            {/* Header: User identity */}
            <div className="relative z-10 flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  suppressHydrationWarning
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0066cc] text-white text-xs font-bold ring-2 ring-blue-100"
                >
                  {initialLetter}
                </div>
                <div className="min-w-0">
                  <p
                    suppressHydrationWarning
                    className="text-xs font-bold text-slate-900 truncate max-w-[120px]"
                  >
                    {resolvedName}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-[#0066cc] font-semibold">
                    {roleLabel} account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-800 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Menu items */}
            <div className="relative z-10 flex flex-col gap-1 p-2 flex-1 justify-center">
              {menuItems.map((menuItem, idx) => (
                <MenuButton
                  key={menuItem.label}
                  item={menuItem}
                  isOpen={isOpen}
                  index={idx}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
