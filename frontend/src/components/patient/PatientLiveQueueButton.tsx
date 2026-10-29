'use client';

import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { PatientLiveQueueModal } from './PatientLiveQueueModal';
import { Button } from '@/components/ui/button';

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
        <Button type="button" onClick={() => setIsOpen(true)} className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#0066cc] text-white font-semibold text-xs hover:bg-[#0055b3] transition-all shadow-xs cursor-pointer active:scale-95 h-auto ${className}`}>

          <Activity className="w-3.5 h-3.5 text-white" />
          <span>{label}</span>
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={() => setIsOpen(true)} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#e8f2fe] border border-blue-200 text-[#0066cc] text-xs font-semibold hover:bg-[#0066cc] hover:text-white transition-all cursor-pointer h-auto ${className}`}>

          <Activity className="w-3 h-3 text-current" />
          <span>{label}</span>
        </Button>
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
