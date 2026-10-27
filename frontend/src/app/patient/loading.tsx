import React from 'react';

export default function PatientLoading() {
  return (
    <div className="page-container py-8 sm:py-10 space-y-8 animate-pulse">
      {/* Banner Skeleton */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 space-y-3">
        <div className="h-5 w-36 rounded-full bg-slate-200" />
        <div className="h-8 w-64 rounded-xl bg-slate-200" />
        <div className="h-4 w-96 rounded-lg bg-slate-100" />
      </div>

      {/* Queue Card Skeleton */}
      <div className="rounded-3xl border border-blue-900 bg-slate-900 p-6 sm:p-8 space-y-4">
        <div className="h-5 w-40 rounded-full bg-slate-800" />
        <div className="h-7 w-72 rounded-xl bg-slate-800" />
        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-800/60 p-6 h-28" />
      </div>

      {/* Upcoming Grid Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-slate-200/90 bg-white p-5 space-y-4 h-48" />
        ))}
      </div>
    </div>
  );
}
