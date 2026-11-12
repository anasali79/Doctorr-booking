'use client';

import React from 'react';
import { Calendar, Clock, FileText, CreditCard, RotateCcw, Stethoscope } from 'lucide-react';

interface AiQuickActionsProps {
  role: 'PATIENT' | 'DOCTOR';
  language?: 'auto' | 'hi' | 'en';
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function AiQuickActions({
  role,
  language = 'auto',
  onSelect,
  disabled,
}: AiQuickActionsProps) {
  const patientPromptsByLang = {
    en: [
      {
        icon: Stethoscope,
        label: 'AI Symptom Checker',
        prompt: 'I have some symptoms and want to find the right doctor and book a slot.',
      },
      {
        icon: Calendar,
        label: 'Is there any appointment for me?',
        prompt: 'Is there any appointment for me or when is my next appointment?',
      },
      {
        icon: Clock,
        label: 'Doctor available slots',
        prompt: 'Are there any available slots for the doctor tomorrow?',
      },
      {
        icon: RotateCcw,
        label: 'Reschedule appointment',
        prompt: 'I want to reschedule my appointment.',
      },
      {
        icon: FileText,
        label: 'Explain My Prescription',
        prompt: 'Show my prescriptions and explain how and when to take my medicines in simple words.',
      },
      {
        icon: CreditCard,
        label: 'Payment check',
        prompt: 'Did my payment go through?',
      },
    ],
    hi: [
      {
        icon: Stethoscope,
        label: 'AI लक्षण चेकर (डॉक्टर खोजें)',
        prompt: 'मुझे कुछ स्वास्थ्य लक्षण हैं, सही डॉक्टर और उपलब्ध स्लॉट बताएं।',
      },
      {
        icon: Calendar,
        label: 'क्या आज मेरी कोई अपॉइंटमेंट है?',
        prompt: 'क्या आज मेरी कोई अपॉइंटमेंट है या मेरी अगली अपॉइंटमेंट कब है?',
      },
      {
        icon: Clock,
        label: 'डॉक्टर के उपलब्ध स्लॉट',
        prompt: 'क्या कल डॉक्टर के पास कोई स्लॉट उपलब्ध है?',
      },
      {
        icon: RotateCcw,
        label: 'अपॉइंटमेंट रीशेड्यूल करें',
        prompt: 'मुझे अपनी अपॉइंटमेंट रीशेड्यूल करनी है।',
      },
      {
        icon: FileText,
        label: 'प्रिस्क्रिप्शन व दवाइयां समझाएं',
        prompt: 'मेरे प्रिस्क्रिप्शन दिखाएं और दवाइयों का सही समय व परहेज आसान भाषा में समझाएं।',
      },
      {
        icon: CreditCard,
        label: 'पेमेंट स्थिति जांचें',
        prompt: 'मेरा पेमेंट सफल हुआ या नहीं?',
      },
    ],
    auto: [
      {
        icon: Stethoscope,
        label: 'Symptoms / Bimari check karo',
        prompt: 'Mujhe lakshan check karke sahi doctor aur free slot dhundhna hai.',
      },
      {
        icon: Calendar,
        label: 'Aaj meri koi appointment hai?',
        prompt: 'Aaj meri koi appointment hai ya next appointment kab hai?',
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
        label: 'Prescription & Dawaiyan samjhao',
        prompt: 'Mere kitne prescription hain aur dawaiyan kab aur kaise leni hai aasan bhasha me samjhao.',
      },
      {
        icon: CreditCard,
        label: 'Payment check',
        prompt: 'Mera payment successful hua ya nahi?',
      },
    ],
  };

  const doctorPromptsByLang = {
    en: [
      {
        icon: Calendar,
        label: 'Do I have any appointments today?',
        prompt: 'Do I have any appointments today? Show my schedule.',
      },
      {
        icon: FileText,
        label: 'Patient Clinical Summary',
        prompt: 'Show me the clinical summary and past visits of my scheduled patient.',
      },
      {
        icon: Clock,
        label: "Tomorrow's schedule",
        prompt: 'Show my appointments for tomorrow.',
      },
      {
        icon: RotateCcw,
        label: 'Cancelled appointments',
        prompt: "Show today's cancelled appointments.",
      },
      {
        icon: Clock,
        label: 'Next appointment time',
        prompt: 'What time is my next appointment?',
      },
    ],
    hi: [
      {
        icon: Calendar,
        label: 'आज की अपॉइंटमेंट्स',
        prompt: 'क्या आज मेरी कोई अपॉइंटमेंट है? आज का पूरा शेड्यूल दिखाएं।',
      },
      {
        icon: FileText,
        label: 'मरीज का क्लिनिकल सारांश',
        prompt: 'मरीज की क्लिनिकल समरी और पिछली दवाइयां बताएं।',
      },
      {
        icon: Clock,
        label: 'कल का शेड्यूल',
        prompt: 'कल की मेरी अपॉइंटमेंट्स दिखाएं।',
      },
      {
        icon: RotateCcw,
        label: 'रद्द अपॉइंटमेंट्स',
        prompt: 'आज की रद्द की गई अपॉइंटमेंट्स दिखाएं।',
      },
      {
        icon: Clock,
        label: 'अगली अपॉइंटमेंट का समय',
        prompt: 'मेरी अगली अपॉइंटमेंट का समय क्या है?',
      },
    ],
    auto: [
      {
        icon: Calendar,
        label: 'Aaj ke kitne appointments hain?',
        prompt: 'Aaj mere kitne appointments hain? Schedule dikhao.',
      },
      {
        icon: FileText,
        label: 'Patient Clinical Summary',
        prompt: 'Patient ki clinical summary, bimari aur past dawai batao.',
      },
      {
        icon: Clock,
        label: 'Tomorrow schedule',
        prompt: 'Kal ke mere appointments dikhao.',
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
    ],
  };

  const selectedPrompts =
    role === 'DOCTOR'
      ? doctorPromptsByLang[language] || doctorPromptsByLang.auto
      : patientPromptsByLang[language] || patientPromptsByLang.auto;

  return (
    <div className="flex flex-wrap gap-1.5 py-2">
      {selectedPrompts.map((item, idx) => {
        const Icon = item.icon;
        return (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(item.prompt)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold text-blue-800 shadow-2xs hover:bg-blue-600 hover:text-white hover:border-blue-600 active:scale-95 disabled:opacity-40 transition-all cursor-pointer dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-600 dark:hover:text-white dark:hover:border-blue-500"
          >
            <Icon className="h-3 w-3 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors" />
            <span className="group-hover:text-white transition-colors truncate max-w-[200px] sm:max-w-none">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
