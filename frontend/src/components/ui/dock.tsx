'use client';

import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
  type SpringOptions,
  AnimatePresence,
} from 'framer-motion';
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

const DOCK_HEIGHT = 124;
const DEFAULT_MAGNIFICATION = 68;
const DEFAULT_DISTANCE = 140;
const DEFAULT_PANEL_HEIGHT = 58;

type DockProps = {
  children: React.ReactNode;
  className?: string;
  distance?: number;
  panelHeight?: number;
  magnification?: number;
  spring?: SpringOptions;
};
type DockItemProps = {
  className?: string;
  children: React.ReactNode;
};
type DockLabelProps = {
  className?: string;
  children: React.ReactNode;
};
type DockIconProps = {
  className?: string;
  children: React.ReactNode;
};

type DocContextType = {
  mouseX: MotionValue<number>;
  spring: SpringOptions;
  magnification: number;
  distance: number;
};
type DockProviderProps = {
  children: React.ReactNode;
  value: DocContextType;
};

const DockContext = createContext<DocContextType | undefined>(undefined);

function DockProvider({ children, value }: DockProviderProps) {
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

function useDock() {
  const context = useContext(DockContext);
  if (!context) {
    throw new Error('useDock must be used within an DockProvider');
  }
  return context;
}

function Dock({
  children,
  className,
  spring = { mass: 0.1, stiffness: 180, damping: 18 },
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  panelHeight = DEFAULT_PANEL_HEIGHT,
}: DockProps) {
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  const maxHeight = useMemo(() => {
    return Math.max(DOCK_HEIGHT, magnification + 30);
  }, [magnification]);

  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div
      onMouseMove={(e) => {
        isHovered.set(1);
        mouseX.set(e.clientX);
      }}
      onMouseLeave={() => {
        isHovered.set(0);
        mouseX.set(Infinity);
      }}
      style={{
        scrollbarWidth: 'none',
      }}
      className="flex max-w-full items-end overflow-visible -mt-6 pt-6 pb-2"
    >
      <motion.div
        className={cn(
          'mx-auto flex w-fit items-end gap-4 sm:gap-5 rounded-full bg-white/65 backdrop-blur-xl border border-white/50 px-7 pb-3 pt-2.5 shadow-xl shadow-slate-900/10 ring-1 ring-black/[0.04]',
          className,
        )}
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label="Application dock"
      >
        <DockProvider value={{ mouseX, spring, distance, magnification }}>
          {children}
        </DockProvider>
      </motion.div>
    </motion.div>
  );
}

function DockItem({ children, className }: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { distance, magnification, mouseX, spring } = useDock();
  const [isHovered, setIsHovered] = useState(false);
  const restCenterRef = useRef<number | null>(null);

  // Clear cached rest center on window resize
  useEffect(() => {
    const handleResize = () => {
      restCenterRef.current = null;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const mouseDistance = useTransform(mouseX, (val) => {
    if (val === Infinity) {
      restCenterRef.current = null;
      return Infinity;
    }

    // Cache the rest center when hover starts to prevent dynamic flex/expansion feedback loops
    if (restCenterRef.current === null) {
      const domRect = ref.current?.getBoundingClientRect();
      if (domRect && domRect.width > 0) {
        restCenterRef.current = domRect.x + 21;
      }
    }

    const center =
      restCenterRef.current ?? (ref.current ? ref.current.getBoundingClientRect().x + 21 : 0);
    return val - center;
  });

  const widthTransform = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [42, magnification, 42],
  );

  const width = useSpring(widthTransform, spring);

  return (
    <motion.div
      ref={ref}
      style={{ width, height: width }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 aspect-square rounded-full cursor-pointer select-none',
        className,
      )}
      tabIndex={0}
      role="button"
      aria-haspopup="true"
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        if (typeof child.type === 'string') return child;
        return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
          width,
          isHovered,
        });
      })}
    </motion.div>
  );
}

function DockLabel({
  children,
  className,
  isHovered,
}: DockLabelProps & { isHovered?: boolean }) {
  return (
    <AnimatePresence>
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, y: -6, x: '-50%', scale: 0.85 }}
          animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
          exit={{ opacity: 0, y: -4, x: '-50%', scale: 0.85 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={cn(
            'pointer-events-none absolute top-full mt-3 left-1/2 z-50 whitespace-nowrap rounded-xl bg-slate-900/95 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white shadow-xl border border-white/10 ring-1 ring-black/10',
            className,
          )}
          role="tooltip"
        >
          {children}
          {/* Tooltip top pointer arrow pointing to the icon */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-slate-900/95 border-l border-t border-white/10" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockIcon({ children, className, ...rest }: DockIconProps) {
  const restProps = rest as Record<string, unknown>;
  const width = restProps['width'] as MotionValue<number>;

  const widthTransform = useTransform(width, (val) => val / 2.1);

  return (
    <motion.div
      style={{ width: widthTransform, height: widthTransform }}
      className={cn('flex items-center justify-center shrink-0', className)}
    >
      {children}
    </motion.div>
  );
}

export { Dock, DockIcon, DockItem, DockLabel };
