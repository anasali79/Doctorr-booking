'use client';

import React from 'react';
import { useAppointmentSocket } from '@/hooks/useAppointmentSocket';
import { LiveIndicator } from '../common/LiveIndicator';

interface DoctorSocketProviderProps {
  doctorId: string;
  children: React.ReactNode;
}

export function DoctorSocketProvider({
  doctorId,
  children,
}: DoctorSocketProviderProps) {
  const { isConnected } = useAppointmentSocket({
    role: 'doctor',
    profileId: doctorId,
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
