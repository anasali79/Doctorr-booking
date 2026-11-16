'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { DoctorLeave } from '@/types';
import { formatDate, getTodayIST } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plane,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Trash2,
  Loader2,
  Info,
  RotateCcw,
  Sparkles,
  MousePointerClick,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface DoctorLeaveCalendarProps {
  initialLeaves: DoctorLeave[];
  onLeavesUpdated?: (leaves: DoctorLeave[]) => void;
}

export function DoctorLeaveCalendar({
  initialLeaves,
  onLeavesUpdated,
}: DoctorLeaveCalendarProps) {
  const router = useRouter();
  const [leaves, setLeaves] = useState<DoctorLeave[]>(() =>
    Array.isArray(initialLeaves) ? initialLeaves : [],
  );

  // Selected date range on calendar
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pagination state for Leave History
  const [leavePage, setLeavePage] = useState<number>(1);
  const LEAVES_PER_PAGE = 5;

  const totalLeavePages = Math.max(1, Math.ceil(leaves.length / LEAVES_PER_PAGE));
  const validLeavePage = Math.min(leavePage, totalLeavePages);

  const paginatedLeaves = useMemo(() => {
    const start = (validLeavePage - 1) * LEAVES_PER_PAGE;
    return leaves.slice(start, start + LEAVES_PER_PAGE);
  }, [leaves, validLeavePage]);

  // Today reference for IST
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Format date object to YYYY-MM-DD in local time
  const formatToDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Convert leave records into arrays of Dates for calendar highlighting
  const { approvedDates, pendingDates } = useMemo(() => {
    const approved: Date[] = [];
    const pending: Date[] = [];

    leaves.forEach((l) => {
      const start = new Date(l.date + 'T00:00:00');
      const end = l.endDate ? new Date(l.endDate + 'T00:00:00') : start;
      const cur = new Date(start);

      while (cur <= end) {
        if (l.status === 'APPROVED') {
          approved.push(new Date(cur));
        } else if (l.status === 'PENDING' || !l.status) {
          pending.push(new Date(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
    });

    return { approvedDates: approved, pendingDates: pending };
  }, [leaves]);

  // Derived selected start and end date strings
  const selectedDetails = useMemo(() => {
    if (!selectedRange?.from) return null;
    const startStr = formatToDateStr(selectedRange.from);
    const endStr = selectedRange.to ? formatToDateStr(selectedRange.to) : startStr;
    const isRange = endStr !== startStr;

    // Calculate days count
    const d1 = new Date(startStr + 'T00:00:00').getTime();
    const d2 = new Date(endStr + 'T00:00:00').getTime();
    const daysCount = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;

    return {
      startDate: startStr,
      endDate: endStr,
      isRange,
      daysCount: Math.max(1, daysCount),
      displayText: isRange
        ? `${formatDate(startStr)} – ${formatDate(endStr)}`
        : formatDate(startStr),
    };
  }, [selectedRange]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetails) {
      toast.warning('Please select dates on the calendar first.');
      return;
    }

    try {
      setSaving(true);
      await clientAxios.post('/api/doctor/leave-proxy', {
        date: selectedDetails.startDate,
        endDate: selectedDetails.endDate,
        reason: reason.trim() || undefined,
      });

      toast.success('Leave Request Submitted', {
        description: `Your request for ${selectedDetails.displayText} has been forwarded for admin approval.`,
      });

      setSelectedRange(undefined);
      setReason('');
      setLeavePage(1);

      // Refetch latest leaves
      const updatedRes = await clientAxios.get<{ data: DoctorLeave[] }>(
        '/api/doctor/leave-proxy',
      );
      const rawData = updatedRes.data?.data ?? updatedRes.data;
      if (Array.isArray(rawData)) {
        setLeaves(rawData);
        if (onLeavesUpdated) onLeavesUpdated(rawData);
      }
      router.refresh();
    } catch (err: unknown) {
      toast.error('Leave Request Failed', { description: extractErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLeave = async (id: string) => {
    try {
      setDeletingId(id);
      await clientAxios.delete(`/api/doctor/leave-proxy/${id}`);

      toast.success('Leave Cancelled');
      setLeaves((prev) => {
        const next = prev.filter((l) => l.id !== id);
        if (onLeavesUpdated) onLeavesUpdated(next);
        return next;
      });
      router.refresh();
    } catch (err: unknown) {
      toast.error('Error cancelling leave', { description: extractErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  const approvedCount = leaves.filter((l) => l.status === 'APPROVED').length;
  const pendingCount = leaves.filter((l) => l.status === 'PENDING' || !l.status).length;

  return (
    <div className="space-y-6">
      {/* ─── Header Card matching reference design ─── */}
      <div className="bg-white rounded-3xl border border-slate-100/90 p-6 sm:p-7 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#f5efff] text-[#7c3aed] flex items-center justify-center border border-[#ede3fe] shadow-xs shrink-0">
              <Plane className="w-5 h-5 -rotate-45" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Manage Leaves
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Select single date or date range directly on the calendar below to apply for leave.
              </p>
            </div>
          </div>

          {/* Quick status summary */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              {approvedCount} Approved
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
              {pendingCount} Pending
            </span>
          </div>
        </div>
      </div>

      {/* ─── Interactive Calendar & Application Panel Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Calendar */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100/90 p-6 sm:p-7 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#0066cc]" />
                <span>Leave Calendar</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Click a date for 1-day leave, or click start & end dates for a multi-day range
              </p>
            </div>
          </div>

          {/* react-day-picker Container */}
          <div className="flex justify-center py-2 doc-leave-calendar-wrapper">
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={setSelectedRange}
              disabled={{ before: today }}
              modifiers={{
                approved: approvedDates,
                pending: pendingDates,
              }}
              modifiersStyles={{
                approved: {
                  backgroundColor: '#ecfdf5',
                  color: '#047857',
                  fontWeight: '700',
                  borderRadius: '10px',
                  border: '1px solid #a7f3d0',
                },
                pending: {
                  backgroundColor: '#fffbeb',
                  color: '#b45309',
                  fontWeight: '700',
                  borderRadius: '10px',
                  border: '1px solid #fde68a',
                },
              }}
              style={
                {
                  '--rdp-accent-color': '#0066cc',
                  '--rdp-accent-background-color': '#e0f2fe',
                  '--rdp-day-height': '46px',
                  '--rdp-day-width': '46px',
                  '--rdp-day_button-border-radius': '12px',
                  '--rdp-range_middle-background-color': '#e0f2fe',
                  '--rdp-range_middle-color': '#0052a3',
                } as React.CSSProperties
              }
            />
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <MousePointerClick className="w-3.5 h-3.5 text-slate-400" />
              Tip: Drag or click two dates to select a range like 15 Nov to 17 Nov.
            </span>
            {selectedRange?.from && (
              <button
                type="button"
                onClick={() => setSelectedRange(undefined)}
                className="text-[11px] font-bold text-slate-600 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Apply Leave Action Card */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-100/90 p-6 sm:p-7 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.04)] space-y-5">
          {!selectedDetails ? (
            /* Empty state when no date is picked */
            <div className="py-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-100/80 shadow-xs">
                <MousePointerClick className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Select Leave Dates on Calendar
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Click on any available future date on the calendar to select a single day, or click two dates to choose a full range.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-left">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 font-medium block">
                    Approved Days
                  </span>
                  <span className="text-base font-extrabold text-slate-800">
                    {approvedCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-100">
                  <span className="text-[11px] text-amber-700 font-medium block">
                    Pending Approval
                  </span>
                  <span className="text-base font-extrabold text-amber-800">
                    {pendingCount}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Active Form when date(s) are selected on calendar */
            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Apply Selected Leave
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Submit for administrative review
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRange(undefined)}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  Clear
                </button>
              </div>

              {/* Selected Dates Summary Badge */}
              <div className="p-3.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-2xl border border-blue-100 space-y-1">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                  Selected Duration
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-sm">
                    {selectedDetails.displayText}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#0066cc] text-white text-xs font-bold">
                    {selectedDetails.daysCount}{' '}
                    {selectedDetails.daysCount === 1 ? 'Day' : 'Days'}
                  </span>
                </div>
              </div>

              {/* Reason Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Reason Preset
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Sick Leave',
                    'Casual Leave',
                    'Annual Vacation',
                    'Personal Emergency',
                    'Medical Conference',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReason(preset)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${reason === preset
                        ? 'bg-[#0066cc] border-[#0066cc] text-white font-bold shadow-xs'
                        : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100 font-medium'
                        }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason Details (Optional)
                </label>
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Attending national medical congress, annual family trip..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-600 resize-none"
                />
              </div>

              {/* Notice */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-amber-900 leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Submitted with <strong>Pending</strong> status. Once approved by the administrator, the dates will be officially blocked across your clinic slots.
                </span>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#0066cc] hover:bg-[#0055b3] text-white rounded-xl font-bold text-xs w-full py-3 h-auto shadow-xs active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Request…</span>
                  </>
                ) : (
                  <>
                    <Plane className="w-4 h-4 -rotate-45" />
                    <span>Apply for Leave ({selectedDetails.daysCount} {selectedDetails.daysCount === 1 ? 'Day' : 'Days'})</span>
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* ─── Leave History Section matching reference design ─── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              Leave History & Records
            </h3>
            <p className="text-xs text-slate-500">
              Your requested and scheduled time-off records
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3.5 py-1 text-xs font-semibold text-slate-700">
            {leaves.length} Total
          </span>
        </div>

        {leaves.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100/90 p-12 text-center shadow-[0_2px_16px_-4px_rgba(15,23,42,0.04)]">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
              <Plane className="w-6 h-6 -rotate-45" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">No leaves recorded</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              You haven&apos;t applied for any leaves yet. Click on the calendar above to select dates.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedLeaves.map((leave) => {
              const isRange = leave.endDate && leave.endDate !== leave.date;
              const dateText = isRange
                ? `${formatDate(leave.date)} – ${formatDate(leave.endDate!)}`
                : formatDate(leave.date);

              // Calculate days
              const d1 = new Date(leave.date + 'T00:00:00').getTime();
              const d2 = new Date((leave.endDate || leave.date) + 'T00:00:00').getTime();
              const days = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);

              return (
                <div
                  key={leave.id}
                  className="bg-white rounded-2xl border border-slate-100/90 p-4 sm:px-6 sm:py-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-200"
                >
                  <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                    {/* Calendar Icon in squircle */}
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-800 shrink-0">
                      <CalendarIcon className="w-5 h-5 text-indigo-950" />
                    </div>

                    {/* Date / Range */}
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm whitespace-nowrap">
                        {dateText}
                      </span>
                      {isRange && (
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          ({days} days)
                        </span>
                      )}
                    </div>

                    {/* Vertical Divider */}
                    <div className="h-5 w-px bg-slate-200 hidden sm:block mx-1" />

                    {/* Reason */}
                    <span className="text-sm font-semibold text-slate-700">
                      {leave.reason || 'General Leave'}
                    </span>

                    {leave.rejectionReason && (
                      <span className="text-xs text-rose-600 font-medium bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100">
                        Decline reason: {leave.rejectionReason}
                      </span>
                    )}
                  </div>

                  {/* Right side: Status badge & Cancel action */}
                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    {leave.status === 'APPROVED' ? (
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Approved
                      </span>
                    ) : leave.status === 'REJECTED' ? (
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Pending
                      </span>
                    )}

                    {/* Delete / Cancel button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteLeave(leave.id)}
                      disabled={deletingId === leave.id}
                      title="Cancel or delete this leave request"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      {deletingId === leave.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Pagination Controls */}
            {totalLeavePages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 pb-2 border-t border-slate-200/80">
                <p className="text-xs text-slate-500 font-medium order-2 sm:order-1">
                  Showing <strong className="text-slate-800">{(validLeavePage - 1) * LEAVES_PER_PAGE + 1}</strong> to{' '}
                  <strong className="text-slate-800">{Math.min(validLeavePage * LEAVES_PER_PAGE, leaves.length)}</strong> of{' '}
                  <strong className="text-slate-800">{leaves.length}</strong> records
                </p>

                <div className="flex items-center gap-1.5 order-1 sm:order-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLeavePage((p) => Math.max(1, p - 1))}
                    disabled={validLeavePage <= 1}
                    className="flex items-center gap-1 h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalLeavePages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setLeavePage(pageNum)}
                        className={`min-w-[36px] h-9 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${pageNum === validLeavePage
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
                    onClick={() => setLeavePage((p) => Math.min(totalLeavePages, p + 1))}
                    disabled={validLeavePage >= totalLeavePages}
                    className="flex items-center gap-1 h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
