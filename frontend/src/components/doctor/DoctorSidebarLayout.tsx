'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  createContext,
  useMemo,
  isValidElement,
  cloneElement,
  Children,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
  type SpringOptions,
} from 'framer-motion';
import {
  LayoutGrid,
  CalendarDays,
  Calendar,
  Clock,
  Bell,
  User,
  Users,
  ChevronDown,
  ArrowRight,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Headphones,
} from 'lucide-react';
import { Doctor, SessionUser } from '@/types';
import { clientAxios } from '@/lib/api/axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LiquidProfileDropdown } from '@/components/common/LiquidProfileDropdown';

interface DoctorSidebarLayoutProps {
  user: SessionUser;
  profile: Doctor | null;
  children: React.ReactNode;
}

interface NavSubItem {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  hasSubmenu?: boolean;
  subItems?: NavSubItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/doctor/dashboard',
    icon: LayoutGrid,
  },
  {
    label: 'My Day',
    href: '/doctor/my-day',
    icon: CalendarDays,
  },
  {
    label: 'Appointments',
    href: '/doctor/appointments',
    icon: Calendar,
  },
  {
    label: 'Availability',
    href: '/doctor/availability',
    icon: Clock,
    hasSubmenu: true,
    subItems: [
      { label: 'Weekly Schedule', href: '/doctor/availability' },
      { label: 'Leaves & Time Off', href: '/doctor/leave' },
    ],
  },
  {
    label: 'Patients',
    href: '/doctor/patients',
    icon: Users,
  },
  {
    label: 'Receptionists',
    href: '/doctor/receptionists',
    icon: Headphones,
  },
  {
    label: 'Notifications',
    href: '/doctor/notifications',
    icon: Bell,
  },
  {
    label: 'Profile',
    href: '/doctor/profile',
    icon: User,
  },
];

// Helper to resolve which primary item should be highlighted based on path
function resolveActiveHref(path: string): string {
  if (!path || path === '/doctor/dashboard') return '/doctor/dashboard';

  const match = NAV_ITEMS.find((item) => {
    if (item.href === '/doctor/dashboard') return false;
    if (path.startsWith(item.href)) return true;
    if (item.hasSubmenu && item.subItems?.some((sub) => path.startsWith(sub.href))) {
      return true;
    }
    return false;
  });

  return match ? match.href : '/doctor/dashboard';
}

/* ══════════════════════════════════════════════════════════════════════════════
   VERTICAL DOCK SYSTEM WITH macOS MAGNIFICATION PHYSICS
   (Exact patient-side dock physics ported to vertical orientation)
   ══════════════════════════════════════════════════════════════════════════════ */
type VerticalDocContextType = {
  mouseY: MotionValue<number>;
  spring: SpringOptions;
  magnification: number;
  distance: number;
};

const VerticalDockContext = createContext<VerticalDocContextType | undefined>(undefined);

function VerticalDockProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: VerticalDocContextType;
}) {
  return (
    <VerticalDockContext.Provider value={value}>
      {children}
    </VerticalDockContext.Provider>
  );
}

function useVerticalDock() {
  const context = useContext(VerticalDockContext);
  if (!context) {
    throw new Error('useVerticalDock must be used within VerticalDockProvider');
  }
  return context;
}

function VerticalDock({
  children,
  className,
  spring = { mass: 0.1, stiffness: 170, damping: 13 },
  magnification = 58,
  distance = 130,
}: {
  children: React.ReactNode;
  className?: string;
  spring?: SpringOptions;
  magnification?: number;
  distance?: number;
}) {
  const mouseY = useMotionValue(Infinity);

  return (
    <motion.div
      onMouseMove={(e) => mouseY.set(e.clientY)}
      onMouseLeave={() => mouseY.set(Infinity)}
      className={cn(
        'flex flex-col items-center gap-3.5 rounded-[36px] bg-white/85 backdrop-blur-2xl border border-white/70 p-3 shadow-2xl shadow-slate-900/10 ring-1 ring-black/[0.04] transition-all',
        className
      )}
      role="toolbar"
      aria-label="Doctor Dock Toolbar"
    >
      <VerticalDockProvider value={{ mouseY, spring, distance, magnification }}>
        {children}
      </VerticalDockProvider>
    </motion.div>
  );
}

function VerticalDockItem({
  children,
  className,
  isActive,
  badge,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { distance, magnification, mouseY, spring } = useVerticalDock();
  const [isHovered, setIsHovered] = useState(false);
  const restCenterRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      restCenterRef.current = null;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const mouseDistance = useTransform(mouseY, (val) => {
    if (val === Infinity) {
      restCenterRef.current = null;
      return Infinity;
    }
    if (restCenterRef.current === null) {
      const domRect = ref.current?.getBoundingClientRect();
      if (domRect && domRect.height > 0) {
        restCenterRef.current = domRect.y + 21;
      }
    }
    const center =
      restCenterRef.current ?? (ref.current ? ref.current.getBoundingClientRect().y + 21 : 0);
    return val - center;
  });

  const sizeTransform = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [42, magnification, 42]
  );

  const size = useSpring(sizeTransform, spring);

  return (
    <motion.div
      ref={ref}
      style={{ width: size, height: size }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 aspect-square rounded-2xl cursor-pointer select-none transition-colors duration-150',
        isActive
          ? 'bg-blue-50/95 text-[#0066cc] ring-2 ring-[#0066cc]/30 border border-blue-200/80 shadow-xs'
          : 'bg-white/80 text-slate-700 hover:text-slate-900 hover:bg-white border border-slate-200/50 shadow-2xs',
        className
      )}
      tabIndex={0}
      role="button"
      aria-haspopup="true"
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        return cloneElement(child as React.ReactElement<any>, {
          size,
          isHovered,
        });
      })}

      {/* Active Blue Left Pill Dot */}
      {isActive && (
        <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-2.5 w-1 rounded-r-full bg-[#0066cc]" />
      )}

      {/* Unread badge */}
      {badge && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#0066cc] text-[9px] font-extrabold text-white shadow-xs">
          {badge}
        </span>
      )}
    </motion.div>
  );
}

function VerticalDockLabel({
  children,
  isHovered,
}: {
  children: React.ReactNode;
  isHovered?: boolean;
}) {
  return (
    <AnimatePresence>
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, x: 8, y: '-50%', scale: 0.88 }}
          animate={{ opacity: 1, x: 0, y: '-50%', scale: 1 }}
          exit={{ opacity: 0, x: 6, y: '-50%', scale: 0.88 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="pointer-events-none absolute left-full ml-3.5 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-xl bg-slate-900/95 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white shadow-xl border border-white/10 ring-1 ring-black/10"
          role="tooltip"
        >
          {children}
          {/* Tooltip pointer arrow on left side */}
          <div className="absolute top-1/2 -left-1 -translate-y-1/2 h-2 w-2 rotate-45 bg-slate-900/95 border-l border-b border-white/10" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function VerticalDockIcon({
  children,
  size,
  className,
}: {
  children: React.ReactNode;
  size?: MotionValue<number>;
  className?: string;
}) {
  const iconSize = useTransform(size || new MotionValue(42), (val) => val / 2.1);

  return (
    <motion.div
      style={{ width: iconSize, height: iconSize }}
      className={cn('flex items-center justify-center shrink-0', className)}
    >
      {children}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   STANDALONE SIDEBAR CONTENT COMPONENT
   (Handles both Expanded and Collapsed Patient-Style Dock Modes)
   ══════════════════════════════════════════════════════════════════════════════ */
interface DoctorSidebarContentProps {
  pathname: string;
  unreadCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
  isMobile?: boolean;
}

function DoctorSidebarContent({
  pathname,
  unreadCount,
  isCollapsed,
  onToggleCollapse,
  onNavigate,
  isMobile = false,
}: DoctorSidebarContentProps) {
  // Currently selected item (locks on click)
  const [selectedHref, setSelectedHref] = useState<string>(() => resolveActiveHref(pathname));

  // Currently hovered item (moves the box smoothly up/down in expanded mode)
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  // Submenu open state for Availability
  const [availabilityOpen, setAvailabilityOpen] = useState<boolean>(
    pathname.startsWith('/doctor/availability') || pathname.startsWith('/doctor/leave')
  );

  useEffect(() => {
    const active = resolveActiveHref(pathname);
    setSelectedHref(active);
    if (pathname.startsWith('/doctor/availability') || pathname.startsWith('/doctor/leave')) {
      setAvailabilityOpen(true);
    }
  }, [pathname]);

  const targetHref = hoveredHref || selectedHref;

  const handleItemClick = (href: string) => {
    setSelectedHref(href);
    setHoveredHref(null);
    if (onNavigate) onNavigate();
  };

  /* ──────────────────────────────────────────────────────────────────────────
     1. COLLAPSED: macOS Patient-Style Vertical Dock with Physics Magnification
     ────────────────────────────────────────────────────────────────────────── */
  if (isCollapsed && !isMobile) {
    return (
      <div className="flex flex-col items-center justify-between h-full py-2">
        {/* Top Floating Mini Card: Heart Brand + Expand Toggle */}
        <div className="flex flex-col items-center gap-2 p-2 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-lg ring-1 ring-black/[0.03]">
          <Link
            href="/doctor/dashboard"
            onClick={() => handleItemClick('/doctor/dashboard')}
            className="group cursor-pointer relative"
          >
            <div className="w-9 h-9 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110">
              <svg className="w-9 h-9 drop-shadow-xs" viewBox="0 0 36 36" fill="none">
                <path
                  d="M18 32C18 32 4 23 4 13.5C4 8.5 8 4.5 13 4.5C15.8 4.5 17.3 5.8 18 6.8C18.7 5.8 20.2 4.5 23 4.5C28 4.5 32 8.5 32 13.5C32 23 18 32 18 32Z"
                  fill="#0066cc"
                />
                <path
                  d="M8.5 16.5H13L15.5 12L19.5 21L22.5 15.5H27.5"
                  stroke="white"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </Link>

          {/* Quick Expand Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#0066cc] hover:bg-blue-50/70 transition-all cursor-pointer relative group"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>

        {/* Center: The Patient-Style Vertical Dock with Smooth Magnification */}
        <VerticalDock magnification={58} distance={130} className="my-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedHref === item.href;
            const badgeValue =
              item.href === '/doctor/notifications' && unreadCount > 0
                ? unreadCount > 9
                  ? '9+'
                  : String(unreadCount)
                : undefined;

            return (
              <Link key={item.href} href={item.href} className="flex items-center">
                <VerticalDockItem
                  isActive={isSelected}
                  badge={badgeValue}
                  onClick={() => handleItemClick(item.href)}
                >
                  <VerticalDockLabel>{item.label}</VerticalDockLabel>
                  <VerticalDockIcon>
                    <Icon className="h-full w-full" />
                  </VerticalDockIcon>
                </VerticalDockItem>
              </Link>
            );
          })}
        </VerticalDock>

        {/* Bottom Floating Mini Card: Support Help */}
        <div className="p-2 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-lg ring-1 ring-black/[0.03]">
          <a
            href="tel:01314960280"
            className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#0066cc] hover:bg-blue-50/70 transition-all cursor-pointer relative group"
            aria-label="Need Help? Contact Support"
          >
            <Headphones className="h-4 w-4" />
            <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150">
              <div className="relative rounded-xl bg-slate-900/95 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white shadow-xl border border-white/10 whitespace-nowrap">
                <p className="font-bold">Need Help?</p>
                <p className="text-[10px] text-slate-300">0131 496 0280</p>
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 h-2 w-2 rotate-45 bg-slate-900/95 border-l border-b border-white/10" />
              </div>
            </div>
          </a>
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────────────────
     2. EXPANDED FULL VIEW (Matches Screenshot with Sliding Magic Box)
     ────────────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-3xl p-3 border border-slate-200/80 shadow-xs overflow-hidden select-none">
      {/* ── Brand Header + Collapse Button ── */}
      <div className="px-3 pt-3 pb-4 flex items-center justify-between shrink-0">
        <Link
          href="/doctor/dashboard"
          onClick={() => handleItemClick('/doctor/dashboard')}
          className="flex items-center gap-3 group"
        >
          {/* Blue Heart with White ECG Pulse */}
          <div className="relative w-10 h-10 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
            <svg className="w-10 h-10 drop-shadow-xs" viewBox="0 0 36 36" fill="none">
              <path
                d="M18 32C18 32 4 23 4 13.5C4 8.5 8 4.5 13 4.5C15.8 4.5 17.3 5.8 18 6.8C18.7 5.8 20.2 4.5 23 4.5C28 4.5 32 8.5 32 13.5C32 23 18 32 18 32Z"
                fill="#0066cc"
              />
              <path
                d="M8.5 16.5H13L15.5 12L19.5 21L22.5 15.5H27.5"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
              CareUp
            </h1>
            <p className="text-[11px] font-medium text-slate-400 leading-tight">
              Clinician Console
            </p>
          </div>
        </Link>

        {/* Desktop Collapse Button */}
        {!isMobile ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Collapse sidebar to dock"
            title="Collapse sidebar to dock"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        ) : (
          onNavigate && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onNavigate}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 h-8 w-8"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          )
        )}
      </div>

      {/* ── Navigation with Moving Highlight Box ── */}
      <LayoutGroup id={isMobile ? 'doctor-nav-mobile' : 'doctor-nav-desktop'}>
        <div
          className="flex-1 overflow-y-auto px-1 py-2 min-h-0 relative"
          onMouseLeave={() => setHoveredHref(null)}
        >
          <nav className="space-y-1 relative">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isBoxActive = targetHref === item.href;
              const isCurrentlySelected = selectedHref === item.href;
              const badgeValue =
                item.href === '/doctor/notifications' && unreadCount > 0
                  ? unreadCount > 9
                    ? '9+'
                    : String(unreadCount)
                  : undefined;

              return (
                <div
                  key={item.href}
                  className="relative rounded-2xl"
                  onMouseEnter={() => setHoveredHref(item.href)}
                >
                  {/* Single Persistent Moving Highlight Box */}
                  {isBoxActive && (
                    <motion.div
                      layoutId="doctor-sidebar-sliding-box"
                      className="absolute inset-0 rounded-2xl bg-[#edf4fe] border border-[#cde0fc] shadow-2xs pointer-events-none z-0"
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 30,
                        mass: 0.55,
                      }}
                    />
                  )}

                  {/* Menu Item Content */}
                  <div className="relative z-10">
                    {item.hasSubmenu ? (
                      <div className="flex items-center">
                        <Link
                          href={item.href}
                          onClick={() => handleItemClick(item.href)}
                          className={cn(
                            'flex-1 flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm transition-colors duration-150',
                            isBoxActive || isCurrentlySelected
                              ? 'text-[#0066cc] font-bold'
                              : 'text-slate-600 font-semibold hover:text-slate-900'
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-5 w-5 shrink-0 transition-colors duration-150',
                              isBoxActive || isCurrentlySelected
                                ? 'text-[#0066cc]'
                                : 'text-slate-500'
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </Link>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setAvailabilityOpen((prev) => !prev);
                          }}
                          className={cn(
                            'p-2.5 mr-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-all cursor-pointer',
                            (isBoxActive || isCurrentlySelected) && 'text-[#0066cc]'
                          )}
                          aria-label="Toggle availability submenu"
                        >
                          <motion.div
                            animate={{ rotate: availabilityOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </motion.div>
                        </button>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => handleItemClick(item.href)}
                        className={cn(
                          'flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm transition-colors duration-150',
                          isBoxActive || isCurrentlySelected
                            ? 'text-[#0066cc] font-bold'
                            : 'text-slate-600 font-semibold hover:text-slate-900'
                        )}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Icon
                            className={cn(
                              'h-5 w-5 shrink-0 transition-colors duration-150',
                              isBoxActive || isCurrentlySelected
                                ? 'text-[#0066cc]'
                                : 'text-slate-500'
                            )}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {badgeValue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0066cc] text-white shadow-2xs">
                            {badgeValue}
                          </span>
                        )}
                      </Link>
                    )}
                  </div>

                  {/* Availability Submenu Accordion */}
                  {item.hasSubmenu && item.subItems && (
                    <AnimatePresence>
                      {availabilityOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: 'easeInOut' }}
                          className="overflow-hidden pl-11 pr-2 pt-1 pb-1.5 space-y-1 relative z-10"
                        >
                          {item.subItems.map((sub) => {
                            const isSubActive = pathname === sub.href;
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={() => handleItemClick(sub.href)}
                                className={cn(
                                  'block py-1.5 px-3 rounded-xl text-xs font-semibold transition-all',
                                  isSubActive
                                    ? 'text-[#0066cc] bg-blue-100/70 font-bold'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
                                )}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </LayoutGroup>

      {/* ── Bottom Need Help Card (Exact from Screenshot) ── */}
      <div className="mt-auto pt-3 shrink-0">
        <div className="p-4 rounded-2xl bg-[#f4f7fc]/90 border border-slate-100 text-left space-y-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 leading-tight">
              Need Help?
            </h4>
            <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
              Contact Support
            </p>
          </div>

          <a
            href="tel:01314960280"
            className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white border border-slate-200/80 text-xs font-bold text-[#0066cc] shadow-2xs hover:bg-blue-50/60 hover:border-blue-200 hover:shadow-xs transition-all group cursor-pointer"
          >
            <span>Get Help</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 text-[#0066cc]" />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN DOCTOR SIDEBAR LAYOUT
   ══════════════════════════════════════════════════════════════════════════════ */
export function DoctorSidebarLayout({
  user,
  profile,
  children,
}: DoctorSidebarLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Collapse / Expand state (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('careup_doctor_sidebar_collapsed');
      if (saved === 'true') {
        setIsCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('careup_doctor_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;
    const fetchUnread = async () => {
      try {
        const res = await clientAxios.get<{ data: { unreadCount: number } }>(
          '/api/notifications/unread-count',
        );
        if (mounted && res.data?.data?.unreadCount !== undefined) {
          setUnreadCount(res.data.data.unreadCount);
        }
      } catch {
        // silent fail
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);

    const handleUpdate = () => fetchUnread();
    if (typeof window !== 'undefined') {
      window.addEventListener('notification_updated', handleUpdate);
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('notification_updated', handleUpdate);
      }
    };
  }, []);

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

  const displayDoctorName = profile?.fullName
    ? profile.fullName.startsWith('Dr.')
      ? profile.fullName
      : `Dr. ${profile.fullName}`
    : user.email
    ? `Dr. ${user.email.split('@')[0]}`
    : 'Doctor';

  return (
    <div className="flex min-h-screen bg-[#fafafc] text-slate-900">
      {/* Desktop Sidebar (Animated Width between 256px Expanded and 84px Dock) */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 p-3 z-30 transition-[width] duration-300 ease-in-out',
          isCollapsed ? 'w-[84px] items-center' : 'w-64'
        )}
      >
        <DoctorSidebarContent
          pathname={pathname}
          unreadCount={unreadCount}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
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
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] h-full h-[100dvh] p-3 bg-transparent z-50 flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <DoctorSidebarContent
          pathname={pathname}
          unreadCount={unreadCount}
          isCollapsed={false}
          onToggleCollapse={toggleCollapse}
          onNavigate={() => setMobileMenuOpen(false)}
          isMobile
        />
      </aside>

      {/* Main Content Area (Smooth Padding Transition) */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-in-out',
          isCollapsed ? 'lg:pl-[84px]' : 'lg:pl-64'
        )}
      >
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 h-9 w-9"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Desktop Quick Toggle Sidebar Button in Header */}
            <button
              type="button"
              onClick={toggleCollapse}
              className="hidden lg:flex p-2 rounded-xl text-slate-500 hover:text-[#0066cc] hover:bg-slate-100 transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse to dock'}
              aria-label="Toggle sidebar collapse"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="text-slate-400">Portal</span>
              <span>/</span>
              <span className="text-slate-900 font-semibold">Doctor Console</span>
            </div>
          </div>

          {/* Right Header: Notification & Doctor Profile & Logout */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <Link
                href="/doctor/notifications"
                className="p-2 rounded-xl text-slate-600 hover:text-[#0066cc] hover:bg-slate-100 transition-colors relative block"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#0066cc] text-[10px] font-bold text-white shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>

            {/* Doctor Liquid Profile Dropdown (Replaces raw profile link and standalone logout button) */}
            <LiquidProfileDropdown
              user={user}
              userName={displayDoctorName}
              isDoctor={true}
              roleLabel="Doctor"
              onLogout={handleLogout}
              loggingOut={loggingOut}
            />
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
