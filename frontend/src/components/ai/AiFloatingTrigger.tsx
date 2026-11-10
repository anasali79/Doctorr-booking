'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Bot, Mic } from 'lucide-react';

interface AiFloatingTriggerProps {
  role: 'PATIENT' | 'DOCTOR';
  onClick: () => void;
  isVoiceActive?: boolean;
}

export function AiFloatingTrigger({
  role,
  onClick,
  isVoiceActive = false,
}: AiFloatingTriggerProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef<{
    pointerStartX: number;
    pointerStartY: number;
    btnStartX: number;
    btnStartY: number;
    hasMoved: boolean;
  }>({
    pointerStartX: 0,
    pointerStartY: 0,
    btnStartX: 0,
    btnStartY: 0,
    hasMoved: false,
  });

  // Calculate clamped coordinates within the current viewport
  const clampPosition = useCallback((x: number, y: number, btnWidth = 52, btnHeight = 52) => {
    if (typeof window === 'undefined') return { x, y };
    const padding = 12;
    const maxX = Math.max(padding, window.innerWidth - btnWidth - padding);
    const maxY = Math.max(padding, window.innerHeight - btnHeight - padding);

    return {
      x: Math.min(Math.max(padding, x), maxX),
      y: Math.min(Math.max(padding, y), maxY),
    };
  }, []);

  // Initialize position on mount (load saved or default to bottom-right)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedPos = localStorage.getItem('careup_ai_widget_pos');
    const btnW = 52;
    const btnH = 52;
    const defaultX = window.innerWidth - btnW - 24;
    const defaultY = window.innerHeight - btnH - 32;

    if (savedPos) {
      try {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setPosition(clampPosition(parsed.x, parsed.y, btnW, btnH));
          return;
        }
      } catch {
        // Fall back to default
      }
    }

    setPosition(clampPosition(defaultX, defaultY, btnW, btnH));
  }, [clampPosition]);

  // Adjust position on window resize so button never goes off-screen
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        return clampPosition(prev.x, prev.y);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // Pointer Down: Start Drag Tracking
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only respond to primary button (left click or touch)
    if (e.button !== 0) return;

    const currentX = position?.x ?? (window.innerWidth - 64);
    const currentY = position?.y ?? (window.innerHeight - 76);

    dragStartRef.current = {
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      btnStartX: currentX,
      btnStartY: currentY,
      hasMoved: false,
    };

    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Browser safety fallback
    }
  };

  // Pointer Move: Update position with clamping
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.pointerStartX;
    const deltaY = e.clientY - dragStartRef.current.pointerStartY;
    const dist = Math.hypot(deltaX, deltaY);

    if (dist > 4) {
      dragStartRef.current.hasMoved = true;
    }

    const newRawX = dragStartRef.current.btnStartX + deltaX;
    const newRawY = dragStartRef.current.btnStartY + deltaY;

    const btnWidth = buttonRef.current?.offsetWidth || 52;
    const btnHeight = buttonRef.current?.offsetHeight || 52;

    setPosition(clampPosition(newRawX, newRawY, btnWidth, btnHeight));
  };

  // Pointer Up: Finalize Drag or Trigger Click
  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Fallback
    }

    // If pointer did not move significantly (less than 4px), treat as a CLICK!
    if (!dragStartRef.current.hasMoved) {
      onClick();
    } else if (position) {
      // Save new position
      try {
        localStorage.setItem('careup_ai_widget_pos', JSON.stringify(position));
      } catch {
        // Safe storage fallback
      }
    }
  };

  if (!position) return null;

  const isNearLeftEdge = (position?.x ?? 0) < 140;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
        zIndex: 50,
      }}
      className="select-none"
    >
      <div className="relative">
        {/* Tooltip Label (Zero layout shift, 100% stable, no jitter) */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap rounded-lg bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-md px-2.5 py-1 text-xs font-semibold text-white shadow-xl border border-white/10 transition-all duration-200 z-10 ${
            isNearLeftEdge ? 'left-full ml-2.5' : 'right-full mr-2.5'
          } ${
            isHovered && !isDragging
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          {role === 'DOCTOR' ? 'Doctor AI Voice' : 'Patient AI Voice'}
          {/* Tooltip Arrow */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 border-4 border-transparent ${
              isNearLeftEdge
                ? 'right-full border-r-zinc-900/95 dark:border-r-zinc-800/95'
                : 'left-full border-l-zinc-900/95 dark:border-l-zinc-800/95'
            }`}
          />
        </div>

        {/* Floating Action Button (Fixed stable dimensions w-12 h-12) */}
        <button
          ref={buttonRef}
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setIsDragging(false)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label="Open CareUp AI Voice & Chat Assistant"
          className={`relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0066cc] via-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-600/30 ring-2 ring-white/30 dark:ring-zinc-700/60 transition-transform cursor-grab active:cursor-grabbing ${
            isDragging ? 'scale-105 opacity-90' : 'hover:scale-105 active:scale-95'
          }`}
        >
          {/* Glow ambient pulse backdrop */}
          <div className="absolute -inset-1 rounded-2xl bg-blue-500/20 blur-md pointer-events-none group-hover:bg-blue-500/35 transition-all" />

          {/* Live Online Ping Indicator */}
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900" />
          </span>

          {/* Core Icon */}
          <div className="relative flex items-center justify-center pointer-events-none">
            {isVoiceActive ? (
              <div className="flex items-center gap-0.5">
                <span className="h-3 w-0.5 animate-pulse bg-white rounded-full" />
                <span className="h-4 w-0.5 animate-pulse bg-white rounded-full [animation-delay:0.15s]" />
                <span className="h-2 w-0.5 animate-pulse bg-white rounded-full [animation-delay:0.3s]" />
                <Mic className="h-3.5 w-3.5 ml-0.5 text-white" />
              </div>
            ) : (
              <Sparkles className="h-5 w-5 text-white transition-transform duration-200" />
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

