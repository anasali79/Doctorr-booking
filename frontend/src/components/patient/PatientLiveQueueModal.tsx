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
  CheckCircle2,
  AlertCircle,
  MapPin,
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
    endTime?: string;
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
    endTime?: string;
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
    } catch (err: unknown) {
      if (!isSilent) {
        setError('Failed to fetch live queue data. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchQueue(false);

    // Auto poll every 3s as fallback to Socket.io for immediate live updates
    const timer = setInterval(() => {
      fetchQueue(true);
    }, 3000);

    const handleQueueUpdate = () => {
      fetchQueue(true);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('appointment_queue_update', handleQueueUpdate);
    }

    return () => {
      clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('appointment_queue_update', handleQueueUpdate);
      }
    };
  }, [isOpen, fetchQueue]);

  if (!isOpen) return null;

  const doctor = data?.doctor;
  const appt = data?.appointment;
  const summary = data?.queueSummary;
  const timeline = data?.timeline || [];

  const youInTimeline = timeline.find((t) => t.isYou);
  const myToken = appt?.tokenNumber ?? youInTimeline?.tokenNumber;
  const servingInTimeline = timeline.find((t) => t.status === 'IN_CONSULTATION');
  const currentToken = summary?.currentServingToken ?? servingInTimeline?.tokenNumber;

  const isMyTurn = summary?.isMyTurn ?? (currentToken != null && myToken != null && currentToken === myToken);
  const peopleAhead = summary?.peopleAhead ?? 0;

  // Use the timeline directly from backend with exact slot start and end times
  const displayTimeline = timeline;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white text-zinc-900 rounded-3xl border border-black/[0.08] backdrop-blur-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0066cc] text-white flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Live Clinic Queue</h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#e8f2fe] text-[#0066cc]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {doctor ? `Dr. ${doctor.fullName} (${doctor.specialization})` : 'Connecting...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchQueue(false)}
              disabled={refreshing}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#0066cc]' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-black animate-spin mx-auto" />
              <p className="text-sm font-semibold text-zinc-900">Connecting to doctor&apos;s live queue...</p>
              <p className="text-xs text-zinc-400">Fetching real-time token sequence</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-bold text-zinc-950">Unable to load live queue</p>
              <p className="text-xs text-rose-600">{error}</p>
              <button
                onClick={() => fetchQueue(false)}
                className="btn-primary mt-3 text-xs"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Turn Announcement Banner */}
              {isMyTurn ? (
                <div className="p-4 rounded-2xl border border-[#0066cc] bg-[#0066cc] text-white flex items-center gap-3 shadow-md">
                  <div className="w-10 h-10 rounded-xl bg-white text-[#0066cc] flex items-center justify-center flex-shrink-0 animate-bounce">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">It&apos;s Your Turn Now!</h4>
                    <p className="text-xs text-blue-100 mt-0.5">
                      Your token is currently being called. Please enter Room {doctor?.roomNumber || '1'}.
                    </p>
                  </div>
                </div>
              ) : peopleAhead === 0 && appt?.status === 'CHECKED_IN' ? (
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0066cc] text-white flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">You Are Next In Line!</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Please wait outside Room {doctor?.roomNumber || '1'}. Your token will be called in moments.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Spotlight Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Now Serving */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Now Serving
                  </span>
                  <div className="text-3xl font-black text-slate-900 tabular-nums mt-1">
                    {currentToken ? `#${String(currentToken).padStart(2, '0')}` : '—'}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium block mt-0.5">In Cabin</span>
                </div>

                {/* Your Token */}
                <div className="rounded-2xl border border-[#0066cc] bg-[#0066cc] p-4 text-center text-white shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-100 block">
                    Your Token
                  </span>
                  <div className="text-3xl font-black text-white tabular-nums mt-1">
                    {myToken ? `#${String(myToken).padStart(2, '0')}` : '—'}
                  </div>
                  <span className="text-[11px] text-blue-100 font-semibold block mt-0.5">Your Number</span>
                </div>

                {/* Patients Ahead */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-center">
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
                <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                    Est. Wait
                  </span>
                  <div className="text-3xl font-black text-zinc-950 tabular-nums mt-1">
                    {isMyTurn ? '0' : summary?.estimatedWaitMinutes ?? 0}
                    <span className="text-sm font-semibold text-zinc-500 ml-0.5">m</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-medium block mt-0.5">Approx time</span>
                </div>
              </div>

              {/* Clinic & Room Details */}
              <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-black flex-shrink-0" />
                  <span>
                    <strong className="text-zinc-950">Clinic Room:</strong> Room {doctor?.roomNumber || '1'} •{' '}
                    {doctor?.clinicAddress || 'Hospital Main Wing'}
                  </span>
                </div>
                <div className="text-zinc-500 font-medium">
                  Date: {formatDate(appt?.date || '')} • Scheduled: {formatTime(appt?.startTime || '')}
                  {appt?.endTime ? ` – ${formatTime(appt.endTime)}` : ''}
                </div>
              </div>

              {/* Sequence Timeline */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-zinc-600" />
                    <h4 className="text-sm font-bold text-zinc-950">Doctor&apos;s Token Sequence</h4>
                  </div>
                  <span className="text-xs text-zinc-400">Dr. {doctor?.fullName}</span>
                </div>

                {displayTimeline.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-4">No other tokens in queue today.</p>
                ) : (
                  <div className="space-y-2">
                    {displayTimeline.map((item) => {
                      const isCurrent = item.status === 'IN_CONSULTATION';
                      const isCompleted = item.status === 'COMPLETED';
                      const isYou = item.isYou;

                      return (
                        <div
                          key={item.tokenNumber}
                          className={`rounded-2xl border p-3 flex items-center justify-between gap-3 transition-all ${
                            isYou
                              ? 'border-2 border-[#0066cc] bg-blue-50/70 shadow-xs'
                              : isCurrent
                              ? 'border border-blue-200 bg-blue-50/40'
                              : isCompleted
                              ? 'border-slate-200 bg-slate-50/60 opacity-60'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                                isYou
                                  ? 'bg-[#0066cc] text-white font-black'
                                  : isCurrent
                                  ? 'bg-[#0066cc] text-white'
                                  : isCompleted
                                  ? 'bg-slate-200 text-slate-600'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              #{String(item.tokenNumber).padStart(2, '0')}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs font-bold ${
                                    isYou ? 'text-[#0066cc]' : 'text-slate-900'
                                  }`}
                                >
                                  {isYou ? 'YOU (Your Appointment)' : `Patient Token #${String(item.tokenNumber).padStart(2, '0')}`}
                                </span>
                                {isYou && isMyTurn && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0066cc] text-white">
                                    Your Turn
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] block mt-0.5 text-slate-500 font-medium">
                                Slot: {formatTime(item.startTime)}
                                {item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#0066cc] text-white">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Inside Now
                              </span>
                            )}
                            {isCompleted && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                                Completed
                              </span>
                            )}
                            {!isCurrent && !isCompleted && (
                              <span className={`text-[11px] font-medium ${isYou ? 'text-[#0066cc]' : 'text-slate-500'}`}>
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
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-black/[0.06] flex items-center justify-between text-xs text-zinc-500">
          <span>Auto-updates in real time</span>
          <button
            onClick={onClose}
            className="btn-secondary !py-1.5 !px-4 text-xs"
          >
            Close Board
          </button>
        </div>
      </div>
    </div>
  );
}
