import React from 'react';

export default function DoctorLoading() {
  return (
    <div className="page-container py-8 sm:py-10 space-y-8 animate-pulse">
      {/* Banner Skeleton */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 space-y-3">
        <div className="h-5 w-36 rounded-full bg-slate-200" />
        <div className="h-8 w-64 rounded-xl bg-slate-200" />
        <div className="h-4 w-80 rounded-lg bg-slate-100" />
      </div>

      {/* Metrics Row Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200/90 bg-white p-4 space-y-2">
            <div className="h-3 w-16 rounded-md bg-slate-200" />
            <div className="h-7 w-12 rounded-lg bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Queue Skeleton */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 space-y-4">
        <div className="h-5 w-48 rounded-md bg-slate-200" />
        <div className="h-24 w-full rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
