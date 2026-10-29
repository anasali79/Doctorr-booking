'use client';

import React from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/ui/BrandMark';
import { HeartPulse, ShieldCheck, Mail, Phone, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200/90 bg-white text-slate-600">
      <div className="page-container pt-16 pb-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <BrandMark size="md" />
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight text-slate-900 leading-none">
                  Care<span className="text-[#0066cc]">Up</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Healthcare OS
                </span>
              </div>
            </Link>
            
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm">
              The real-time healthcare scheduling and live queue tracking platform.
              Designed for modern practices, certified doctors, and patients who value their time.
            </p>

            <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>HIPAA & ISO 27001 Certified Clinical Data</span>
            </div>
          </div>

          {/* Col 2: Platform */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Platform</p>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link href="/doctors" className="hover:text-[#0066cc] transition-colors">
                  Find Doctors
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-[#0066cc] transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/doctors" className="hover:text-[#0066cc] transition-colors">
                  Specialties & GPs
                </Link>
              </li>
              <li>
                <Link href="/patient/dashboard" className="hover:text-[#0066cc] transition-colors">
                  Live Queue Tracker
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: For Providers */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-900">For Providers</p>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link href="/doctor/dashboard" className="hover:text-[#0066cc] transition-colors">
                  Doctor Command Center
                </Link>
              </li>
              <li>
                <Link href="/doctor/my-day" className="hover:text-[#0066cc] transition-colors">
                  My Day & Live Queue
                </Link>
              </li>
              <li>
                <Link href="/doctor/availability" className="hover:text-[#0066cc] transition-colors">
                  Shift & Slot Rules
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-[#0066cc] transition-colors">
                  Join as Doctor
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Practice & Emergency */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Clinical Notice</p>
            <p className="text-xs leading-relaxed text-slate-600">
              <strong className="font-bold text-slate-900">In medical emergencies, call 999 or 112 immediately.</strong>{' '}
              CareUp provides scheduled outpatient care and real-time waiting queues.
            </p>
            <div className="pt-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Support Desk</p>
              <p>Mon - Fri: 08:00 – 18:00</p>
            </div>
          </div>

        </div>

        {/* Bottom copyright line */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 text-xs text-slate-600 sm:flex-row">
          <p>© {new Date().getFullYear()} CareUp Healthcare Platform. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/doctors" className="hover:text-slate-900 transition-colors">
              Directory
            </Link>
            <span>•</span>
            <Link href="/login" className="hover:text-slate-900 transition-colors">
              Sign In
            </Link>
            <span>•</span>
            <Link href="/signup" className="hover:text-slate-900 transition-colors">
              Register
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
