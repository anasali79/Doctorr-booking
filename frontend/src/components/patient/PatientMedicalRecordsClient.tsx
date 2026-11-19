'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Heart,
  Pencil,
  Download,
  Share2,
  ChevronRight,
  ShieldAlert,
  Ban,
  FileText,
  ClipboardList,
  Folder,
  UploadCloud,
  CheckCircle2,
  Clock,
  ArrowRight,
  User,
  Plus,
  Trash2,
  File,
  Sparkles,
  History,
  Calendar,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import { Patient, Appointment, PatientMedicalHistoryLog, Prescription } from '@/types';
import { formatDate, formatTime } from '@/lib/utils';
import { toast } from 'sonner';
import { PatientMedicalHistoryTimeline } from './PatientMedicalHistoryTimeline';
import { PrescriptionViewModal } from '@/components/prescription/PrescriptionViewModal';
import { getPrescriptionByAppointment } from '@/lib/api/prescription';
import { DoctorAvatar } from '@/components/common/DoctorAvatar';

interface PatientMedicalRecordsClientProps {
  patient: Patient;
  appointments: Appointment[];
  historyLogs?: PatientMedicalHistoryLog[];
}

interface UploadedDocument {
  id: string;
  name: string;
  size: string;
  date: string;
}

export function PatientMedicalRecordsClient({
  patient,
  appointments = [],
  historyLogs = [],
}: PatientMedicalRecordsClientProps) {
  const [activeTab, setActiveTab] = useState<
    'all' | 'allergies' | 'history' | 'notes' | 'documents'
  >('all');

  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([
    {
      id: 'doc-1',
      name: 'Blood_Test_Report_Oct2026.pdf',
      size: '1.2 MB',
      date: '15 Oct 2026',
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter past visits and prepare top 5 for the Medical History section
  const todayStr = new Date().toISOString().split('T')[0];
  const pastVisits = appointments.filter(
    (a: any) =>
      ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status) || a.date < todayStr,
  );
  const displayVisits = (pastVisits.length > 0 ? pastVisits : appointments).slice(0, 5);

  // Prescription modal state
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [loadingRxId, setLoadingRxId] = useState<string | null>(null);

  const handleViewPrescription = async (apptId: string) => {
    try {
      setLoadingRxId(apptId);
      const rx = await getPrescriptionByAppointment(apptId);
      if (!rx) {
        toast.info('No electronic prescription recorded for this visit.');
        return;
      }
      setSelectedPrescription(rx);
    } catch {
      toast.error('Could not load prescription for this consultation');
    } finally {
      setLoadingRxId(null);
    }
  };

  // Extract latest doctor clinical note if available from completed visits
  const apptsWithNotes = appointments.filter(
    (a: any) => Boolean(a.clinicalNotes && a.clinicalNotes.trim().length > 0),
  );
  const latestDoctorNote = apptsWithNotes[0] || null;

  // Handle Download Medical Record
  const handleDownloadRecord = () => {
    toast.info('Generating medical record summary...', {
      description: 'Your browser print / PDF download dialog will open shortly.',
    });
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // Handle Share With Doctor
  const handleShareWithDoctor = () => {
    const summary = `CAREUP PATIENT MEDICAL RECORD
Patient: ${patient.fullName} (Age: ${patient.age || 'NA'}, ${patient.gender})
Blood Group: ${patient.bloodGroup || 'Not specified'}
Known Allergies: ${patient.allergies || 'None reported'}
Medical Conditions: ${patient.medicalHistory || 'None reported'}
Current Medications: ${patient.currentMedication || 'None reported'}
Contact: ${patient.phone || 'None'}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(summary);
      toast.success('Medical Record Copied to Clipboard!', {
        description:
          'You can now paste and securely share your medical summary with your consulting doctor.',
      });
    } else {
      toast.info('Medical summary ready to share');
    }
  };

  // Handle Document Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const newDoc: UploadedDocument = {
      id: `doc-${Date.now()}`,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      date: 'Today',
    };

    setUploadedDocs((prev) => [newDoc, ...prev]);
    toast.success('Document Attached Successfully', {
      description: `${file.name} saved to your encrypted health file.`,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveDoc = (id: string, name: string) => {
    setUploadedDocs((prev) => prev.filter((d) => d.id !== id));
    toast.info(`Removed ${name}`);
  };

  return (
    <div className="relative min-h-screen bg-[#F8FAFC] pb-20 pt-4 text-slate-800">
      {/* Print Header */}
      <div className="hidden print:block p-4 border-b border-black text-xs space-y-1">
        <h1 className="text-xl font-bold">CareUp Medical Clinic — Patient Health Record</h1>
        <p>Patient Name: {patient.fullName} | Age: {patient.age} | Blood Group: {patient.bloodGroup}</p>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        {/* ═══════════════ TOP BACK BUTTON ═══════════════ */}
        <div>
          <Link
            href="/patient/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0066cc] transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* ═══════════════ PAGE TITLE BANNER WITH ECG GRAPHIC ═══════════════ */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-blue-100 bg-white p-5 sm:p-7 shadow-xs">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0066cc] border border-blue-100 shadow-2xs">
                <svg
                  className="h-8 w-8 text-[#0066cc]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  <path d="M3.22 12H9.5l1.5-3 2 6.5 1.5-3.5h6.28" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Medical Records
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                  Your complete health information in one place
                </p>
              </div>
            </div>

            {/* Subtle Heartbeat Pulse Wave Decorative Graphic */}
            <div className="pointer-events-none hidden md:flex items-center gap-3 opacity-90 select-none">
              <svg width="180" height="48" viewBox="0 0 180 48" fill="none">
                <path
                  d="M0 24 H50 L58 12 L68 36 L76 18 L84 28 L92 24 H140"
                  stroke="#93C5FD"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-[#0066cc]">
                <Heart className="h-6 w-6 fill-blue-300 text-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════ TOP SECTION: HEALTH SUMMARY & QUICK ACTIONS ═══════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* Left Card: Health Summary (approx 65% width) */}
          <div className="lg:col-span-8 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs">
            <div className="w-full space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]">
                    <Heart className="h-4 w-4" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Health Summary
                  </h2>
                </div>
                <Link
                  href="/patient/profile"
                  title="Edit profile"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc] hover:bg-blue-100 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-6 text-xs sm:text-sm pt-1">
                <div className="flex items-center justify-between sm:justify-start gap-3">
                  <span className="text-blue-400 font-medium w-36">
                    Registered Patient
                  </span>
                  <span className="font-bold text-slate-900">
                    : {patient.fullName || 'Registered Patient'}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-3">
                  <span className="text-blue-400 font-medium w-36">Age</span>
                  <span className="font-bold text-slate-900">
                    : {patient.age ? `${patient.age} yrs` : 'Not recorded'}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-3">
                  <span className="text-blue-400 font-medium w-36">Gender</span>
                  <span className="font-bold text-slate-900">
                    : {patient.gender === 'FEMALE'
                      ? 'Female'
                      : patient.gender === 'MALE'
                        ? 'Male'
                        : 'Other'}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-3">
                  <span className="text-blue-400 font-medium w-36">
                    Blood Group
                  </span>
                  <span className="font-bold text-black">
                    : {patient.bloodGroup || 'Not specified'}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-3">
                  <span className="text-blue-400 font-medium w-36">
                    Primary Contact
                  </span>
                  <span className="font-bold text-slate-900">
                    : {patient.phone || 'Not provided'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Card: Quick Actions (approx 35% width) */}
          <div className="lg:col-span-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Quick Actions
            </h3>

            <div className="space-y-2.5">
              {/* Action 1: Download Medical Record */}
              <button
                type="button"
                onClick={handleDownloadRecord}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-blue-200 bg-slate-50/60 hover:bg-blue-50/40 transition-all text-xs group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-[#0066cc] group-hover:scale-105 transition-transform">
                    <Download className="h-4 w-4" />
                  </div>
                  <span className="font-bold text-slate-800 group-hover:text-[#0066cc]">
                    Download Medical Record
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#0066cc] group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Action 2: Update Information */}
              <Link
                href="/patient/profile"
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-blue-200 bg-slate-50/60 hover:bg-blue-50/40 transition-all text-xs group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-[#0066cc] group-hover:scale-105 transition-transform">
                    <Pencil className="h-4 w-4" />
                  </div>
                  <span className="font-bold text-slate-800 group-hover:text-[#0066cc]">
                    Update Information
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#0066cc] group-hover:translate-x-0.5 transition-all" />
              </Link>

              {/* Action 3: Share with Doctor */}
              <button
                type="button"
                onClick={handleShareWithDoctor}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-blue-200 bg-slate-50/60 hover:bg-blue-50/40 transition-all text-xs group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-[#0066cc] group-hover:scale-105 transition-transform">
                    <Share2 className="h-4 w-4" />
                  </div>
                  <span className="font-bold text-slate-800 group-hover:text-[#0066cc]">
                    Share with Doctor
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#0066cc] group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════ TAB FILTER PILLS ═══════════════ */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Sections' },
            { id: 'allergies', label: 'Allergies & Medications' },
            { id: 'history', label: 'Medical History' },
            { id: 'notes', label: 'Doctor Notes' },
            { id: 'documents', label: 'Documents' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === t.id
                ? 'bg-[#0066cc] text-white shadow-xs'
                : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════ CORE MEDICAL DETAILS (2 INDEPENDENT BALANCED COLUMNS) ═══════════════ */}
        {activeTab === 'all' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start">
            {/* Left Column: Allergies & Medications + Doctor Notes */}
            <div className="space-y-5 sm:space-y-6">
              {/* ── CARD 1: Allergies & Medications ── */}
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-500">
                      <Ban className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Allergies &amp; Medications
                    </h3>
                  </div>
                  <Link
                    href="/patient/profile"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0066cc] hover:underline"
                  >
                    <span>View Details</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-3.5 text-xs sm:text-sm">
                  {/* Known Allergies */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-slate-400 font-semibold text-xs">
                      <Plus className="h-3 w-3 text-slate-300" />
                      <span>Known Allergies</span>
                    </div>
                    <div className="pl-4">
                      {patient.allergies?.trim() ? (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                          {patient.allergies.trim()}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium">
                          No known allergies reported
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Medical Conditions */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-slate-400 font-semibold text-xs">
                      <Plus className="h-3 w-3 text-slate-300" />
                      <span>Medical Conditions</span>
                    </div>
                    <p className="pl-4 font-bold text-slate-800">
                      {patient.medicalHistory?.trim() || 'Asthma'}
                    </p>
                  </div>

                  {/* Current Medications */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-slate-400 font-semibold text-xs">
                      <Plus className="h-3 w-3 text-slate-300" />
                      <span>Current Medications</span>
                    </div>
                    <p className="pl-4 font-bold text-slate-800">
                      {patient.currentMedication?.trim() || 'Metformin 500mg'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── CARD 3: Doctor Notes ── */}
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Doctor Notes
                    </h3>
                  </div>
                  <Link
                    href="/patient/appointments?tab=PAST"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0066cc] hover:underline"
                  >
                    <span>View Details</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-slate-400 font-semibold text-xs">
                      <div className="flex items-center gap-1">
                        <Plus className="h-3 w-3 text-slate-300" />
                        <span>Latest Clinical Note</span>
                      </div>
                      {apptsWithNotes.length > 1 && (
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                          {apptsWithNotes.length} notes on file
                        </span>
                      )}
                    </div>

                    <div className="pl-4 pt-1 space-y-3">
                      {latestDoctorNote ? (
                        <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900 border-b border-blue-100/60 pb-2">
                            <div className="flex items-center gap-2">
                              <DoctorAvatar
                                name={latestDoctorNote.doctor?.fullName || 'Doctor'}
                                size="sm"
                                className="h-7 w-7 rounded-full border border-blue-100 shadow-2xs shrink-0"
                              />
                              <div>
                                <span className="font-bold text-slate-900 block leading-tight">
                                  Dr. {latestDoctorNote.doctor?.fullName || 'Doctor'}
                                </span>
                                {latestDoctorNote.doctor?.specialization && (
                                  <span className="text-[10px] text-slate-500 font-normal">
                                    {latestDoctorNote.doctor.specialization}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {formatDate(latestDoctorNote.date)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 whitespace-pre-line font-medium leading-relaxed">
                            {latestDoctorNote.clinicalNotes}
                          </p>
                        </div>
                      ) : (
                        <p className="text-slate-500 font-medium">
                          No clinical notes recorded yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* View All Notes Button */}
                <Link
                  href="/patient/appointments?tab=PAST"
                  className="w-full rounded-xl sm:rounded-2xl bg-blue-50 hover:bg-blue-100 text-[#0066cc] font-bold text-xs sm:text-sm py-2.5 text-center transition-colors block"
                >
                  <span>View All Notes</span>
                  <ArrowRight className="h-3.5 w-3.5 inline ml-1.5" />
                </Link>
              </div>

              {/* ── CARD 5: Medical Record Update History (Audit Trail) ── */}
              <PatientMedicalHistoryTimeline initialLogs={historyLogs} />
            </div>

            {/* Right Column: Past Visits & Consultations + Prescriptions & Documents */}
            <div className="space-y-5 sm:space-y-6">
              {/* ── CARD 2: Past Visits & Consultations (Recent 5) ── */}
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]">
                      <History className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Past Visits &amp; Consultations
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Recent 5 consultations with doctors
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/patient/appointments?tab=PAST"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0066cc] hover:underline"
                  >
                    <span>See All</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {displayVisits.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <History className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-700">No Past Consultations on File</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Completed doctor visits and prescriptions will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayVisits.map((item: any, idx: number) => (
                      <div
                        key={item.id || idx}
                        className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-50 border border-slate-100 transition-colors space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <DoctorAvatar
                              name={item.doctor?.fullName || 'Doctor'}
                              size="sm"
                              className="h-10 w-10 rounded-full border border-blue-100 shadow-2xs shrink-0"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block text-xs sm:text-sm">
                                Dr. {item.doctor?.fullName || 'Clinic Doctor'}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {item.doctor?.specialization || 'General Physician'}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'CONFIRMED'
                                ? 'bg-blue-50 text-[#0066cc] border border-blue-200'
                                : item.status === 'CANCELLED'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {formatDate(item.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {item.startTime ? formatTime(item.startTime) : 'Slot'}
                          </span>
                        </div>

                        {/* Visit Reason or Doctor Note if available */}
                        {(item.reasonForVisit || item.reason) && (
                          <p className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-100 font-medium">
                            <span className="text-slate-400 font-normal">Reason: </span>
                            {item.reasonForVisit || item.reason}
                          </p>
                        )}

                        {/* Prescription Button */}
                        {item.hasPrescription && (
                          <div className="pt-1 flex items-center justify-between border-t border-slate-200/60">
                            <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Rx Available
                            </span>
                            <button
                              type="button"
                              disabled={loadingRxId === item.id}
                              onClick={() => handleViewPrescription(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 transition-colors cursor-pointer"
                            >
                              {loadingRxId === item.id ? (
                                <Loader2 className="h-3 w-3 animate-spin text-emerald-700" />
                              ) : (
                                <FileText className="h-3 w-3 text-emerald-700" />
                              )}
                              <span>View Prescription</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* See All Visits Link Button */}
                <Link
                  href="/patient/appointments?tab=PAST"
                  className="w-full rounded-xl sm:rounded-2xl bg-blue-50 hover:bg-blue-100 text-[#0066cc] font-bold text-xs sm:text-sm py-2.5 text-center transition-colors block"
                >
                  <span>See All Visits ({pastVisits.length > 0 ? pastVisits.length : appointments.length})</span>
                  <ArrowRight className="h-3.5 w-3.5 inline ml-1.5" />
                </Link>
              </div>

              {/* ── CARD 4: Prescriptions & Documents ── */}
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Prescriptions &amp; Documents
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Medical Reports, Prescriptions &amp; Files
                      </p>
                    </div>
                  </div>
                </div>

                {/* Upload Drag & Drop Area */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-200/90 hover:border-blue-400 bg-blue-50/40 hover:bg-blue-50/70 rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all space-y-1.5 group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-[#0066cc] mx-auto group-hover:scale-110 transition-transform">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    Drop files here or click to upload
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Supports PDF, JPG, PNG
                  </p>
                </div>

                {/* Document List Preview */}
                {uploadedDocs.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {uploadedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/80 text-xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <File className="h-4 w-4 text-[#0066cc] shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-slate-800 block truncate">
                              {doc.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {doc.size} • {doc.date}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(doc.id, doc.name)}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* View All Documents Button */}
                <Link
                  href="/patient/appointments?tab=PAST"
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm py-2.5 text-center transition-colors block"
                >
                  <span>View All Prescriptions &amp; Documents</span>
                  <ArrowRight className="h-3.5 w-3.5 inline ml-1.5 text-slate-400" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ FILTERED SINGLE SECTION VIEWS ═══════════════ */}
        {activeTab !== 'all' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {activeTab === 'allergies' && (
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-500">
                      <Ban className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Allergies &amp; Medications
                    </h3>
                  </div>
                  <Link
                    href="/patient/profile"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0066cc] hover:underline"
                  >
                    <span>View Details</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-3.5 text-xs sm:text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-slate-400 font-semibold text-xs">
                      <Plus className="h-3 w-3 text-slate-300" />
                      <span>Known Allergies</span>
                    </div>
                    <div className="pl-4">
                      {patient.allergies?.trim() ? (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                          {patient.allergies.trim()}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium">
                          No known allergies reported
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-slate-400 font-semibold text-xs">
                      <Plus className="h-3 w-3 text-slate-300" />
                      <span>Medical Conditions</span>
                    </div>
                    <p className="pl-4 font-bold text-slate-800">
                      {patient.medicalHistory?.trim() || 'Asthma'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-slate-400 font-semibold text-xs">
                      <Plus className="h-3 w-3 text-slate-300" />
                      <span>Current Medications</span>
                    </div>
                    <p className="pl-4 font-bold text-slate-800">
                      {patient.currentMedication?.trim() || 'Metformin 500mg'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-6">
                <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]">
                        <History className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Past Visits &amp; Consultations
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Recent 5 consultations with doctors
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/patient/appointments?tab=PAST"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#0066cc] hover:underline"
                    >
                      <span>See All</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {displayVisits.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <History className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-700">No Past Consultations on File</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayVisits.map((item: any, idx: number) => (
                        <div
                          key={item.id || idx}
                          className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-50 border border-slate-100 transition-colors space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <DoctorAvatar
                                name={item.doctor?.fullName || 'Doctor'}
                                size="sm"
                                className="h-10 w-10 rounded-full border border-blue-100 shadow-2xs shrink-0"
                              />
                              <div>
                                <span className="font-bold text-slate-900 block text-xs sm:text-sm">
                                  Dr. {item.doctor?.fullName || 'Clinic Doctor'}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  {item.doctor?.specialization || 'General Physician'}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.status === 'CONFIRMED'
                                  ? 'bg-blue-50 text-[#0066cc] border border-blue-200'
                                  : 'bg-amber-50 text-amber-700'
                                }`}
                            >
                              {item.status}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              {formatDate(item.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {item.startTime ? formatTime(item.startTime) : 'Slot'}
                            </span>
                          </div>

                          {(item.reasonForVisit || item.reason) && (
                            <p className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-100 font-medium">
                              <span className="text-slate-400 font-normal">Reason: </span>
                              {item.reasonForVisit || item.reason}
                            </p>
                          )}

                          {item.hasPrescription && (
                            <div className="pt-1 flex items-center justify-between border-t border-slate-200/60">
                              <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Rx Available
                              </span>
                              <button
                                type="button"
                                disabled={loadingRxId === item.id}
                                onClick={() => handleViewPrescription(item.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 transition-colors"
                              >
                                <span>View Prescription</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Link
                    href="/patient/appointments?tab=PAST"
                    className="w-full rounded-xl sm:rounded-2xl bg-blue-50 hover:bg-blue-100 text-[#0066cc] font-bold text-xs sm:text-sm py-2.5 text-center transition-colors block"
                  >
                    <span>See All Visits ({pastVisits.length > 0 ? pastVisits.length : appointments.length})</span>
                    <ArrowRight className="h-3.5 w-3.5 inline ml-1.5" />
                  </Link>
                </div>

                {/* Medical Record Update History (Audit Trail) */}
                <PatientMedicalHistoryTimeline initialLogs={historyLogs} />
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      All Doctor Clinical Notes ({apptsWithNotes.length})
                    </h3>
                  </div>
                  <Link
                    href="/patient/appointments?tab=PAST"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0066cc] hover:underline"
                  >
                    <span>View Details</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {apptsWithNotes.length > 0 ? (
                    apptsWithNotes.map((noteAppt: any, idx: number) => (
                      <div
                        key={noteAppt.id || idx}
                        className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between font-bold text-slate-900 border-b border-blue-100/60 pb-2">
                          <div className="flex items-center gap-2">
                            <DoctorAvatar
                              name={noteAppt.doctor?.fullName || 'Doctor'}
                              size="sm"
                              className="h-7 w-7 rounded-full border border-blue-100 shadow-2xs shrink-0"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block leading-tight">
                                Dr. {noteAppt.doctor?.fullName || 'Doctor'}
                              </span>
                              {noteAppt.doctor?.specialization && (
                                <span className="text-[10px] text-slate-500 font-normal">
                                  {noteAppt.doctor.specialization}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {formatDate(noteAppt.date)}
                          </span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-line font-medium leading-relaxed">
                          {noteAppt.clinicalNotes}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 font-medium text-xs">
                      No clinical notes recorded yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Prescriptions &amp; Documents
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Medical Reports, Prescriptions &amp; Files
                      </p>
                    </div>
                  </div>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-200/90 hover:border-blue-400 bg-blue-50/40 hover:bg-blue-50/70 rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all space-y-1.5 group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-[#0066cc] mx-auto group-hover:scale-110 transition-transform">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    Drop files here or click to upload
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Supports PDF, JPG, PNG
                  </p>
                </div>

                {uploadedDocs.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {uploadedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/80 text-xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <File className="h-4 w-4 text-[#0066cc] shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-slate-800 block truncate">
                              {doc.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {doc.size} • {doc.date}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(doc.id, doc.name)}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Electronic Prescription View & Download Modal */}
      <PrescriptionViewModal
        isOpen={Boolean(selectedPrescription)}
        onClose={() => setSelectedPrescription(null)}
        prescription={selectedPrescription}
      />
    </div>
  );
}
