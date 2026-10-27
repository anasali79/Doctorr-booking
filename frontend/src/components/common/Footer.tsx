import React from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/ui/BrandMark';
import { SPECIALIZATIONS, SPECIALIZATION_LABELS } from '@/lib/constants';
import { ShieldCheck, Clock, MapPin, Heart, Wifi } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white">
      {/* Top Banner: Realtime & Trust */}
      <div className="border-b border-slate-100 bg-slate-50/60 py-6">
        <div className="page-container flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span>
              <strong className="text-slate-900 font-semibold">100% Verified Practitioners</strong> — All doctor licenses authenticated against medical council registries.
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Timezone: Asia/Kolkata (IST)</span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1 text-blue-700 font-semibold">
              <Wifi className="h-3 w-3" /> Live Socket Gateway
            </span>
          </div>
        </div>
      </div>

      <div className="page-container py-12">
        <div className="grid gap-10 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand info */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <BrandMark size="sm" />
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Schedula
              </span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">
              Modern medical appointment scheduling and real-time patient queue intelligence. Eliminate waiting room stress with verified specialists and live token calls.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Made with</span>
              <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
              <span>for better patient care & clinic efficiency.</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-900">
              Navigation
            </h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/doctors" className="hover:text-blue-700 transition-colors">
                  Find Doctors
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-blue-700 transition-colors">
                  Patient / Doctor Login
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-blue-700 transition-colors">
                  Create Free Account
                </Link>
              </li>
              <li>
                <Link href="/doctors?specialization=general%20physician" className="hover:text-blue-700 transition-colors">
                  General Consultation
                </Link>
              </li>
            </ul>
          </div>

          {/* Specialties */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-900">
              Specialties
            </h4>
            <ul className="space-y-2 text-sm text-slate-600">
              {SPECIALIZATIONS.slice(0, 5).map((spec) => (
                <li key={spec}>
                  <Link
                    href={`/doctors?specialization=${encodeURIComponent(spec)}`}
                    className="hover:text-blue-700 transition-colors capitalize"
                  >
                    {SPECIALIZATION_LABELS[spec]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Clinical Notice */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-900">
              Emergency Notice
            </h4>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs leading-relaxed text-amber-800">
              <strong className="block font-semibold mb-1">Medical Emergency?</strong>
              Schedula is for scheduled outpatient appointments. If you are experiencing a life-threatening medical emergency, call <strong>112</strong> or visit the nearest emergency room immediately.
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-8 sm:flex-row text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Schedula Healthcare Systems. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-600 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-600 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-600 cursor-pointer">Doctor Verification FAQ</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
