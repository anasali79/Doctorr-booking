'use client';

import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { PatientLiveQueueModal } from './PatientLiveQueueModal';

interface PatientLiveQueueButtonProps {
  appointmentId: string;
  variant?: 'primary' | 'card' | 'badge';
  className?: string;
  label?: string;
}

export function PatientLiveQueueButton({
  appointmentId,
  variant = 'card',
  className = '',
  label = 'View Live Doctor Queue',
}: PatientLiveQueueButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === 'card' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-blue-50 transition-all shadow-sm cursor-pointer border border-transparent hover:border-blue-200 ${className}`}
        >
          <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
          <span>{label}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer ${className}`}
        >
          <Activity className="w-3 h-3 text-blue-600 animate-pulse" />
          <span>{label}</span>
        </button>
      )}

      {isOpen && (
        <PatientLiveQueueModal
          appointmentId={appointmentId}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
