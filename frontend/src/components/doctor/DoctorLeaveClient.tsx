'use client';

import React from 'react';
import { DoctorLeave } from '@/types';
import { DoctorLeaveCalendar } from './DoctorLeaveCalendar';

interface DoctorLeaveClientProps {
  initialLeaves: DoctorLeave[];
}

export function DoctorLeaveClient({ initialLeaves }: DoctorLeaveClientProps) {
  return (
    <div className="max-w-7xl mx-auto pb-12">
      <DoctorLeaveCalendar initialLeaves={initialLeaves} />
    </div>
  );
}
