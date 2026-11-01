'use client';

import React from 'react';
import {
  X,
  Printer,
  Download,
  Stethoscope,
  HeartPulse,
  Pill,
  Calendar,
  Building2,
  ShieldCheck,
  Phone,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Prescription } from '@/types/prescription';
import { formatDate, formatTime } from '@/lib/utils';

interface PrescriptionViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: Prescription | null;
}

export function PrescriptionViewModal({
  isOpen,
  onClose,
  prescription,
}: PrescriptionViewModalProps) {
  if (!isOpen || !prescription) return null;

  const doc = prescription.doctor;
  const pat = prescription.patient;
  const appt = prescription.appointment;
  const vitals = prescription.vitals;

  const handlePrint = () => {
    window.print();
  };

  const rxId = 'RX-' + prescription.id.slice(0, 8).toUpperCase();
  const dateStr = formatDate(appt?.date || prescription.createdAt);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:z-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:rounded-none print:my-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden when printing) */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
              ℞
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Official Medical Prescription
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {rxId} • Verified Digital Rx
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border-slate-200 rounded-xl h-8 flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-blue-600" />
              <span>Print / Download PDF</span>
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Prescription Body */}
        <div
          id="printable-rx"
          className="p-6 sm:p-8 overflow-y-auto text-slate-800 font-sans space-y-6 bg-white print:p-8 print:overflow-visible"
        >
          {/* 1. Clinic Letterhead Header */}
          <div className="border-b-2 border-emerald-600 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-700">
                  <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
                    +
                  </div>
                  <span className="text-xl font-extrabold tracking-tight text-slate-900">
                    CareUp Medical Clinic
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Outpatient Health Pavilion & Specialist Consultation Suites
                </p>
                <p className="text-[11px] text-slate-500">
                  Reg No: <strong className="text-slate-700 font-mono">CARE-OPD-2024-MH</strong> • Helpline: +91 98765 43210
                </p>
              </div>

              {/* Doctor Header Block */}
              <div className="text-right space-y-0.5">
                <h4 className="text-base font-extrabold text-slate-900">
                  Dr. {doc?.fullName || 'Specialist Doctor'}
                </h4>
                <p className="text-xs font-semibold text-emerald-700">
                  {doc?.qualification || 'MBBS, MD'} ({doc?.specialization || 'General Physician'})
                </p>
                <p className="text-[11px] text-slate-500">
                  Reg No: <span className="font-mono font-medium text-slate-700">MCI-2018-99214</span>
                </p>
                {doc?.phone && (
                  <p className="text-[11px] text-slate-500">
                    Clinic Contact: +91 {doc.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 2. Patient Demographics & Prescription Metadata Strip */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Patient Name
                </span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {pat?.fullName || 'Patient'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Age / Gender / Blood Group
                </span>
                <span className="font-bold text-slate-800">
                  {pat?.age ? `${pat.age} yrs` : '—'} / {pat?.gender || '—'} {pat?.bloodGroup ? `(${pat.bloodGroup})` : ''}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Date & Token
                </span>
                <span className="font-bold text-slate-800">
                  {dateStr} • Token #{appt?.tokenNumber || '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Prescription ID
                </span>
                <span className="font-mono font-black text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md inline-block">
                  {rxId}
                </span>
              </div>
            </div>

            {/* Vitals row if recorded */}
            {vitals && (vitals.bloodPressure || vitals.pulse || vitals.temperature || vitals.weight || vitals.spo2) && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center gap-4 flex-wrap text-[11px]">
                <span className="font-bold text-slate-500 uppercase text-[10px] flex items-center gap-1">
                  <HeartPulse className="h-3 w-3 text-rose-500" /> Vitals:
                </span>
                {vitals.bloodPressure && (
                  <span>
                    BP: <strong className="text-slate-800 font-mono">{vitals.bloodPressure}</strong>
                  </span>
                )}
                {vitals.pulse && (
                  <span>
                    Pulse: <strong className="text-slate-800 font-mono">{vitals.pulse}</strong>
                  </span>
                )}
                {vitals.temperature && (
                  <span>
                    Temp: <strong className="text-slate-800 font-mono">{vitals.temperature}</strong>
                  </span>
                )}
                {vitals.weight && (
                  <span>
                    Weight: <strong className="text-slate-800 font-mono">{vitals.weight}</strong>
                  </span>
                )}
                {vitals.spo2 && (
                  <span>
                    SpO2: <strong className="text-slate-800 font-mono">{vitals.spo2}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 3. Clinical Impression & Symptoms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl border border-blue-100 bg-blue-50/50 space-y-1">
              <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                <Stethoscope className="h-3 w-3 text-blue-600" />
                Clinical Diagnosis
              </span>
              <p className="font-bold text-slate-900 text-sm">
                {prescription.diagnosis}
              </p>
            </div>

            {prescription.symptoms && (
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Symptoms & Complaints
                </span>
                <p className="font-medium text-slate-800 text-xs">
                  {prescription.symptoms}
                </p>
              </div>
            )}
          </div>

          {/* 4. The Classic Rx Symbol and Medicines Table */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-emerald-800 font-serif leading-none">
                ℞
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Prescribed Medications
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3">Medicine & Dosage</th>
                    <th className="py-2.5 px-3">Frequency</th>
                    <th className="py-2.5 px-3">Meal Timing</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {prescription.medicines.map((m, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="py-2.5 px-3 font-bold text-slate-400 text-center">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-extrabold text-slate-900">
                        {m.name}
                        <span className="block text-[11px] font-medium text-slate-500">
                          {m.dosage}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-800">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px]">
                          {m.frequency}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {m.timing}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {m.duration}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] italic">
                        {m.instructions || 'As advised'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Additional Clinical Recommendations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
            {prescription.labTests && (
              <div className="p-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/50 space-y-1">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                  🔬 Recommended Diagnostic Investigations
                </span>
                <p className="font-semibold text-slate-800 leading-relaxed">
                  {prescription.labTests}
                </p>
              </div>
            )}

            {prescription.advice && (
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-1">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  🥗 General Advice & Diet Restrictions
                </span>
                <p className="font-semibold text-slate-800 leading-relaxed">
                  {prescription.advice}
                </p>
              </div>
            )}
          </div>

          {/* 6. Follow-up and Digital Sign Off */}
          <div className="pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-1 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Follow-up Consultation
              </span>
              <p className="font-extrabold text-emerald-800 text-sm">
                {prescription.followUpDate || 'As needed / SOS'}
              </p>
              <p className="text-[10px] text-slate-400">
                Please bring this prescription slip on your next visit.
              </p>
            </div>

            {/* Doctor Signature & Stamp */}
            <div className="text-right space-y-1">
              <div className="inline-block p-2 rounded-xl bg-slate-50 border border-slate-200 text-left">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Digitally Verified
                    </span>
                    <span className="font-serif italic font-extrabold text-slate-800 text-sm">
                      Dr. {doc?.fullName || 'Attending Physician'}
                    </span>
                  </div>
                </div>
                <div className="mt-1 pt-1 border-t border-slate-200/80 text-[9px] text-slate-400 font-mono">
                  Sign Date: {new Date(prescription.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>

          {/* Legal / Telemedicine Disclaimer Footer */}
          <div className="pt-2 border-t border-slate-100 text-[9px] text-slate-400 text-center leading-relaxed">
            This digital prescription is generated electronically by CareUp Health Clinic under registered medical guidelines. For genuine emergency medical care, please visit the nearest hospital emergency room.
          </div>
        </div>

        {/* Bottom Actions (Hidden when printing) */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
          <span className="text-xs text-slate-500 font-medium">
            Standard Medical Prescription (Format A4)
          </span>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs font-semibold rounded-xl"
            >
              Close
            </Button>

            <Button
              type="button"
              onClick={handlePrint}
              className="btn-primary !text-xs !py-2 !px-4 h-auto rounded-xl flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Download Rx Slip</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
