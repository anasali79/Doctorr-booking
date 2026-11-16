'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
  CheckCircle2,
  XCircle,
  ArrowRight,
  Search,
  ChevronLeft,
  ChevronRight,
  Phone,
  Timer,
  CalendarClock,
  X,
} from 'lucide-react';

export function DoctorRescheduleTracker() {
  const [requests, setRequests] = useState<RescheduleRequestRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 8;

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await elasticSchedulingApi.getDoctorRescheduleRequests();
      setRequests(Array.isArray(data) ? data : []);
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

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  // Counts for filters
  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === 'PENDING').length,
      accepted: requests.filter((r) => r.status === 'ACCEPTED').length,
      rejected: requests.filter((r) => r.status === 'REJECTED').length,
      expired: requests.filter((r) => r.status === 'EXPIRED').length,
    };
  }, [requests]);

  // Filtered requests based on active tab and search query
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Status filter
      if (filter !== 'ALL' && r.status !== filter) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const patientName = (r.patient?.fullName || '').toLowerCase();
        const patientPhone = (r.patient?.phone || '').toLowerCase();
        const token = r.proposedTokenNumber ? String(r.proposedTokenNumber) : '';
        const origDate = (r.originalDate || '').toLowerCase();
        const propDate = (r.proposedDate || '').toLowerCase();

        const matches =
          patientName.includes(q) ||
          patientPhone.includes(q) ||
          token.includes(q) ||
          origDate.includes(q) ||
          propDate.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [requests, filter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedRequests = useMemo(() => {
    const start = (validPage - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, validPage, PAGE_SIZE]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <Clock className="w-3 h-3 text-amber-600" />
            Awaiting Patient
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Accepted & Booked
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200/80 shadow-2xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Declined by Patient
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
            <Timer className="w-3 h-3 text-slate-500" />
            Hold Expired
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const formatHoldOrResponse = (r: RescheduleRequestRecord) => {
    if (r.status === 'ACCEPTED' || r.status === 'REJECTED') {
      return (
        <div className="space-y-0.5">
          <span className="text-[11px] text-slate-400 block font-medium">Patient Responded</span>
          <span className="text-xs font-semibold text-slate-700">
            {r.patientRespondedAt ? formatDateTime(r.patientRespondedAt) : 'Recorded'}
          </span>
        </div>
      );
    }

    if (r.status === 'PENDING') {
      const diff = new Date(r.expiresAt).getTime() - Date.now();
      const isPast = diff <= 0;
      const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
      const mins = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));

      return (
        <div className="space-y-0.5">
          <span className="text-[11px] text-amber-700/80 block font-semibold flex items-center gap-1">
            <Timer className="w-3 h-3 text-amber-600" />
            {isPast ? 'Expired' : hours > 24 ? `Expires in ${Math.floor(hours / 24)}d ${hours % 24}h` : `Expires in ${hours}h ${mins}m`}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {formatDateTime(r.expiresAt)}
          </span>
        </div>
      );
    }

    return (
      <div className="space-y-0.5">
        <span className="text-[11px] text-slate-400 block font-medium">Hold Released</span>
        <span className="text-[11px] text-slate-500 font-mono">
          {formatDateTime(r.expiresAt)}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ─── Top Header Card matching reference design ─── */}
      <div className="bg-white rounded-3xl border border-slate-100/90 p-6 sm:p-7 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-[#0066cc] flex items-center justify-center border border-blue-100 shadow-xs shrink-0">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Reschedule Requests Tracker
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Real-time tracking of patient responses, temporary slot holds, and shift adjustments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchRequests}
              disabled={loading}
              className="h-9 px-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#0066cc] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Search & Status Filters Bar + Data Table ─── */}
      <div className="bg-white rounded-3xl border border-slate-100/90 p-5 sm:p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.04)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {(
              [
                { id: 'ALL', label: 'All', count: counts.all },
                { id: 'PENDING', label: 'Pending', count: counts.pending },
                { id: 'ACCEPTED', label: 'Accepted', count: counts.accepted },
                { id: 'REJECTED', label: 'Declined', count: counts.rejected },
                { id: 'EXPIRED', label: 'Expired', count: counts.expired },
              ] as const
            ).map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#0066cc] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      active ? 'bg-white/25 text-white' : 'bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient, phone, or date..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0066cc] focus:outline-none transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ─── Table Content ─── */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 text-[#0066cc] animate-spin" />
            <span className="font-semibold text-slate-600 mt-1">Loading reschedule tracker records…</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-500 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
            <CalendarClock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <span className="font-bold text-slate-700 text-sm block">No reschedule requests found</span>
            <p className="text-slate-400 text-xs mt-0.5 max-w-sm mx-auto">
              {searchQuery
                ? `No results matching "${searchQuery}". Try a different name or phone number.`
                : 'There are currently no reschedule requests recorded under this filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 font-bold">#</th>
                  <th className="py-3.5 px-4 font-bold">Patient</th>
                  <th className="py-3.5 px-4 font-bold">Original Slot</th>
                  <th className="py-3.5 px-2 text-center font-bold"></th>
                  <th className="py-3.5 px-4 font-bold">Proposed Slot</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold">Hold / Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedRequests.map((r, index) => {
                  const itemIndex = (validPage - 1) * PAGE_SIZE + index + 1;
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Index */}
                      <td className="py-4 px-4 font-bold text-slate-400 text-[11px]">
                        {itemIndex}
                      </td>

                      {/* Patient info */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-50 text-[#0066cc] font-black text-xs flex items-center justify-center shrink-0 border border-blue-100">
                            {r.patient?.fullName
                              ? r.patient.fullName.charAt(0).toUpperCase()
                              : 'P'}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block leading-snug">
                              {r.patient?.fullName || 'Patient'}
                            </span>
                            {r.patient?.phone && (
                              <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {r.patient.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Original Slot (Strikethrough / Red-tinted) */}
                      <td className="py-4 px-4">
                        <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-100 inline-block min-w-[140px]">
                          <span className="text-[11px] font-bold text-slate-400 line-through block">
                            {formatDate(r.originalDate)}
                          </span>
                          <span className="text-xs font-semibold text-slate-600 line-through mt-0.5 block">
                            {formatTime(r.originalStartTime)} – {formatTime(r.originalEndTime)}
                          </span>
                        </div>
                      </td>

                      {/* Transition Arrow */}
                      <td className="py-4 px-2 text-center">
                        <div className="w-6 h-6 rounded-full bg-blue-50 text-[#0066cc] flex items-center justify-center mx-auto border border-blue-100">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </td>

                      {/* Proposed Slot (Highlighted Blue) */}
                      <td className="py-4 px-4">
                        <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100/80 inline-block min-w-[155px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-extrabold text-[#0066cc] block">
                              {formatDate(r.proposedDate)}
                            </span>
                            {r.proposedTokenNumber && (
                              <span className="px-1.5 py-0.2 rounded-md bg-slate-900 text-white font-mono font-black text-[10px]">
                                #{String(r.proposedTokenNumber).padStart(2, '0')}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-extrabold text-slate-900 block mt-0.5">
                            {formatTime(r.proposedStartTime)} – {formatTime(r.proposedEndTime)}
                          </span>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded inline-block mt-1">
                            {r.proposedSchedulingType || 'WAVE'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {getStatusBadge(r.status)}
                      </td>

                      {/* Hold Expiry / Response */}
                      <td className="py-4 px-4">
                        {formatHoldOrResponse(r)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Pagination Controls ─── */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 pb-1 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium order-2 sm:order-1">
              Showing <strong className="text-slate-800">{(validPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
              <strong className="text-slate-800">{Math.min(validPage * PAGE_SIZE, filteredRequests.length)}</strong> of{' '}
              <strong className="text-slate-800">{filteredRequests.length}</strong> requests
            </p>

            <div className="flex items-center gap-1.5 order-1 sm:order-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validPage <= 1}
                className="flex items-center gap-1 h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-[36px] h-9 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      pageNum === validPage
                        ? 'bg-[#0066cc] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validPage >= totalPages}
                className="flex items-center gap-1 h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
