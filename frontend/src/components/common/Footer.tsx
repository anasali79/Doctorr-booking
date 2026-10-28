'use client';

import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white">
      <div className="page-container py-8 sm:py-10">
        <div className="grid gap-6 text-xs text-slate-600 sm:grid-cols-3">
          {/* Col 1 */}
          <div className="space-y-1">
            <p className="font-bold text-slate-900 text-sm">CareUp Healthcare</p>
            <p className="text-slate-500">Connected Clinics & Modern Consultation Suites</p>
          </div>

          {/* Col 2 */}
          <div className="space-y-1">
            <p className="text-slate-600">Online booking open 24/7 • Real-time queue sync</p>
            <p className="text-slate-500">Fast, digital patient care & appointment tracking</p>
          </div>

          {/* Col 3 */}
          <div className="space-y-1">
            <p className="leading-relaxed">
              <strong className="font-bold text-slate-900">In an emergency, call 999 or 112.</strong>{' '}
              For urgent clinical guidance, contact your local emergency health service.
            </p>
          </div>
        </div>

        {/* Bottom copyright & quick links */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 text-[11px] text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} CareUp. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/doctors" className="hover:text-slate-700 transition-colors">
              Our doctors
            </Link>
            <span>•</span>
            <Link href="/login" className="hover:text-slate-700 transition-colors">
              Sign in
            </Link>
            <span>•</span>
            <Link href="/doctor/dashboard" className="hover:text-slate-700 transition-colors">
              Staff Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
