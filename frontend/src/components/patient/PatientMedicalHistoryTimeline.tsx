'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  User,
  Stethoscope,
  Filter,
} from 'lucide-react';
import { clientAxios } from '@/lib/api/axios';
import { formatDate, formatTime } from '@/lib/utils';
import { PatientMedicalHistoryLog } from '@/types';
import { Button } from '@/components/ui/button';

interface PatientMedicalHistoryTimelineProps {
  initialLogs?: PatientMedicalHistoryLog[];
}

export function PatientMedicalHistoryTimeline({
  initialLogs = [],
}: PatientMedicalHistoryTimelineProps) {
  const [logs, setLogs] = useState<PatientMedicalHistoryLog[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [hasFetched, setHasFetched] = useState(initialLogs.length > 0);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await clientAxios.get<{
        success: boolean;
        count: number;
        data: PatientMedicalHistoryLog[];
      }>('/api/patient/medical-history-logs');
      if (res.data?.data && Array.isArray(res.data.data)) {
        setLogs(res.data.data);
      }
    } catch (err) {
      console.warn('Could not load patient medical history logs:', err);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  };

  useEffect(() => {
    if (!hasFetched) {
      fetchLogs();
    }
  }, [hasFetched]);

  const filteredLogs = logs.filter(
    (log) => filter === 'all' || log.fieldName === filter,
  );

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header Strip */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0066cc] shrink-0">
            <History className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Medical Record Update History
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {logs.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium line-clamp-1">
              Verified clinical audit log of health record modifications
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="h-7 px-2.5 rounded-lg text-[11px] font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin text-[#0066cc]' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filter Chips */}
      {logs.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
          <span className="text-slate-400 font-medium flex items-center gap-1 text-[11px] mr-1">
            <Filter className="h-3 w-3" />
            Filter:
          </span>
          {[
            { id: 'all', label: 'All' },
            { id: 'allergies', label: 'Allergies' },
            { id: 'medicalHistory', label: 'Conditions' },
            { id: 'currentMedication', label: 'Meds' },
            { id: 'bloodGroup', label: 'Blood' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                filter === tab.id
                  ? 'bg-[#0066cc] text-white shadow-2xs'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Timeline Content */}
      {loading && logs.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <div className="animate-spin h-6 w-6 border-2 border-[#0066cc] border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-600">Loading audit history…</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <ShieldCheck className="h-8 w-8 mx-auto text-slate-300 mb-2" />
          <h4 className="text-xs font-bold text-slate-800">
            {logs.length === 0 ? 'No Update History on File' : 'No matching updates found'}
          </h4>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
            {logs.length === 0
              ? 'When doctors update your clinical notes, or when changes are saved, every revision is preserved in this chronological log.'
              : 'Try selecting a different filter category.'}
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-100 pl-4 sm:pl-6 space-y-6 ml-2 sm:ml-3">
          {filteredLogs.map((log) => {
            const isDoctor = log.changedByRole === 'DOCTOR';
            const isPatient = log.changedByRole === 'PATIENT';

            return (
              <div key={log.id} className="relative group">
                {/* Timeline Dot */}
                <div
                  className={`absolute -left-[25px] sm:-left-[33px] top-1.5 h-4 w-4 rounded-full border-2 border-white shadow-xs ${
                    isDoctor ? 'bg-[#0066cc]' : isPatient ? 'bg-purple-600' : 'bg-amber-500'
                  }`}
                />

                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 hover:border-slate-300 transition-all shadow-2xs space-y-3">
                  {/* Card Header */}
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
                        {isDoctor ? (
                          <>
                            <Stethoscope className="h-3 w-3" />
                            <span>Doctor Update</span>
                          </>
                        ) : isPatient ? (
                          <>
                            <User className="h-3 w-3" />
                            <span>Self-Update</span>
                          </>
                        ) : (
                          <span>Admin Update</span>
                        )}
                      </span>

                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        {log.changedByName}
                      </span>

                      <span className="text-[10px] font-semibold text-[#0066cc] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        {log.fieldLabel || log.fieldName}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="h-3 w-3" />
                      {formatDate(log.createdAt)} • {formatTime(log.createdAt)}
                    </span>
                  </div>

                  {/* Diff Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Old Value */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Previous Entry
                      </span>
                      <p className="text-slate-600 line-through text-[11px] whitespace-pre-line font-medium">
                        {log.oldValue?.trim() || 'None / Not Specified'}
                      </p>
                    </div>

                    {/* New Value */}
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Updated To
                      </span>
                      <p className="text-emerald-950 font-bold text-[11px] whitespace-pre-line">
                        {log.newValue?.trim() || 'Cleared / None'}
                      </p>
                    </div>
                  </div>

                  {log.changeReason && (
                    <p className="text-[11px] text-slate-500 italic pt-0.5">
                      Context: {log.changeReason}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
