'use client';

import React from 'react';
import { Calendar, Clock, FileText, CreditCard, RotateCcw } from 'lucide-react';

interface AiQuickActionsProps {
  role: 'PATIENT' | 'DOCTOR';
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function AiQuickActions({ role, onSelect, disabled }: AiQuickActionsProps) {
  const patientPrompts = [
    {
      icon: Calendar,
      label: 'Meri next appointment kab hai?',
      prompt: 'Meri next appointment kab hai?',
    },
    {
      icon: Clock,
      label: 'Doctor ke available slots',
      prompt: 'Kal doctor ke paas koi slot available hai?',
    },
    {
      icon: RotateCcw,
      label: 'Reschedule appointment',
      prompt: 'Mujhe appointment reschedule karni hai.',
    },
    {
      icon: FileText,
      label: 'Prescription status',
      prompt: 'Meri prescription dikhao.',
    },
    {
      icon: CreditCard,
      label: 'Payment check',
      prompt: 'Mera payment successful hua ya nahi?',
    },
  ];

  const doctorPrompts = [
    {
      icon: Calendar,
      label: 'Aaj ke kitne appointments hain?',
      prompt: 'Aaj mere kitne appointments hain?',
    },
    {
      icon: Clock,
      label: 'Tomorrow schedule',
      prompt: 'Show my appointments for tomorrow.',
    },
    {
      icon: RotateCcw,
      label: 'Cancelled appointments',
      prompt: 'Mujhe aaj ke cancelled appointments dikhao.',
    },
    {
      icon: Clock,
      label: 'Next appointment time',
      prompt: 'Mere next appointment ka time kya hai?',
    },
  ];

  const items = role === 'DOCTOR' ? doctorPrompts : patientPrompts;

  return (
    <div className="flex flex-wrap gap-1.5 py-2">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(item.prompt)}
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50/70 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100/80 active:scale-95 disabled:opacity-50 transition-all cursor-pointer dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
          >
            <Icon className="h-3 w-3 text-blue-500" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

