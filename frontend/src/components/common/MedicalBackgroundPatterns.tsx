import React from 'react';

/**
 * Lightweight, GPU-accelerated medical ambient background.
 * Pure CSS / static rendering with zero JS calculations on the main thread
 * to maximize Lighthouse Performance (FCP, LCP, TBT = 0).
 */
export function MedicalBackgroundPatterns() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
      style={{ contain: 'strict' }}
      aria-hidden="true"
    >
      {/* Soft Radial Ambient Meshes */}
      <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-sky-200/30 via-blue-100/20 to-transparent blur-3xl opacity-70" />
      <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-blue-200/25 via-sky-100/20 to-transparent blur-3xl opacity-60" />
      <div className="absolute bottom-10 left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-sky-100/30 via-transparent to-transparent blur-3xl opacity-50" />

      {/* Lightweight Static Medical Subtle Grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #0066cc 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
}
