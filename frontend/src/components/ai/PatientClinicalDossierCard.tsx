'use client';

import React from 'react';
import {
  User,
  AlertTriangle,
  HeartPulse,
  Pill,
  Calendar,
  Clock,
  FileText,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions?: string;
}

interface PatientClinicalDossierData {
  patient: {
    id: string;
    fullName: string;
    age: number;
    gender: string;
    bloodGroup?: string;
    phone?: string;
  };
  safetyAlerts: {
    allergies: string;
    hasAllergyAlert: boolean;
    medicalHistory: string;
    currentMedication: string;
  };
  consultationStats: {
    totalVisits: number;
    completedVisits: number;
    lastVisitDate: string | null;
  };
  lastConsultation: {
    date: string | null;
    diagnosis: string;
    clinicalNotes: string | null;
    symptoms: string | null;
    vitals?: {
      bloodPressure?: string;
      pulse?: string;
      temperature?: string;
      spo2?: string;
      weight?: string;
    } | null;
    prescribedMedicines: Medicine[];
  };
  todayAppointment?: {
    id: string;
    tokenNumber: number | null;
    timeWindow: string;
    status: string;
  } | null;
}

interface PatientClinicalDossierCardProps {
  data: PatientClinicalDossierData;
  onSelectAction?: (prompt: string) => void;
}

export function PatientClinicalDossierCard({
  data,
  onSelectAction,
}: PatientClinicalDossierCardProps) {
  if (!data || !data.patient) return null;

  const { patient, safetyAlerts, consultationStats, lastConsultation, todayAppointment } = data;
  const medicines = lastConsultation?.prescribedMedicines || [];

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      {/* Top Banner: Patient Identity & Vitals Header */}
      <div className="border-b border-zinc-100 bg-gradient-to-r from-slate-50 via-blue-50/40 to-indigo-50/50 p-3.5 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-850 dark:to-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 font-bold text-white shadow-xs text-sm">
              {patient.fullName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {patient.fullName}
                </h4>
                {patient.bloodGroup && patient.bloodGroup !== 'Not specified' && (
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                    {patient.bloodGroup}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {patient.age} yrs • {patient.gender} • {consultationStats.totalVisits}{' '}
                {consultationStats.totalVisits === 1 ? 'visit' : 'total visits'}
              </p>
            </div>
          </div>

          {todayAppointment && (
            <div className="shrink-0 text-right">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Token #{String(todayAppointment.tokenNumber || 1).padStart(2, '0')}
              </span>
              <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                {todayAppointment.timeWindow}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="p-3.5 space-y-3">
        {/* 1. Critical Safety Alerts (Allergies & Chronic History) */}
        <div className="space-y-2">
          {safetyAlerts.hasAllergyAlert ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50/90 p-2.5 text-xs text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div>
                <span className="font-extrabold uppercase tracking-wide text-[10px] text-rose-800 dark:text-rose-300">
                  ⚠️ Critical Known Drug Allergy:
                </span>
                <p className="font-bold text-xs mt-0.5">{safetyAlerts.allergies}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-[11px] text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>No known drug allergies reported</span>
            </div>
          )}

          {/* Medical History & Current Medication */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                Chronic Medical History
              </span>
              <p className="mt-0.5 font-semibold text-zinc-800 dark:text-zinc-200">
                {safetyAlerts.medicalHistory || 'None recorded'}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                Current Daily Medication
              </span>
              <p className="mt-0.5 font-semibold text-zinc-800 dark:text-zinc-200">
                {safetyAlerts.currentMedication || 'None'}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Last Visit Snapshot: Diagnosis & Clinical Notes */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
              <HeartPulse className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Previous Diagnosis ({lastConsultation.date || 'Last Visit'})</span>
            </span>
          </div>

          <div className="text-xs">
            <p className="font-bold text-zinc-900 dark:text-zinc-100">
              {lastConsultation.diagnosis}
            </p>
            {lastConsultation.symptoms && (
              <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-zinc-500">Reported Symptoms:</span> {lastConsultation.symptoms}
              </p>
            )}
            {lastConsultation.clinicalNotes && (
              <p className="mt-1 text-[11px] italic text-zinc-600 dark:text-zinc-400 border-l-2 border-blue-400 pl-2">
                &ldquo;{lastConsultation.clinicalNotes}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* 3. Last Prescribed Medications */}
        {medicines.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                <Pill className="h-3.5 w-3.5 text-indigo-500" />
                <span>Last Prescribed Medicines ({medicines.length})</span>
              </span>
            </div>

            <div className="space-y-1.5">
              {medicines.map((med, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md bg-zinc-50 px-2.5 py-1.5 text-[11px] dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {med.name}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 ml-1.5 text-[10px]">
                      {med.dosage} • {med.frequency} • {med.timing}
                    </span>
                  </div>
                  <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {med.duration}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Action */}
        <div className="pt-1 flex items-center justify-between">
          <a
            href="/doctor/patients"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
          >
            <span>Open Complete Patient Record in Portal</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

