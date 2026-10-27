'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { clientAxios } from '@/lib/api/axios';
import { formatTime, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  X,
  RefreshCw,
  Activity,
  Stethoscope,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Users,
} from 'lucide-react';

interface PatientLiveQueueData {
  doctor: {
    id: string;
    fullName: string;
    specialization: string;
    clinicAddress?: string;
    roomNumber?: string;
    consultationDuration?: number;
  };
  appointment: {
    id: string;
    tokenNumber?: number;
    date: string;
    startTime: string;
    status: string;
    queuePosition?: number;
  };
  queueSummary: {
    currentServingToken: number | null;
    currentServingTime?: string | null;
    totalWaiting: number;
    peopleAhead: number;
    estimatedWaitMinutes: number;
    isMyTurn: boolean;
  };
  timeline: {
    tokenNumber: number;
    startTime: string;
    status: string;
    isYou: boolean;
  }[];
}

interface PatientLiveQueueModalProps {
  appointmentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PatientLiveQueueModal({
  appointmentId,
  isOpen,
  onClose,
}: PatientLiveQueueModalProps) {
  const [data, setData] = useState<PatientLiveQueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async (isSilent = false) => {
    if (!appointmentId) return;
    if (!isSilent) setRefreshing(true);
    try {
      const res = await clientAxios.get(`/api/appointment/${appointmentId}/live-queue`);
      const payload = res.data?.data || res.data;
      if (payload) {
        setData(payload);
        setError(null);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load live queue';
      setError(msg);
      if (!isSilent) toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchQueue(false);

      // Auto-poll every 12 seconds while modal is open
      const interval = setInterval(() => {
        fetchQueue(true);
      }, 12000);

      return () => clearInterval(interval);
    }
  }, [isOpen, fetchQueue]);

  if (!isOpen) return null;

  const summary = data?.queueSummary;
  const doctor = data?.doctor;
  const appt = data?.appointment;
  const timeline = data?.timeline || [];

  const myToken = appt?.tokenNumber;
  const currentToken = summary?.currentServingToken;
  const peopleAhead = summary?.peopleAhead ?? 0;
  const isMyTurn = summary?.isMyTurn || appt?.status === 'IN_CONSULTATION';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-700 text-white flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5 text-blue-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Live Clinic Queue</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                  Live Board
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {doctor ? `Dr. ${doctor.fullName} (${doctor.specialization})` : 'Loading clinic details...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchQueue(false)}
              disabled={refreshing}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 transition-all"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-700' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Connecting to doctor's live queue...</p>
              <p className="text-xs text-slate-400">Fetching real-time token sequence</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-bold text-rose-800">Unable to load live queue</p>
              <p className="text-xs text-rose-600">{error}</p>
              <button
                onClick={() => fetchQueue(false)}
                className="mt-3 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-all"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Turn Announcement Banner */}
              {isMyTurn ? (
                <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-500 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 animate-bounce">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">It's Your Turn Now!</h4>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Your token is currently being called. Please enter Room {doctor?.roomNumber || '1'}.
                    </p>
                  </div>
                </div>
              ) : peopleAhead === 0 && appt?.status === 'CHECKED_IN' ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">You Are Next In Line!</h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Please wait directly outside Room {doctor?.roomNumber || '1'}. Your token will be called shortly.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Spotlight Cards (Now Serving vs Your Token) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Now Serving */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                    Now Serving
                  </span>
                  <div className="text-3xl font-black text-blue-900 tabular-nums mt-1">
                    {currentToken ? `#${currentToken}` : '—'}
                  </div>
                  <span className="text-[11px] text-blue-600 font-medium block mt-0.5">Inside with Doctor</span>
                </div>

                {/* Your Token */}
                <div className="rounded-2xl border-2 border-slate-900 bg-slate-900 p-4 text-center text-white shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block">
                    Your Token
                  </span>
                  <div className="text-3xl font-black text-amber-400 tabular-nums mt-1">
                    {myToken ? `#${myToken}` : '—'}
                  </div>
                  <span className="text-[11px] text-slate-300 font-medium block mt-0.5">Your Number</span>
                </div>

                {/* Patients Ahead */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Ahead of You
                  </span>
                  <div className="text-3xl font-black text-slate-900 tabular-nums mt-1">
                    {isMyTurn ? '0' : peopleAhead}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                    {peopleAhead === 0 ? 'No wait ahead' : `${peopleAhead} patient(s)`}
                  </span>
                </div>

                {/* Est Wait */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Est. Wait
                  </span>
                  <div className="text-3xl font-black text-slate-900 tabular-nums mt-1">
                    {isMyTurn ? '0' : summary?.estimatedWaitMinutes ?? 0}
                    <span className="text-sm font-semibold text-slate-500 ml-0.5">m</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium block mt-0.5">Approximate time</span>
                </div>
              </div>

              {/* Clinic & Room Details */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-700 flex-shrink-0" />
                  <span>
                    <strong className="text-slate-800">Clinic Room:</strong> Room {doctor?.roomNumber || '1'} •{' '}
                    {doctor?.clinicAddress || 'Hospital Main Wing'}
                  </span>
                </div>
                <div className="text-slate-500 font-medium">
                  Date: {formatDate(appt?.date || '')} • Scheduled: {formatTime(appt?.startTime || '')}
                </div>
              </div>

              {/* Sequence Timeline (Who is before you / who is inside) */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-600" />
                    <h4 className="text-sm font-bold text-slate-900">Doctor's Token Sequence</h4>
                  </div>
                  <span className="text-xs text-slate-400">Strictly for Dr. {doctor?.fullName}</span>
                </div>

                {timeline.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No other tokens in queue today.</p>
                ) : (
                  <div className="space-y-2">
                    {timeline.map((item) => {
                      const isCurrent = item.status === 'IN_CONSULTATION';
                      const isCompleted = item.status === 'COMPLETED';
                      const isYou = item.isYou;

                      return (
                        <div
                          key={item.tokenNumber}
                          className={`rounded-2xl border p-3 flex items-center justify-between gap-3 transition-all ${
                            isYou
                              ? 'border-2 border-slate-900 bg-slate-900 text-white shadow-sm'
                              : isCurrent
                              ? 'border-2 border-blue-500 bg-blue-50/70'
                              : isCompleted
                              ? 'border-slate-100 bg-slate-50/60 opacity-60'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                                isYou
                                  ? 'bg-amber-400 text-slate-950 font-black'
                                  : isCurrent
                                  ? 'bg-blue-700 text-white'
                                  : isCompleted
                                  ? 'bg-slate-200 text-slate-500'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              #{item.tokenNumber}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs font-bold ${
                                    isYou ? 'text-white' : 'text-slate-900'
                                  }`}
                                >
                                  {isYou ? 'YOU (Your Appointment)' : `Patient Token #${item.tokenNumber}`}
                                </span>
                                {isYou && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                                    Your Turn
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[11px] block mt-0.5 ${
                                  isYou ? 'text-slate-300' : 'text-slate-500'
                                }`}
                              >
                                Slot: {formatTime(item.startTime)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                Inside Clinic Now
                              </span>
                            )}
                            {isCompleted && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                                Completed
                              </span>
                            )}
                            {!isCurrent && !isCompleted && (
                              <span
                                className={`text-[11px] font-medium ${
                                  isYou ? 'text-slate-300' : 'text-slate-500'
                                }`}
                              >
                                {item.status === 'CHECKED_IN' ? 'In Waiting Room' : 'Expected'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Auto-updates in real time</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl transition-all shadow-xs"
          >
            Close Board
          </button>
        </div>
      </div>
    </div>
  );
}
