'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Users,
  Search,
  Filter,
  Phone,
  Calendar,
  FileText,
  ShieldAlert,
  Droplets,
  Clock,
  ArrowRight,
  Eye,
  RefreshCw,
  UserCheck,
  Heart,
  ChevronRight,
  Pill,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { clientAxios } from '@/lib/api/axios';
import { PatientProfileModal } from './PatientProfileModal';
import { toast } from 'sonner';

interface PatientRecordItem {
  patient: {
    id: string;
    fullName: string;
    age: number;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    phone: string;
    address?: string;
    bloodGroup?: string;
    allergies?: string;
    medicalHistory?: string;
    currentMedication?: string;
    basicHealthInfo?: string;
  };
  totalVisits: number;
  lastVisitDate: string | null;
  lastAppointmentId?: string;
  nextAppointment?: {
    date: string;
    startTime: string;
    status: string;
  } | null;
  clinicalNotesHistory?: Array<{
    appointmentId: string;
    date: string;
    notes: string;
  }>;
}

interface DoctorPatientsClientProps {
  initialPatients: PatientRecordItem[];
}

export function DoctorPatientsClient({ initialPatients }: DoctorPatientsClientProps) {
  const searchParams = useSearchParams();
  const deepLinkPatientId = searchParams.get('patientId');

  const [patients, setPatients] = useState<PatientRecordItem[]>(initialPatients || []);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'allergies' | 'returning' | 'recent'>('all');

  // Modal state
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(deepLinkPatientId || null);
  const [modalOpen, setModalOpen] = useState<boolean>(Boolean(deepLinkPatientId));

  const fetchPatients = async (query = '') => {
    setLoading(true);
    try {
      const res = await clientAxios.get<{ success: boolean; data: PatientRecordItem[] }>(
        '/api/doctor/patients',
        { params: query ? { search: query } : undefined },
      );
      if (res.data?.data) {
        setPatients(res.data.data);
      }
    } catch {
      toast.error('Failed to load patient records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (deepLinkPatientId) {
      setSelectedPatientId(deepLinkPatientId);
      setModalOpen(true);
    }
  }, [deepLinkPatientId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPatients(search.trim());
  };

  const handleOpenPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    setModalOpen(true);
  };

  // Filter in memory for immediate UI responsiveness
  const filteredPatients = useMemo(() => {
    let result = [...patients];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.patient.fullName.toLowerCase().includes(q) ||
          p.patient.phone.includes(q) ||
          (p.patient.allergies && p.patient.allergies.toLowerCase().includes(q)) ||
          (p.patient.bloodGroup && p.patient.bloodGroup.toLowerCase().includes(q)) ||
          (p.patient.medicalHistory && p.patient.medicalHistory.toLowerCase().includes(q)),
      );
    }

    if (filterType === 'allergies') {
      result = result.filter((p) => Boolean(p.patient.allergies && p.patient.allergies.trim()));
    } else if (filterType === 'returning') {
      result = result.filter((p) => p.totalVisits > 1);
    } else if (filterType === 'recent') {
      result = result.filter((p) => Boolean(p.lastVisitDate));
    }

    return result;
  }, [patients, search, filterType]);

  const stats = useMemo(() => {
    const total = patients.length;
    const returning = patients.filter((p) => p.totalVisits > 1).length;
    const withAllergies = patients.filter((p) => Boolean(p.patient.allergies && p.patient.allergies.trim())).length;
    return { total, returning, withAllergies };
  }, [patients]);

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-[#0066cc] mb-2">
            <Users className="h-3.5 w-3.5" />
            <span>PATIENT MANAGEMENT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Patients Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Access complete medical records, historical clinical notes, and previous visits for your patients.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => fetchPatients(search.trim())}
          disabled={loading}
          className="rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 h-9 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin text-[#0066cc]' : ''}`} />
          <span>Refresh Directory</span>
        </Button>
      </div>

      {/* ── Quick Stats Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Patients
            </span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">{stats.total}</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-blue-50 text-[#0066cc] flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Returning Patients
            </span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">{stats.returning}</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Allergy Alerts on File
            </span>
            <span className="text-2xl font-extrabold text-rose-600 mt-0.5 block">{stats.withAllergies}</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient name, phone, allergy, blood group..."
            className="pl-10 text-xs field-input bg-slate-50/60 focus:bg-white"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={filterType} onValueChange={(val: any) => setFilterType(val)}>
            <SelectTrigger className="text-xs h-9 w-full sm:w-48 bg-slate-50/60 border border-slate-200">
              <SelectValue placeholder="Filter patients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Patients</SelectItem>
              <SelectItem value="returning">Returning Patients (2+ visits)</SelectItem>
              <SelectItem value="allergies">Patients with Allergies</SelectItem>
              <SelectItem value="recent">Recently Visited</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Patients Table / List ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {filteredPatients.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Users className="h-10 w-10 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No Patient Records Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search.trim()
                ? `No patients matched your search for "${search}". Try adjusting your keywords.`
                : 'Patients who book consultations with you will automatically appear here with their complete medical history.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Patient</th>
                  <th className="py-3.5 px-4">Demographics</th>
                  <th className="py-3.5 px-4">Medical Parameters</th>
                  <th className="py-3.5 px-4">Visits with You</th>
                  <th className="py-3.5 px-4">Latest Notes</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map((item) => {
                  const p = item.patient;
                  const latestNote = item.clinicalNotesHistory?.[0];

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => handleOpenPatient(p.id)}
                    >
                      {/* Patient Avatar & Name */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-2xl bg-blue-50 text-[#0066cc] font-bold flex items-center justify-center shrink-0 border border-blue-100 text-xs">
                            {p.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block group-hover:text-[#0066cc] transition-colors">
                              {p.fullName}
                            </span>
                            <span className="text-slate-400 text-[11px] block mt-0.5 flex items-center gap-1">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {p.phone}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Demographics */}
                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-700 block">
                          {p.age} yrs • {p.gender === 'FEMALE' ? 'Female' : 'Male'}
                        </span>
                        {p.address && (
                          <span className="text-slate-400 text-[11px] block truncate max-w-[140px] mt-0.5">
                            {p.address}
                          </span>
                        )}
                      </td>

                      {/* Medical Parameters */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p.bloodGroup && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-0.5">
                                <Droplets className="h-2.5 w-2.5" />
                                {p.bloodGroup}
                              </span>
                            )}
                            {p.allergies?.trim() ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-0.5">
                                <ShieldAlert className="h-2.5 w-2.5" />
                                Allergy Alert
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">No allergies</span>
                            )}
                          </div>
                          {p.currentMedication?.trim() && (
                            <span className="text-[11px] text-slate-500 block truncate max-w-[160px]">
                              Med: {p.currentMedication}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Visits & Last Visit */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-900 block">
                          {item.totalVisits} visit{item.totalVisits > 1 ? 's' : ''}
                        </span>
                        <span className="text-slate-400 text-[11px] block mt-0.5">
                          Last: {item.lastVisitDate ? formatDate(item.lastVisitDate) : 'Today'}
                        </span>
                      </td>

                      {/* Latest Clinical Note Preview */}
                      <td className="py-4 px-4 max-w-[180px]">
                        {latestNote ? (
                          <p className="text-slate-600 text-[11px] line-clamp-2 italic">
                            &ldquo;{latestNote.notes}&rdquo;
                          </p>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No notes recorded yet</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPatient(p.id);
                          }}
                          className="h-8 px-3 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:text-[#0066cc] text-xs font-semibold"
                        >
                          <span>View Record</span>
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Patient Profile Modal ── */}
      {selectedPatientId && (
        <PatientProfileModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedPatientId(null);
          }}
          patientId={selectedPatientId}
          onRecordUpdated={() => fetchPatients(search.trim())}
        />
      )}
    </div>
  );
}
