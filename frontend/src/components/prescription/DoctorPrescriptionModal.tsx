'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  FileText,
  Stethoscope,
  Pill,
  Clock,
  Sparkles,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Eye,
  HeartPulse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Appointment } from '@/types';
import {
  Prescription,
  PrescriptionMedicine,
  PrescriptionVitals,
  CreatePrescriptionPayload,
} from '@/types/prescription';
import { savePrescription, getPrescriptionByAppointment } from '@/lib/api/prescription';
import { formatDate, formatTime } from '@/lib/utils';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/lib/api/axios';
import { PrescriptionViewModal } from './PrescriptionViewModal';

interface DoctorPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onPrescriptionSaved?: (prescription: Prescription) => void;
}

const DOSAGE_OPTIONS = [
  '1 Tablet',
  '2 Tablets',
  '1/2 Tablet',
  '1 Capsule',
  '5 ml (1 tsp)',
  '10 ml (2 tsp)',
  '15 ml (1 tbsp)',
  '1 Sachet',
  '1 Puff',
  '2 Puffs',
  '2 Drops',
  'Apply Topically',
];

const FREQUENCY_OPTIONS = [
  '1-0-1 (Morning & Night)',
  '1-1-1 (Morning, Midday, Night)',
  '1-0-0 (Morning only)',
  '0-0-1 (Night only)',
  '0-1-0 (Afternoon only)',
  '1-1-1-1 (Four times daily)',
  'SOS (Only when needed)',
  'Every 8 Hours',
  'Every 12 Hours',
  'Once weekly',
];

const TIMING_OPTIONS = [
  'After Food (Post Meal)',
  'Before Food (Pre Meal)',
  'Empty Stomach (Morning)',
  'With Food',
  'At Bedtime',
  'As Advised',
];

const DURATION_OPTIONS = [
  '3 Days',
  '5 Days',
  '7 Days',
  '10 Days',
  '14 Days',
  '21 Days',
  '1 Month',
  'Ongoing',
];

const COMMON_DIAGNOSES = [
  'Acute Viral Upper Respiratory Infection',
  'Acute Bronchitis & Cough',
  'Acute Gastroenteritis',
  'Seasonal Viral Fever',
  'Allergic Rhinitis',
  'Tension Headache / Migraine',
  'GERD / Gastric Acidity',
  'Essential Hypertension (Follow-up)',
  'General Physical Weakness & Fatigue',
];

const QUICK_MEDICINES = [
  { name: 'Paracetamol 650mg', dosage: '1 Tablet', freq: '1-0-1 (Morning & Night)', timing: 'After Food (Post Meal)', dur: '3 Days' },
  { name: 'Amoxicillin + Clavulanic Acid 625mg', dosage: '1 Tablet', freq: '1-0-1 (Morning & Night)', timing: 'After Food (Post Meal)', dur: '5 Days' },
  { name: 'Pantoprazole 40mg', dosage: '1 Tablet', freq: '1-0-0 (Morning only)', timing: 'Empty Stomach (Morning)', dur: '7 Days' },
  { name: 'Cetirizine 10mg', dosage: '1 Tablet', freq: '0-0-1 (Night only)', timing: 'At Bedtime', dur: '5 Days' },
  { name: 'Azithromycin 500mg', dosage: '1 Tablet', freq: '1-0-0 (Morning only)', timing: 'Before Food (Pre Meal)', dur: '3 Days' },
  { name: 'Ibuprofen 400mg', dosage: '1 Tablet', freq: 'SOS (Only when needed)', timing: 'After Food (Post Meal)', dur: '3 Days' },
  { name: 'Oral Rehydration Salts (ORS)', dosage: '1 Sachet', freq: '1-1-1 (Morning, Midday, Night)', timing: 'With Food', dur: '3 Days' },
];

export function DoctorPrescriptionModal({
  isOpen,
  onClose,
  appointment,
  onPrescriptionSaved,
}: DoctorPrescriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Clinical Fields
  const [diagnosis, setDiagnosis] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [vitals, setVitals] = useState<PrescriptionVitals>({
    bloodPressure: '',
    pulse: '',
    temperature: '',
    weight: '',
    spo2: '',
  });

  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>([
    {
      name: '',
      dosage: '1 Tablet',
      frequency: '1-0-1 (Morning & Night)',
      timing: 'After Food (Post Meal)',
      duration: '5 Days',
      instructions: '',
    },
  ]);

  const [labTests, setLabTests] = useState('');
  const [advice, setAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState('After 5 Days');
  const [notes, setNotes] = useState('');

  // Preview Modal
  const [previewPrescription, setPreviewPrescription] = useState<Prescription | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load existing prescription if present
  useEffect(() => {
    if (isOpen && appointment?.id) {
      loadExistingPrescription(appointment.id);
    }
  }, [isOpen, appointment?.id]);

  const loadExistingPrescription = async (apptId: string) => {
    try {
      setLoading(true);
      const existing = await getPrescriptionByAppointment(apptId);
      if (existing) {
        setDiagnosis(existing.diagnosis || '');
        setSymptoms(existing.symptoms || '');
        setVitals({
          bloodPressure: existing.vitals?.bloodPressure || '',
          pulse: existing.vitals?.pulse || '',
          temperature: existing.vitals?.temperature || '',
          weight: existing.vitals?.weight || '',
          spo2: existing.vitals?.spo2 || '',
        });
        if (existing.medicines && existing.medicines.length > 0) {
          setMedicines(existing.medicines);
        }
        setLabTests(existing.labTests || '');
        setAdvice(existing.advice || '');
        setFollowUpDate(existing.followUpDate || 'After 5 Days');
        setNotes(existing.notes || '');
      } else {
        // Reset to initial clean template
        setDiagnosis('');
        setSymptoms(appointment?.reasonForVisit || '');
        setVitals({
          bloodPressure: '120/80',
          pulse: '74 bpm',
          temperature: '98.6 °F',
          weight: '',
          spo2: '99%',
        });
        setMedicines([
          {
            name: '',
            dosage: '1 Tablet',
            frequency: '1-0-1 (Morning & Night)',
            timing: 'After Food (Post Meal)',
            duration: '5 Days',
            instructions: '',
          },
        ]);
        setLabTests('');
        setAdvice('Adequate hydration & rest. Avoid cold / oily foods.');
        setFollowUpDate('After 5 Days');
        setNotes('');
      }
    } catch {
      // Clean fallback if 404
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      {
        name: '',
        dosage: '1 Tablet',
        frequency: '1-0-1 (Morning & Night)',
        timing: 'After Food (Post Meal)',
        duration: '5 Days',
        instructions: '',
      },
    ]);
  };

  const handleRemoveMedicine = (index: number) => {
    if (medicines.length <= 1) {
      toast.info('At least one medicine row should be kept');
      return;
    }
    setMedicines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMedicineChange = (
    index: number,
    field: keyof PrescriptionMedicine,
    value: string,
  ) => {
    setMedicines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddQuickMedicine = (med: typeof QUICK_MEDICINES[0]) => {
    // If first medicine is completely empty, replace it
    if (medicines.length === 1 && !medicines[0].name.trim()) {
      setMedicines([
        {
          name: med.name,
          dosage: med.dosage,
          frequency: med.freq,
          timing: med.timing,
          duration: med.dur,
          instructions: '',
        },
      ]);
    } else {
      setMedicines((prev) => [
        ...prev,
        {
          name: med.name,
          dosage: med.dosage,
          frequency: med.freq,
          timing: med.timing,
          duration: med.dur,
          instructions: '',
        },
      ]);
    }
  };

  const handleSubmit = async () => {
    if (!appointment?.id) return;

    if (!diagnosis.trim()) {
      toast.error('Clinical diagnosis is required');
      return;
    }

    const validMedicines = medicines.filter((m) => m.name.trim().length > 0);
    if (validMedicines.length === 0) {
      toast.error('Please enter at least one prescribed medicine');
      return;
    }

    try {
      setSubmitting(true);

      const payload: CreatePrescriptionPayload = {
        appointmentId: appointment.id,
        diagnosis: diagnosis.trim(),
        symptoms: symptoms.trim() || undefined,
        vitals: vitals.bloodPressure || vitals.pulse || vitals.temperature || vitals.weight || vitals.spo2 ? vitals : undefined,
        medicines: validMedicines,
        labTests: labTests.trim() || undefined,
        advice: advice.trim() || undefined,
        followUpDate: followUpDate.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const result = await savePrescription(payload);
      toast.success('Prescription issued successfully! Patient can now view & download.');

      if (onPrescriptionSaved) {
        onPrescriptionSaved(result.data);
      }

      onClose();
    } catch (err: unknown) {
      toast.error('Failed to issue prescription', {
        description: extractErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPreview = () => {
    if (!diagnosis.trim()) {
      toast.error('Please provide a diagnosis to preview');
      return;
    }

    const validMedicines = medicines.filter((m) => m.name.trim().length > 0);

    const mockPrescription: Prescription = {
      id: 'preview-' + Date.now(),
      appointmentId: appointment?.id || '',
      doctorId: appointment?.doctorId || '',
      patientId: appointment?.patientId || '',
      diagnosis: diagnosis.trim(),
      symptoms: symptoms.trim() || null,
      vitals: vitals,
      medicines: validMedicines.length > 0 ? validMedicines : [
        {
          name: 'Paracetamol 650mg',
          dosage: '1 Tablet',
          frequency: '1-0-1',
          timing: 'After Food',
          duration: '3 Days',
        },
      ],
      labTests: labTests.trim() || null,
      advice: advice.trim() || null,
      followUpDate: followUpDate.trim() || null,
      notes: notes.trim() || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      doctor: appointment?.doctor as any,
      patient: appointment?.patient as any,
      appointment: {
        id: appointment?.id || '',
        date: appointment?.date || '',
        startTime: appointment?.startTime || '',
        endTime: appointment?.endTime || '',
        tokenNumber: appointment?.tokenNumber,
        status: appointment?.status || 'COMPLETED',
      },
    };

    setPreviewPrescription(mockPrescription);
    setShowPreview(true);
  };

  if (!isOpen || !appointment) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Issue Medical Prescription (Rx)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Outpatient Visit
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Patient: <strong className="text-slate-800">{appointment.patient?.fullName || 'Patient'}</strong> ({appointment.patient?.age ? `${appointment.patient.age}y` : ''} {appointment.patient?.gender || ''}) • Token #{appointment.tokenNumber || '—'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
            {loading ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
                <p>Loading prescription record...</p>
              </div>
            ) : (
              <>
                {/* 1. Patient Demographics & Vitals */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                      <span>Patient Vitals (Optional)</span>
                    </label>
                    <span className="text-[11px] text-slate-400">Recorded during cabin check</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Blood Pressure
                      </span>
                      <Input
                        placeholder="120/80 mmHg"
                        value={vitals.bloodPressure || ''}
                        onChange={(e) => setVitals({ ...vitals, bloodPressure: e.target.value })}
                        className="text-xs rounded-xl h-8"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Pulse
                      </span>
                      <Input
                        placeholder="74 bpm"
                        value={vitals.pulse || ''}
                        onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                        className="text-xs rounded-xl h-8"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Temperature
                      </span>
                      <Input
                        placeholder="98.6 °F"
                        value={vitals.temperature || ''}
                        onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                        className="text-xs rounded-xl h-8"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Weight
                      </span>
                      <Input
                        placeholder="68 kg"
                        value={vitals.weight || ''}
                        onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                        className="text-xs rounded-xl h-8"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        SpO2
                      </span>
                      <Input
                        placeholder="99%"
                        value={vitals.spo2 || ''}
                        onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                        className="text-xs rounded-xl h-8"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Clinical Diagnosis & Symptoms */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-blue-600" />
                      <span>Diagnosis / Clinical Impression <span className="text-rose-500">*</span></span>
                    </label>
                    <Input
                      placeholder="e.g. Acute Viral Bronchitis, Allergic Rhinitis..."
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      className="text-xs font-semibold rounded-xl"
                    />

                    {/* Common Diagnosis Quick Selection */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-slate-400 font-semibold">Quick Suggestions:</span>
                      {COMMON_DIAGNOSES.slice(0, 4).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDiagnosis(d)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          + {d.split(' ')[0]} {d.split(' ')[1]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 block">
                      Chief Symptoms & History
                    </label>
                    <Input
                      placeholder="e.g. Throat irritation x 3 days, low-grade fever, dry cough"
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      className="text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* 3. Rx - Medicines List (Multi-item) */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Pill className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Prescribed Medicines (℞) <span className="text-rose-500">*</span></span>
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Choose dosage, frequency, meal timing, and duration
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddMedicine}
                      className="text-xs font-bold text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 h-7 rounded-xl flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Medicine</span>
                    </Button>
                  </div>

                  {/* Quick Medicine Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap bg-slate-50/80 p-2 rounded-2xl border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-amber-500" /> Fast Rx:
                    </span>
                    {QUICK_MEDICINES.slice(0, 5).map((qm, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAddQuickMedicine(qm)}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all cursor-pointer shadow-2xs"
                      >
                        + {qm.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>

                  {/* Medicines List Table */}
                  <div className="space-y-3">
                    {medicines.map((med, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5 relative group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <Input
                              placeholder="Medicine Name & Strength (e.g. Paracetamol 650mg, Augmentin 625)"
                              value={med.name}
                              onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                              className="text-xs font-bold rounded-xl h-8"
                            />
                          </div>
                          {medicines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMedicine(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Delete medicine"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Dropdown Options Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {/* Dosage Dropdown */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Dosage
                            </span>
                            <select
                              value={med.dosage}
                              onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                              className="w-full text-xs font-medium rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              {DOSAGE_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Frequency Dropdown */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Frequency
                            </span>
                            <select
                              value={med.frequency}
                              onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                              className="w-full text-xs font-medium rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              {FREQUENCY_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Food Timing Dropdown */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Intake Timing
                            </span>
                            <select
                              value={med.timing}
                              onChange={(e) => handleMedicineChange(idx, 'timing', e.target.value)}
                              className="w-full text-xs font-medium rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              {TIMING_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Duration Dropdown */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Duration
                            </span>
                            <select
                              value={med.duration}
                              onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                              className="w-full text-xs font-medium rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              {DURATION_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Special Instructions / Notes */}
                        <div>
                          <Input
                            placeholder="Optional instructions (e.g. Take with warm water, finish complete 5 days course)"
                            value={med.instructions || ''}
                            onChange={(e) => handleMedicineChange(idx, 'instructions', e.target.value)}
                            className="text-[11px] rounded-xl h-7 bg-slate-50/50 text-slate-600"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Advice, Lab Tests & Follow-Up */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800 block">
                        Lab Tests / Investigations Advised
                      </label>
                      <Input
                        placeholder="e.g. CBC, Urine Routine, Chest X-Ray"
                        value={labTests}
                        onChange={(e) => setLabTests(e.target.value)}
                        className="text-xs rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800 block">
                        Next Follow-up Guidance
                      </label>
                      <Input
                        placeholder="e.g. After 5 Days, or SOS if fever persists"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 block">
                      General Advice & Dietary Instructions
                    </label>
                    <Input
                      placeholder="e.g. Drink 2.5L water daily, salt-water gargle thrice daily, avoid cold drinks"
                      value={advice}
                      onChange={(e) => setAdvice(e.target.value)}
                      className="text-xs rounded-xl"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenPreview}
              disabled={loading || submitting}
              className="text-xs font-bold text-slate-700 rounded-xl flex items-center gap-1.5"
            >
              <Eye className="h-3.5 w-3.5 text-blue-600" />
              <span>Preview Rx Slip</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={submitting}
                className="text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || submitting}
                className="btn-primary !text-xs !py-2 !px-4 h-auto rounded-xl flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Prescription...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Save & Issue Prescription</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Real Rx Slip Preview Modal */}
      {showPreview && previewPrescription && (
        <PrescriptionViewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          prescription={previewPrescription}
        />
      )}
    </>
  );
}

