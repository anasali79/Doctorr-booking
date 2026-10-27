import React from 'react';

export default function DoctorsLoading() {
  return (
    <div className="page-container py-10 sm:py-12 space-y-8 animate-pulse">
      <div className="space-y-3">
        <div className="h-5 w-32 rounded-full bg-slate-200" />
        <div className="h-8 w-72 rounded-xl bg-slate-200" />
        <div className="h-4 w-96 rounded-lg bg-slate-100" />
      </div>

      <div className="h-16 rounded-2xl bg-white border border-slate-200 p-4" />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4 h-64" />
        ))}
      </div>
    </div>
  );
}
