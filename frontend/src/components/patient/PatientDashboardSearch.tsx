'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function PatientDashboardSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/doctors?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push('/doctors');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex-1 max-w-md">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search doctors, appointments..."
        className="w-full pl-10 pr-4 py-2 bg-slate-100/80 hover:bg-slate-100/90 focus:bg-white border border-transparent focus:border-blue-400 rounded-full text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none focus:ring-2 focus:ring-blue-500/15"
      />
    </form>
  );
}
