'use client';

import React, { useId } from 'react';
import { motion } from 'framer-motion';

export type AvatarColor =
  | 'blue'
  | 'cyan'
  | 'indigo'
  | 'purple'
  | 'turquoise'
  | 'emerald'
  | 'orange'
  | 'pink';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'square' | 'squircle';

export interface AiOrbAvatarProps {
  blinking?: boolean;
  color?: AvatarColor;
  size?: AvatarSize;
  shape?: AvatarShape;
  className?: string;
  glow?: boolean;
  isSpeaking?: boolean;
}

const BLINK_KEYFRAMES = `
@keyframes av-blink {
  0%, 86%, 100% {
    transform: scaleY(1);
  }
  90%, 94% {
    transform: scaleY(0.06);
  }
}

@keyframes av-orb-glow {
  0%, 100% {
    filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.4)) drop-shadow(0 0 18px rgba(13, 77, 154, 0.25));
    opacity: 0.85;
  }
  50% {
    filter: drop-shadow(0 0 14px rgba(56, 189, 248, 0.7)) drop-shadow(0 0 28px rgba(13, 77, 154, 0.45));
    opacity: 1;
  }
}
`;

const PRESETS: Record<
  AvatarColor,
  {
    gradient: string;
    boxShadow: string;
    iris: string;
    shine: string;
    glowColor: string;
  }
> = {
  blue: {
    // 21st.dev OdysseyUI radial gradient & specular lighting
    gradient:
      'radial-gradient(circle at 50% 45%, #0d4d9a 0%, #3d7dd8 40%, #6fb3ff 68%, #e0eeff 100%)',
    boxShadow:
      '0 0 4px 0px rgba(20,102,216,.35), 0 0 16px 6px rgba(20,102,216,.18), inset 0 0 0 1px rgba(255,255,255,.05)',
    iris: 'linear-gradient(180deg, #ffffff 0%, #ffffff 100%)',
    shine:
      'radial-gradient(ellipse at 30% 24%, rgba(255,255,255,.75) 0%, rgba(255,255,255,.1) 50%, transparent 70%)',
    glowColor: 'rgba(56, 189, 248, 0.6)',
  },
  cyan: {
    gradient:
      'radial-gradient(circle at 35% 30%, #c5f6fa 0%, #3bc9db 28%, #0c8599 65%, #084c59 100%)',
    boxShadow:
      'inset -4px -4px 10px rgba(5, 35, 45, 0.6), inset 3px 3px 8px rgba(255, 255, 255, 0.8), 0 0 20px 4px rgba(34, 211, 238, 0.45)',
    iris: 'linear-gradient(180deg, #ffffff 0%, #cffafe 100%)',
    shine:
      'radial-gradient(ellipse at 32% 24%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.35) 35%, transparent 65%)',
    glowColor: 'rgba(34, 211, 238, 0.65)',
  },
  indigo: {
    gradient:
      'radial-gradient(circle at 35% 30%, #dbe4ff 0%, #5c7cfa 28%, #364fc7 65%, #1f2b6c 100%)',
    boxShadow:
      'inset -4px -4px 10px rgba(20, 25, 60, 0.6), inset 3px 3px 8px rgba(255, 255, 255, 0.8), 0 0 20px 4px rgba(99, 102, 241, 0.45)',
    iris: 'linear-gradient(180deg, #ffffff 0%, #e0e7ff 100%)',
    shine:
      'radial-gradient(ellipse at 32% 24%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.35) 35%, transparent 65%)',
    glowColor: 'rgba(99, 102, 241, 0.65)',
  },
  purple: {
    gradient:
      'radial-gradient(circle at 35% 30%, #f3d9fa 0%, #cc5de8 28%, #862e9c 65%, #491259 100%)',
    boxShadow:
      'inset -4px -4px 10px rgba(45, 10, 55, 0.6), inset 3px 3px 8px rgba(255, 255, 255, 0.8), 0 0 20px 4px rgba(192, 132, 252, 0.45)',
    iris: 'linear-gradient(180deg, #ffffff 0%, #f3e8ff 100%)',
    shine:
      'radial-gradient(ellipse at 32% 24%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.35) 35%, transparent 65%)',
    glowColor: 'rgba(192, 132, 252, 0.65)',
  },
  turquoise: {
    gradient:
      'radial-gradient(circle at 35% 30%, #c3fae8 0%, #20c997 28%, #099268 65%, #054f38 100%)',
    boxShadow:
      'inset -4px -4px 10px rgba(5, 45, 30, 0.6), inset 3px 3px 8px rgba(255, 255, 255, 0.8), 0 0 20px 4px rgba(45, 212, 191, 0.45)',
    iris: 'linear-gradient(180deg, #ffffff 0%, #ccfbf1 100%)',
    shine:
      'radial-gradient(ellipse at 32% 24%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.35) 35%, transparent 65%)',
    glowColor: 'rgba(45, 212, 191, 0.65)',
  },
  emerald: {
    gradient:
      'radial-gradient(circle at 35% 30%, #d3f9d8 0%, #40c057 28%, #2b8a3e 65%, #184e23 100%)',
    boxShadow:
      'inset -4px -4px 10px rgba(10, 45, 15, 0.6), inset 3px 3px 8px rgba(255, 255, 255, 0.8), 0 0 20px 4px rgba(52, 211, 153, 0.45)',
    iris: 'linear-gradient(180deg, #ffffff 0%, #d1fae5 100%)',
    shine:
      'radial-gradient(ellipse at 32% 24%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.35) 35%, transparent 65%)',
    glowColor: 'rgba(52, 211, 153, 0.65)',
  },
  orange: {
    gradient:
      'radial-gradient(circle at 35% 30%, #ffe8cc 0%, #ff922b 28%, #d9480f 65%, #7a2200 100%)',
    boxShadow:
      'inset -4px -4px 10px rgba(65, 15, 0, 0.6), inset 3px 3px 8px rgba(255, 255, 255, 0.8), 0 0 20px 4px rgba(251, 146, 60, 0.45)',
    iris: 'linear-gradient(180deg, #ffffff 0%, #ffedd5 100%)',
    shine:
      'radial-gradient(ellipse at 32% 24%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.35) 35%, transparent 65%)',
    glowColor: 'rgba(251, 146, 60, 0.65)',
  },
  pink: {
    gradient:
      'radial-gradient(circle at 35% 30%, #ffdeeb 0%, #f783ac 28%, #c2255c 65%, #6a0b2e 100%)',
    boxShadow:
      'inset -4px -4px 10px rgba(55, 5, 25, 0.6), inset 3px 3px 8px rgba(255, 255, 255, 0.8), 0 0 20px 4px rgba(244, 114, 182, 0.45)',
    iris: 'linear-gradient(180deg, #ffffff 0%, #fce7f3 100%)',
    shine:
      'radial-gradient(ellipse at 32% 24%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.35) 35%, transparent 65%)',
    glowColor: 'rgba(244, 114, 182, 0.65)',
  },
};

const SIZE_PRESETS: Record<
  AvatarSize,
  {
    orb: string;
    eye: string;
    eyeGap: string;
    eyeY: string;
    glowRadius: string;
  }
> = {
  xs: {
    orb: 'w-7 h-7',
    eye: 'w-[3px] h-[7px]',
    eyeGap: 'gap-[3px]',
    eyeY: '-translate-y-[1px]',
    glowRadius: 'blur-xs',
  },
  sm: {
    orb: 'w-9 h-9',
    eye: 'w-[3.5px] h-[9px]',
    eyeGap: 'gap-[4px]',
    eyeY: '-translate-y-[1.5px]',
    glowRadius: 'blur-sm',
  },
  md: {
    orb: 'w-12 h-12',
    eye: 'w-[5px] h-[12px]',
    eyeGap: 'gap-[5px]',
    eyeY: '-translate-y-[2px]',
    glowRadius: 'blur-md',
  },
  lg: {
    orb: 'w-16 h-16',
    eye: 'w-[6.5px] h-[16px]',
    eyeGap: 'gap-[7px]',
    eyeY: '-translate-y-[3px]',
    glowRadius: 'blur-lg',
  },
  xl: {
    orb: 'w-24 h-24',
    eye: 'w-[9px] h-[22px]',
    eyeGap: 'gap-[9px]',
    eyeY: '-translate-y-[4px]',
    glowRadius: 'blur-xl',
  },
};

const SHAPE_RADIUS: Record<AvatarShape, string> = {
  circle: 'rounded-full',
  square: 'rounded-none',
  squircle: 'rounded-[32%]',
};

interface EyeProps {
  blinking: boolean;
  delayMs?: number;
  irisGradient: string;
  sizeClass: string;
  isSpeaking?: boolean;
}

function Eye({ blinking, delayMs = 0, irisGradient, sizeClass, isSpeaking }: EyeProps) {
  return (
    <div
      className={['rounded-full', sizeClass].filter(Boolean).join(' ')}
      style={{
        background: irisGradient,
        transformOrigin: '50% 50%',
        willChange: 'transform',
        boxShadow: '0 0 4px rgba(255, 255, 255, 0.95)',
        ...(blinking
          ? {
              animation: isSpeaking
                ? `av-blink 2.2s cubic-bezier(0.4, 0, 0.2, 1) ${delayMs}ms infinite`
                : `av-blink 3.6s cubic-bezier(0.4, 0, 0.2, 1) ${delayMs}ms infinite`,
            }
          : {}),
      }}
    />
  );
}

export function AiOrbAvatar({
  blinking = true,
  color = 'blue',
  size = 'md',
  shape = 'circle',
  className = '',
  glow = true,
  isSpeaking = false,
}: AiOrbAvatarProps) {
  const uid = useId();
  const noiseId = `av-noise-${uid.replace(/\W/g, '')}`;
  const preset = PRESETS[color] ?? PRESETS.blue;
  const dims = SIZE_PRESETS[size] ?? SIZE_PRESETS.md;

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      <style>{BLINK_KEYFRAMES}</style>

      {/* Atmospheric Outer Ambient Glow / Aura matching 21st.dev reference */}
      {glow && (
        <div
          className={`absolute -inset-2 rounded-full pointer-events-none opacity-85 transition-opacity duration-300 ${dims.glowRadius}`}
          style={{
            background: `radial-gradient(circle, ${preset.glowColor} 0%, rgba(13, 77, 154, 0.25) 55%, transparent 75%)`,
            animation: 'av-orb-glow 4s ease-in-out infinite',
          }}
        />
      )}

      {/* 3D Orb Sphere Body */}
      <motion.div
        aria-label="CareUp AI Voice & Chat Orb"
        role="img"
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.05 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 25,
        }}
        className={[
          'relative flex items-center justify-center overflow-hidden cursor-pointer shadow-lg',
          dims.orb,
          SHAPE_RADIUS[shape],
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          background: preset.gradient,
          boxShadow: preset.boxShadow,
        }}
      >
        {/* Subtle Organic Micro-Noise Texture for 3D realism */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id={noiseId} x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.75"
                numOctaves="3"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
        </svg>

        {/* Top-Left Specular Surface Highlight (Soft 3D Light Glaze) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: preset.shine }}
        />

        {/* Bottom Depth Shadow for True Sphere Volume */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 70% 75%, rgba(0, 15, 45, 0.4) 0%, transparent 60%)',
          }}
        />

        {/* Two Animated Blinking Eyes */}
        <div
          className={[
            'relative z-10 flex items-center justify-center',
            dims.eyeGap,
            dims.eyeY,
          ].join(' ')}
        >
          <Eye
            blinking={blinking}
            delayMs={0}
            irisGradient={preset.iris}
            sizeClass={dims.eye}
            isSpeaking={isSpeaking}
          />
          <Eye
            blinking={blinking}
            delayMs={40}
            irisGradient={preset.iris}
            sizeClass={dims.eye}
            isSpeaking={isSpeaking}
          />
        </div>
      </motion.div>
    </div>
  );
}

export default AiOrbAvatar;
