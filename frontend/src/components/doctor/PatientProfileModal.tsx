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
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'history'>('overview');
  const [isEditingMedical, setIsEditingMedical] = useState(false);
  const [savingMedical, setSavingMedical] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [newNoteInput, setNewNoteInput] = useState('');

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
  const notes = data?.allClinicalNotes || [];
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
      // Update local state
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-[#0066cc]" />
                  <span>Clinical Health Parameters</span>
                </h3>
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

          {/* TAB 2: PREVIOUS VISITS LIST */}
          {activeTab === 'visits' && (
            <div className="space-y-3">
              {appointments.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <History className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No Previous Visits Recorded</p>
                  <p className="text-[11px] text-slate-400">
                    This is the patient&apos;s first recorded visit with you.
                  </p>
                </div>
              ) : (
                appointments.map((appt: any) => (
                  <div
                    key={appt.id || appt.date}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {formatDate(appt.date)}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {formatTime(appt.startTime)} {appt.endTime ? `– ${formatTime(appt.endTime)}` : ''}
                        </span>
                        {appt.tokenNumber && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            Token #{appt.tokenNumber}
                          </span>
                        )}
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          appt.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : appt.status === 'CONFIRMED'
                            ? 'bg-blue-50 text-[#0066cc] border border-blue-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>

                    {(appt.reasonForVisit || appt.reason) && (
                      <div>
                        <span className="text-[11px] text-slate-400 block">Reason for Visit:</span>
                        <p className="text-slate-800 font-medium">
                          {appt.reasonForVisit || appt.reason}
                        </p>
                      </div>
                    )}

                    {appt.clinicalNotes && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Doctor Consultation Notes
                        </span>
                        <p className="whitespace-pre-line text-[11px]">{appt.clinicalNotes}</p>
                      </div>
                    )}
                  </div>
                ))
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
                    className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-900">
                        Visit on {formatDate(n.date)}
                      </span>
                      <span className="text-[10px] text-slate-400">{n.status || 'Completed'}</span>
                    </div>
                    <p className="text-slate-800 whitespace-pre-line text-xs font-medium">
                      {n.notes}
                    </p>
                  </div>
                ))
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
    </div>
  );
}
