import React from 'react';

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-pulse" />
        <div className="h-10 w-10 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
      </div>
      <p className="mt-4 text-xs font-bold text-slate-500 uppercase tracking-wider animate-pulse">
        Loading Schedula…
      </p>
    </div>
  );
}
