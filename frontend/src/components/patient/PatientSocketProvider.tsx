'use client';

import React from 'react';
import { useAppointmentSocket } from '@/hooks/useAppointmentSocket';
import { LiveIndicator } from '../common/LiveIndicator';

interface PatientSocketProviderProps {
  patientId: string;
  children: React.ReactNode;
}

export function PatientSocketProvider({
  patientId,
  children,
}: PatientSocketProviderProps) {
  const { isConnected } = useAppointmentSocket({
    role: 'patient',
    profileId: patientId,
  });

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 hidden sm:block">
        <LiveIndicator isConnected={isConnected} />
      </div>
      {children}
    </>
  );
}
