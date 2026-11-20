'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  Phone,
  Clock,
  FileText,
  Pill,
  ShieldAlert,
  Heart,
  Edit3,
  Loader2,
  Save,
  Droplets,
  History,
  ExternalLink,
  PlusCircle,
  Calendar,
  CheckCircle2,
  User,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { clientAxios } from '@/lib/api/axios';
import { formatDate, formatTime } from '@/lib/utils';
import { toast } from 'sonner';
import { PrescriptionViewModal } from '@/components/prescription/PrescriptionViewModal';
import { getPrescriptionByAppointment } from '@/lib/api/prescription';
import { Prescription } from '@/types';

interface PatientProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  initialPatient?: any;
  currentAppointment?: any;
  currentAppointmentId?: string;
  onRecordUpdated?: () => void;
}

export function PatientProfileModal({
  isOpen,
  onClose,
  patientId,
  initialPatient,
  currentAppointment,
  currentAppointmentId,
  onRecordUpdated,
}: PatientProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    patient: any;
    stats: {
      totalVisits: number;
      completedVisits: number;
      lastVisitDate: string | null;
    };
    appointments: any[];
    allClinicalNotes: any[];
    medicalHistoryLogs?: any[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'history' | 'audit'>('overview');
  const [auditFilter, setAuditFilter] = useState<string>('all');
  const [isEditingMedical, setIsEditingMedical] = useState(false);
  const [savingMedical, setSavingMedical] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [newNoteInput, setNewNoteInput] = useState('');
  const [visitPage, setVisitPage] = useState(1);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [loadingRxId, setLoadingRxId] = useState<string | null>(null);

  const VISITS_PER_PAGE = 5;

  const handleViewPrescription = async (appt: any) => {
    try {
      setLoadingRxId(appt.id);
      const rx = await getPrescriptionByAppointment(appt.id);
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

  // Reset pagination when active tab or appointments change
  useEffect(() => {
    if (activeTab === 'visits') {
      setVisitPage(1);
    }
  }, [activeTab]);

  // Medical record edit form
  const [medicalForm, setMedicalForm] = useState({
    bloodGroup: '',
    allergies: '',
    medicalHistory: '',
    currentMedication: '',
    basicHealthInfo: '',
  });

  // Pre-seed data from initialPatient and currentAppointment so modal never opens empty
  useEffect(() => {
    if (!isOpen) return;

    const basePatient = initialPatient || (data?.patient ? data.patient : null);
    if (basePatient) {
      const existingAppts = currentAppointment ? [currentAppointment] : [];
      setData((prev) => {
        if (prev?.patient?.id && prev.patient.id === (patientId || basePatient.id)) {
          return prev;
        }
        return {
          patient: {
            id: patientId || basePatient.id || '',
            fullName: basePatient.fullName || 'Patient',
            age: basePatient.age ?? null,
            gender: basePatient.gender || 'OTHER',
            phone: basePatient.phone || '',
            address: basePatient.address || '',
            bloodGroup: basePatient.bloodGroup || '',
            allergies: basePatient.allergies || '',
            medicalHistory: basePatient.medicalHistory || '',
            currentMedication: basePatient.currentMedication || '',
            basicHealthInfo: basePatient.basicHealthInfo || '',
            registeredAt: basePatient.createdAt || null,
          },
          stats: {
            totalVisits: existingAppts.length,
            completedVisits: currentAppointment?.status === 'COMPLETED' ? 1 : 0,
            lastVisitDate: currentAppointment?.date || null,
          },
          appointments: existingAppts,
          allClinicalNotes: currentAppointment?.clinicalNotes
            ? [
                {
                  appointmentId: currentAppointment.id,
                  date: currentAppointment.date,
                  time: currentAppointment.startTime,
                  tokenNumber: currentAppointment.tokenNumber,
                  notes: currentAppointment.clinicalNotes,
                  reasonForVisit: currentAppointment.reasonForVisit || null,
                },
              ]
            : [],
        };
      });

      setMedicalForm({
        bloodGroup: basePatient.bloodGroup || '',
        allergies: basePatient.allergies || '',
        medicalHistory: basePatient.medicalHistory || '',
        currentMedication: basePatient.currentMedication || '',
        basicHealthInfo: basePatient.basicHealthInfo || '',
      });
    }

    setIsEditingMedical(false);
    setNewNoteInput('');

    // If we have a valid patientId, fetch complete history from database
    if (patientId) {
      let isSubscribed = true;
      setLoading(true);

      clientAxios
        .get<{ success: boolean; data: any }>(`/api/doctor/patients/${patientId}`)
        .then((res) => {
          if (!isSubscribed) return;
          const record = res.data?.data;
          if (record && record.patient) {
            setData(record);
            setMedicalForm({
              bloodGroup: record.patient.bloodGroup || '',
              allergies: record.patient.allergies || '',
              medicalHistory: record.patient.medicalHistory || '',
              currentMedication: record.patient.currentMedication || '',
              basicHealthInfo: record.patient.basicHealthInfo || '',
            });
          }
        })
        .catch((err) => {
          // If record lookup fails (e.g. demo data or 404), retain pre-seeded patient info
          console.warn('Patient database history not found or unavailable:', err?.message);
        })
        .finally(() => {
          if (isSubscribed) setLoading(false);
        });

      return () => {
        isSubscribed = false;
      };
    }
  }, [isOpen, patientId]);

  if (!isOpen) return null;

  const patient = data?.patient || initialPatient;
  const stats = data?.stats;
  const appointments = data?.appointments || (currentAppointment ? [currentAppointment] : []);
  const totalVisitPages = Math.max(1, Math.ceil(appointments.length / VISITS_PER_PAGE));
  const paginatedAppointments = appointments.slice(
    (visitPage - 1) * VISITS_PER_PAGE,
    visitPage * VISITS_PER_PAGE,
  );
  const notes = data?.allClinicalNotes || [];
  const historyLogs = data?.medicalHistoryLogs || [];
  const activeApptId = currentAppointmentId || currentAppointment?.id;

  const handleSaveMedicalRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      toast.success('Medical details updated locally');
      setIsEditingMedical(false);
      return;
    }

    setSavingMedical(true);
    try {
      await clientAxios.patch(`/api/doctor/patients/${patientId}/medical-record`, medicalForm);
      toast.success('Patient medical record updated');
      setIsEditingMedical(false);
      // Update local state and re-fetch to sync latest audit logs
      setData((prev: any) =>
        prev
          ? {
              ...prev,
              patient: {
                ...prev.patient,
                ...medicalForm,
              },
            }
          : prev,
      );
      // Refresh full history logs from server
      clientAxios
        .get<{ success: boolean; data: any }>(`/api/doctor/patients/${patientId}`)
        .then((res) => {
          if (res.data?.data) {
            setData(res.data.data);
          }
        })
        .catch(() => {});
      onRecordUpdated?.();
    } catch {
      toast.error('Failed to update medical record on server');
    } finally {
      setSavingMedical(false);
    }
  };

  const handleAddConsultationNote = async () => {
    if (!newNoteInput.trim() || !activeApptId) return;
    setSavingNote(true);
    try {
      await clientAxios.patch(`/api/doctor/appointments/${activeApptId}/clinical-notes`, {
        notes: newNoteInput.trim(),
      });
      toast.success('Clinical note recorded for consultation');
      // Append locally
      const added = {
        appointmentId: activeApptId,
        date: currentAppointment?.date || new Date().toISOString().split('T')[0],
        time: currentAppointment?.startTime || '',
        notes: newNoteInput.trim(),
        reasonForVisit: currentAppointment?.reasonForVisit || null,
      };
      setData((prev: any) =>
        prev
          ? {
              ...prev,
              allClinicalNotes: [added, ...(prev.allClinicalNotes || [])],
            }
          : prev,
      );
      setNewNoteInput('');
      onRecordUpdated?.();
    } catch {
      toast.error('Failed to save clinical note to database');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200/90 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#0066cc] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {(patient?.fullName || 'PT')
                .split(' ')
                .map((n: string) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {patient?.fullName || 'Patient Medical Profile'}
                </h2>
                {patient?.bloodGroup && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                    <Droplets className="h-3 w-3" />
                    {patient.bloodGroup}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Patient ID: #{patient?.id ? patient.id.slice(0, 8).toUpperCase() : 'REGISTERED'} • Clinical Profile
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {patientId && (
              <Link
                href={`/doctor/patients?patientId=${patientId}`}
                className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-[#0066cc] hover:underline px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 transition-colors"
              >
                <span>Directory</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Quick Demographics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block">Age & Gender</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {patient?.age ? `${patient.age} yrs` : 'Age not recorded'} •{' '}
                {patient?.gender === 'FEMALE' ? 'Female' : patient?.gender === 'MALE' ? 'Male' : 'Other'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Phone Number</span>
              <span className="font-semibold text-slate-800 mt-0.5 block flex items-center gap-1">
                <Phone className="h-3 w-3 text-slate-400" />
                {patient?.phone || 'Not provided'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Consultations</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {stats?.totalVisits ?? appointments.length} visit{(stats?.totalVisits ?? appointments.length) !== 1 ? 's' : ''}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Last Visit</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {stats?.lastVisitDate
                  ? formatDate(stats.lastVisitDate)
                  : currentAppointment?.date
                  ? formatDate(currentAppointment.date)
                  : 'Today'}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`pb-2.5 transition-colors relative ${
                activeTab === 'overview' ? 'text-[#0066cc]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Medical Parameters & Allergies
              {activeTab === 'overview' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('visits')}
              className={`pb-2.5 transition-colors relative ${
                activeTab === 'visits' ? 'text-[#0066cc]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Consultations ({appointments.length})
              {activeTab === 'visits' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 transition-colors relative ${
                activeTab === 'history' ? 'text-[#0066cc]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Doctor Notes History ({notes.length})
              {activeTab === 'history' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`pb-2.5 transition-colors relative flex items-center gap-1.5 ${
                activeTab === 'audit' ? 'text-[#0066cc]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Update History ({historyLogs.length})</span>
              {activeTab === 'audit' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
              )}
            </button>
          </div>

          {loading && (
            <div className="py-2 flex items-center gap-2 text-xs text-slate-500 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0066cc]" />
              <span>Syncing full clinical records from database…</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW & MEDICAL PROFILE */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-[#0066cc]" />
                  <span>Clinical Health Parameters</span>
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('audit')}
                    className="h-8 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
                  >
                    <History className="h-3.5 w-3.5 text-[#0066cc]" />
                    <span>Update History ({historyLogs.length})</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingMedical(!isEditingMedical)}
                    className="h-8 text-xs font-semibold rounded-xl text-slate-700 hover:bg-slate-100"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1" />
                    {isEditingMedical ? 'Cancel Edit' : 'Edit Medical Record'}
                  </Button>
                </div>
              </div>

              {isEditingMedical ? (
                <form
                  onSubmit={handleSaveMedicalRecord}
                  className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-4 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">Blood Group</label>
                      <Select
                        value={medicalForm.bloodGroup}
                        onValueChange={(val) => setMedicalForm({ ...medicalForm, bloodGroup: val })}
                      >
                        <SelectTrigger className="field-input bg-white">
                          <SelectValue placeholder="Select Blood Group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A+">A Positive (A+)</SelectItem>
                          <SelectItem value="A-">A Negative (A-)</SelectItem>
                          <SelectItem value="B+">B Positive (B+)</SelectItem>
                          <SelectItem value="B-">B Negative (B-)</SelectItem>
                          <SelectItem value="AB+">AB Positive (AB+)</SelectItem>
                          <SelectItem value="AB-">AB Negative (AB-)</SelectItem>
                          <SelectItem value="O+">O Positive (O+)</SelectItem>
                          <SelectItem value="O-">O Negative (O-)</SelectItem>
                          <SelectItem value="UNKNOWN">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="field-label">Known Allergies</label>
                      <Input
                        value={medicalForm.allergies}
                        onChange={(e) => setMedicalForm({ ...medicalForm, allergies: e.target.value })}
                        placeholder="e.g. Penicillin, Peanuts (or 'None')"
                        className="field-input bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="field-label">Medical History & Chronic Conditions</label>
                    <Textarea
                      value={medicalForm.medicalHistory}
                      onChange={(e) => setMedicalForm({ ...medicalForm, medicalHistory: e.target.value })}
                      rows={2}
                      placeholder="e.g. Asthma (diagnosed 2019), Hypertension"
                      className="field-textarea bg-white"
                    />
                  </div>

                  <div>
                    <label className="field-label">Current Regular Medications</label>
                    <Textarea
                      value={medicalForm.currentMedication}
                      onChange={(e) => setMedicalForm({ ...medicalForm, currentMedication: e.target.value })}
                      rows={2}
                      placeholder="e.g. Inhaler as needed, Metformin 500mg"
                      className="field-textarea bg-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingMedical(false)}
                      className="h-8 text-xs font-semibold"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={savingMedical}
                      size="sm"
                      className="h-8 text-xs font-semibold bg-[#0066cc] text-white hover:bg-[#0055b3]"
                    >
                      {savingMedical ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          <span>Saving…</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5 mr-1" />
                          <span>Save Medical Record</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Allergies Card */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center gap-2 text-rose-600 font-bold text-xs">
                      <ShieldAlert className="h-4 w-4" />
                      <span>Allergies</span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium">
                      {patient?.allergies?.trim() || 'No known allergies reported'}
                    </p>
                  </div>

                  {/* Blood Group */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center gap-2 text-[#0066cc] font-bold text-xs">
                      <Droplets className="h-4 w-4" />
                      <span>Blood Group</span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium">
                      {patient?.bloodGroup?.trim() || 'Not specified'}
                    </p>
                  </div>

                  {/* Medical History */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2 sm:col-span-2">
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <span>Past Medical History & Chronic Conditions</span>
                    </div>
                    <p className="text-xs text-slate-800 whitespace-pre-line">
                      {patient?.medicalHistory?.trim() || 'No significant past medical history on file'}
                    </p>
                  </div>

                  {/* Current Medication */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2 sm:col-span-2">
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                      <Pill className="h-4 w-4 text-[#0066cc]" />
                      <span>Current Regular Medications</span>
                    </div>
                    <p className="text-xs text-slate-800 whitespace-pre-line">
                      {patient?.currentMedication?.trim() || 'No active regular medications recorded'}
                    </p>
                  </div>

                  {/* General Health Notes */}
                  {patient?.basicHealthInfo && (
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 sm:col-span-2">
                      <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                        <Heart className="h-4 w-4 text-rose-500" />
                        <span>Patient Reported Health Notes</span>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-line">
                        {patient.basicHealthInfo}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Add Consultation Note for Current Visit */}
              {activeApptId && (
                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <PlusCircle className="h-3.5 w-3.5 text-[#0066cc]" />
                    <span>Add Consultation Note for Current Visit</span>
                  </h4>
                  <div className="space-y-2">
                    <Textarea
                      value={newNoteInput}
                      onChange={(e) => setNewNoteInput(e.target.value)}
                      placeholder="Add clinical findings, prescribed medicine, dietary advice..."
                      rows={2}
                      className="field-textarea text-xs"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        disabled={savingNote || !newNoteInput.trim()}
                        onClick={handleAddConsultationNote}
                        size="sm"
                        className="h-8 text-xs font-semibold bg-[#0066cc] text-white hover:bg-[#0055b3]"
                      >
                        {savingNote ? 'Saving…' : 'Save Consultation Note'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONSULTATIONS & PREVIOUS VISITS LIST */}
          {activeTab === 'visits' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#0066cc]">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      All Consultations ({appointments.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Chronological history of all patient consultations across all clinic doctors.
                    </p>
                  </div>
                </div>

                {appointments.length > VISITS_PER_PAGE && (
                  <span className="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                    Page {visitPage} of {totalVisitPages}
                  </span>
                )}
              </div>

              {appointments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
                  <History className="h-9 w-9 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No Consultations on Record</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No completed or previous visits have been recorded for this patient.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedAppointments.map((appt: any) => (
                    <div
                      key={appt.id || `${appt.date}-${appt.startTime}`}
                      className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all space-y-3 text-xs shadow-2xs"
                    >
                      {/* Top Bar: Doctor Details & Status Badge */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc]">
                            <Stethoscope className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                Dr. {appt.doctor?.fullName || 'Clinic Physician'}
                              </span>
                              {appt.doctorId === currentAppointment?.doctorId && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {appt.doctor?.specialization || 'Consultant Physician'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              appt.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : appt.status === 'CONFIRMED'
                                ? 'bg-blue-50 text-[#0066cc] border border-blue-200'
                                : appt.status === 'IN_CONSULTATION'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : appt.status === 'CANCELLED'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {appt.status}
                          </span>
                        </div>
                      </div>

                      {/* Second Row: Date, Time & Token Details */}
                      <div className="flex items-center gap-3 text-slate-600 flex-wrap text-[11px]">
                        <span className="flex items-center gap-1 font-semibold text-slate-900">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(appt.date)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {formatTime(appt.startTime)} {appt.endTime ? `– ${formatTime(appt.endTime)}` : ''}
                        </span>
                        {appt.tokenNumber && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              Token #{appt.tokenNumber}
                            </span>
                          </>
                        )}
                        {appt.paymentStatus && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] font-medium text-slate-400">
                              Payment: {appt.paymentStatus}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Reason for Visit */}
                      {(appt.reasonForVisit || appt.reason) && (
                        <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Reason for Visit
                          </span>
                          <p className="text-slate-800 font-medium text-[11px]">
                            {appt.reasonForVisit || appt.reason}
                          </p>
                        </div>
                      )}

                      {/* Clinical Notes recorded by doctor */}
                      {appt.clinicalNotes && (
                        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-slate-800 space-y-1">
                          <span className="text-[10px] font-bold text-[#0066cc] uppercase tracking-wider block flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Clinical Notes &amp; Advice
                          </span>
                          <p className="whitespace-pre-line text-[11px] font-medium leading-relaxed">
                            {appt.clinicalNotes}
                          </p>
                        </div>
                      )}

                      {/* Prescription Action Button */}
                      {appt.hasPrescription && (
                        <div className="pt-1 flex items-center justify-between border-t border-slate-100">
                          <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Prescription Issued on File
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loadingRxId === appt.id}
                            onClick={() => handleViewPrescription(appt)}
                            className="h-7 text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 rounded-lg gap-1.5"
                          >
                            {loadingRxId === appt.id ? (
                              <Loader2 className="h-3 w-3 animate-spin text-emerald-700" />
                            ) : (
                              <FileText className="h-3 w-3 text-emerald-700" />
                            )}
                            <span>View Prescription (Rx)</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Pagination Controls */}
                  {totalVisitPages > 1 && (
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                      <span className="text-xs text-slate-500 font-medium">
                        Showing {(visitPage - 1) * VISITS_PER_PAGE + 1} to{' '}
                        {Math.min(visitPage * VISITS_PER_PAGE, appointments.length)} of {appointments.length} consultations
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={visitPage <= 1}
                          onClick={() => setVisitPage((p) => Math.max(1, p - 1))}
                          className="h-8 px-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                        >
                          <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                          <span>Previous</span>
                        </Button>

                        {Array.from({ length: totalVisitPages }).map((_, idx) => {
                          const p = idx + 1;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setVisitPage(p)}
                              className={`h-8 w-8 rounded-xl text-xs font-bold transition-all ${
                                visitPage === p
                                  ? 'bg-[#0066cc] text-white shadow-xs'
                                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={visitPage >= totalVisitPages}
                          onClick={() => setVisitPage((p) => Math.min(totalVisitPages, p + 1))}
                          className="h-8 px-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                        >
                          <span>Next</span>
                          <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLINICAL NOTES TIMELINE */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {notes.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No Doctor Notes Found</p>
                  <p className="text-[11px] text-slate-400">
                    Doctor consultation notes will appear here across all completed appointments.
                  </p>
                </div>
              ) : (
                notes.map((n: any, idx: number) => (
                  <div
                    key={n.appointmentId || idx}
                    className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">
                          Visit on {formatDate(n.date)}
                        </span>
                        {n.doctor?.fullName && (
                          <span className="text-[11px] text-[#0066cc] bg-blue-50 px-2 py-0.5 rounded-full font-semibold border border-blue-100">
                            Dr. {n.doctor.fullName}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                        {n.status || 'Completed'}
                      </span>
                    </div>

                    {n.reasonForVisit && (
                      <p className="text-[11px] text-slate-500 italic">
                        Reason: {n.reasonForVisit}
                      </p>
                    )}

                    <p className="text-slate-800 whitespace-pre-line text-xs font-medium leading-relaxed bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                      {n.notes}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: MEDICAL UPDATE HISTORY (AUDIT TRAIL) */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#0066cc]">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Medical Record Audit History ({historyLogs.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Detailed record of previous modifications to allergies, chronic conditions &amp; medications.
                    </p>
                  </div>
                </div>

                {/* Filter Pills */}
                {historyLogs.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'allergies', label: 'Allergies' },
                      { id: 'medicalHistory', label: 'Conditions' },
                      { id: 'currentMedication', label: 'Medications' },
                      { id: 'bloodGroup', label: 'Blood Group' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAuditFilter(tab.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          auditFilter === tab.id
                            ? 'bg-[#0066cc] text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {historyLogs.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <History className="h-9 w-9 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No Previous Updates Recorded</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
                    Whenever you or the patient update medical information (allergies, chronic conditions, regular medications), a timestamped audit trail will be logged here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyLogs
                    .filter((log: any) => auditFilter === 'all' || log.fieldName === auditFilter)
                    .map((log: any) => {
                      const isDoctor = log.changedByRole === 'DOCTOR';
                      const isPatient = log.changedByRole === 'PATIENT';
                      return (
                        <div
                          key={log.id}
                          className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2.5 shadow-2xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                  isDoctor
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : isPatient
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {isDoctor ? 'Doctor Update' : isPatient ? 'Patient Update' : 'Admin Update'}
                              </span>

                              <span className="text-xs font-bold text-slate-900">
                                {log.changedByName || (isDoctor ? 'Doctor' : 'Patient')}
                              </span>

                              <span className="text-[10px] font-semibold text-[#0066cc] bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-100">
                                {log.fieldLabel || log.fieldName}
                              </span>
                            </div>

                            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                              <Clock className="h-3 w-3" />
                              {formatDate(log.createdAt)} • {formatTime(log.createdAt)}
                            </span>
                          </div>

                          {/* Diff Comparison Visual */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            {/* Old Value */}
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                Previous Value
                              </span>
                              <p className="text-slate-600 line-through text-[11px] whitespace-pre-line font-medium">
                                {log.oldValue?.trim() || 'None / Not specified'}
                              </p>
                            </div>

                            {/* New Value */}
                            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Updated Value
                              </span>
                              <p className="text-emerald-950 font-bold text-[11px] whitespace-pre-line">
                                {log.newValue?.trim() || 'Cleared / None'}
                              </p>
                            </div>
                          </div>

                          {log.changeReason && (
                            <p className="text-[10px] text-slate-400 italic">
                              Context: {log.changeReason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            CareUp Clinical Records • Encrypted & Secure
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs h-auto"
          >
            Close
          </Button>
        </div>
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
