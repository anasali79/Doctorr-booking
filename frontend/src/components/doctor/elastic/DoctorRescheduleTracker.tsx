'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatTime, formatDate, formatDateTime } from '@/lib/utils';
import {
  elasticSchedulingApi,
  RescheduleRequestRecord,
} from '@/lib/api/elastic-scheduling';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/lib/api/axios';
import {
  RefreshCw,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  UserCheck,
  ArrowRight,
  Filter,
} from 'lucide-react';

export function DoctorRescheduleTracker() {
  const [requests, setRequests] = useState<RescheduleRequestRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'>('ALL');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await elasticSchedulingApi.getDoctorRescheduleRequests();
      setRequests(data);
    } catch (err: unknown) {
      toast.error('Failed to load reschedule requests', {
        description: extractErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filtered = requests.filter((r) => {
    if (filter === 'ALL') return true;
    return r.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="outline" className="bg-amber-100/90 text-amber-950 border-amber-300 font-bold text-[10px] shadow-2xs">
            <Clock className="w-3 h-3 mr-1 text-amber-600 animate-pulse" />
            Awaiting Patient
          </Badge>
        );
      case 'ACCEPTED':
        return (
          <Badge className="bg-emerald-600 text-white font-bold text-[10px] shadow-2xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Accepted
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="outline" className="bg-rose-100/90 text-rose-950 border-rose-300 font-bold text-[10px] shadow-2xs">
            <XCircle className="w-3 h-3 mr-1 text-rose-600" />
            Declined
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 font-bold text-[10px] shadow-2xs">
            Expired (Hold Released)
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 font-bold text-[10px] shadow-2xs">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="border border-slate-200 shadow-xs bg-white p-5 rounded-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Rescheduling Tracker & Audit Trail
          </h3>
          <p className="text-xs text-slate-500">
            Monitor real-time patient confirmation for automated and manual reschedule proposals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            {(['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  filter === s
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            disabled={loading}
            className="h-7 px-2.5 text-xs text-slate-600 hover:text-slate-900"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">
          Loading reschedule tracker...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-lg mt-4 border border-dashed border-slate-200">
          No reschedule requests found under this filter.
        </div>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3 font-semibold">Patient</th>
                <th className="py-2.5 px-3 font-semibold">Original Slot</th>
                <th className="py-2.5 px-3 font-semibold">Proposed Slot</th>
                <th className="py-2.5 px-3 font-semibold">Method</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Hold Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-900 block">
                      {r.patient?.fullName || 'Patient'}
                    </span>
                    {r.patient?.phone && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {r.patient.phone}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600">
                    <span className="line-through text-slate-400 block text-[11px]">
                      {formatDate(r.originalDate)}
                    </span>
                    <span>{formatTime(r.originalStartTime)} – {formatTime(r.originalEndTime)}</span>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <span className="font-semibold text-blue-700 block text-[11px]">
                      {formatDate(r.proposedDate)}
                    </span>
                    <span className="text-slate-900">
                      {formatTime(r.proposedStartTime)} – {formatTime(r.proposedEndTime)}
                      {r.proposedTokenNumber && (
                        <span className="ml-1 text-[10px] text-slate-500 font-sans font-bold">
                          (T#{r.proposedTokenNumber})
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-600">
                      {r.rescheduleMethod}
                    </Badge>
                  </td>
                  <td className="py-3 px-3">
                    {getStatusBadge(r.status)}
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                    {r.status === 'PENDING' ? (
                      formatDateTime(r.expiresAt)
                    ) : r.patientRespondedAt ? (
                      `Responded: ${formatDateTime(r.patientRespondedAt)}`
                    ) : (
                      'N/A'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

