'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DoctorLeave } from '@/types';
import { formatDate } from '@/lib/utils';
import { approveDoctorLeave, rejectDoctorLeave } from '@/lib/api/admin';
import { toast } from 'sonner';
import {
  Plane,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Calendar,
  AlertCircle,
  Loader2,
  User,
  Filter,
  Check,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface AdminLeavesClientProps {
  initialLeaves: DoctorLeave[];
  initialMeta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
  };
  token: string;
  initialStatus?: string;
}

export function AdminLeavesClient({
  initialLeaves,
  initialMeta,
  token,
  initialStatus = 'ALL',
}: AdminLeavesClientProps) {
  const router = useRouter();
  const [leaves, setLeaves] = useState<DoctorLeave[]>(initialLeaves);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modal State for Reject / Approve
  const [modalType, setModalType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<DoctorLeave | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const calculateDays = (start: string, end?: string | null) => {
    if (!end || start === end) return 1;
    const d1 = new Date(start + 'T00:00:00Z').getTime();
    const d2 = new Date(end + 'T00:00:00Z').getTime();
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  };

  const handleApprove = async () => {
    if (!selectedLeave) return;
    try {
      setActionLoadingId(selectedLeave.id);
      await approveDoctorLeave(selectedLeave.id, token);
      toast.success('Leave Request Approved', {
        description: `Approved leave for Dr. ${selectedLeave.doctor?.fullName || 'Doctor'}. Availability slots blocked.`,
      });
      setLeaves((prev) =>
        prev.map((l) =>
          l.id === selectedLeave.id
            ? { ...l, status: 'APPROVED', rejectionReason: null }
            : l,
        ),
      );
      setModalType(null);
      setSelectedLeave(null);
      router.refresh();
    } catch (err: any) {
      toast.error('Approval failed', {
        description: err?.response?.data?.message || err?.message || 'Action could not be completed',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedLeave) return;
    if (!rejectionReason.trim()) {
      toast.error('Reason required', { description: 'Please provide a brief reason for declining the leave.' });
      return;
    }
    try {
      setActionLoadingId(selectedLeave.id);
      await rejectDoctorLeave(selectedLeave.id, rejectionReason.trim(), token);
      toast.success('Leave Request Declined', {
        description: `Declined leave for Dr. ${selectedLeave.doctor?.fullName || 'Doctor'}. Notification sent.`,
      });
      setLeaves((prev) =>
        prev.map((l) =>
          l.id === selectedLeave.id
            ? { ...l, status: 'REJECTED', rejectionReason: rejectionReason.trim() }
            : l,
        ),
      );
      setModalType(null);
      setSelectedLeave(null);
      setRejectionReason('');
      router.refresh();
    } catch (err: any) {
      toast.error('Rejection failed', {
        description: err?.response?.data?.message || err?.message || 'Action could not be completed',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredLeaves = leaves.filter((leave) => {
    // Status filter
    if (statusFilter !== 'ALL' && leave.status !== statusFilter) {
      return false;
    }
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const docName = leave.doctor?.fullName?.toLowerCase() || '';
      const email = leave.doctor?.user?.email?.toLowerCase() || '';
      const spec = leave.doctor?.specialization?.toLowerCase() || '';
      const reason = leave.reason?.toLowerCase() || '';
      return (
        docName.includes(q) ||
        email.includes(q) ||
        spec.includes(q) ||
        reason.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shadow-xs shrink-0">
            <Plane className="w-6 h-6 -rotate-45" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Doctor Leave Approvals
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Review, approve, or reject clinical leave requests submitted by healthcare practitioners.
            </p>
          </div>
        </div>

        {/* Quick status summary counts */}
        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>{initialMeta.pendingCount} Pending</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{initialMeta.approvedCount} Approved</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Requests' },
            {
              id: 'PENDING',
              label: 'Pending Review',
              badge: initialMeta.pendingCount,
            },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'REJECTED', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-extrabold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search doctor, email, reason..."
            className="pl-9 text-xs rounded-xl border-slate-200 h-9 bg-slate-50/50 focus:bg-white"
          />
        </div>
      </div>

      {/* Leave Requests List */}
      {filteredLeaves.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Plane className="w-6 h-6 -rotate-45" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No leave requests found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {statusFilter === 'PENDING'
              ? 'Great! There are no pending doctor leave requests awaiting review.'
              : 'No leave applications match the selected filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLeaves.map((leave) => {
            const daysCount = calculateDays(leave.date, leave.endDate);
            const isRange = leave.endDate && leave.endDate !== leave.date;
            const dateDisplay = isRange
              ? `${formatDate(leave.date)} – ${formatDate(leave.endDate!)}`
              : formatDate(leave.date);

            return (
              <div
                key={leave.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Doctor & Dates */}
                <div className="flex items-start sm:items-center gap-4">
                  {/* Doctor Avatar / Initials */}
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066cc]/10 to-[#0066cc]/20 text-[#0066cc] flex items-center justify-center font-bold text-base shrink-0 border border-[#0066cc]/15">
                    {leave.doctor?.fullName
                      ? leave.doctor.fullName.charAt(0).toUpperCase()
                      : 'D'}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-sm">
                        Dr. {leave.doctor?.fullName || 'Practitioner'}
                      </span>
                      {leave.doctor?.specialization && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                          {leave.doctor.specialization}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500 font-mono">
                        {leave.doctor?.user?.email}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{dateDisplay}</span>
                        <span className="text-slate-400 font-normal">
                          ({daysCount} {daysCount === 1 ? 'day' : 'days'})
                        </span>
                      </div>

                      <div className="h-3 w-px bg-slate-200 hidden sm:block" />

                      <span className="text-xs font-semibold text-slate-700 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg border border-purple-100">
                        {leave.reason || 'General Leave'}
                      </span>
                    </div>

                    {leave.rejectionReason && (
                      <p className="text-xs text-rose-600 font-medium mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Decline Note: {leave.rejectionReason}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Status badge & Action buttons */}
                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  {/* Status Pill */}
                  {leave.status === 'APPROVED' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Approved
                    </span>
                  ) : leave.status === 'REJECTED' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Rejected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Pending Approval
                    </span>
                  )}

                  {/* Approve / Reject buttons */}
                  {leave.status === 'PENDING' ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="xs"
                        onClick={() => {
                          setSelectedLeave(leave);
                          setModalType('APPROVE');
                        }}
                        disabled={actionLoadingId === leave.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1 h-auto cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        {actionLoadingId === leave.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Approve</span>
                      </Button>

                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setSelectedLeave(leave);
                          setRejectionReason('');
                          setModalType('REJECT');
                        }}
                        disabled={actionLoadingId === leave.id}
                        className="border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100 font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 h-auto cursor-pointer active:scale-95 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </Button>
                    </div>
                  ) : leave.status === 'REJECTED' ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        setSelectedLeave(leave);
                        setModalType('APPROVE');
                      }}
                      className="text-xs font-semibold text-slate-600 hover:text-emerald-700"
                    >
                      Re-Approve
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        setSelectedLeave(leave);
                        setRejectionReason('');
                        setModalType('REJECT');
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-rose-600"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modals */}
      <Dialog
        open={modalType !== null}
        onOpenChange={(open) => {
          if (!open) {
            setModalType(null);
            setSelectedLeave(null);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white border border-slate-200">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  modalType === 'APPROVE'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                {modalType === 'APPROVE' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900">
                  {modalType === 'APPROVE'
                    ? 'Approve Doctor Leave'
                    : 'Decline Leave Request'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {selectedLeave?.doctor?.fullName
                    ? `Dr. ${selectedLeave.doctor.fullName}`
                    : 'Doctor'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Duration:</span>
                <span className="font-bold text-slate-800">
                  {selectedLeave &&
                    (selectedLeave.endDate && selectedLeave.endDate !== selectedLeave.date
                      ? `${formatDate(selectedLeave.date)} to ${formatDate(selectedLeave.endDate)}`
                      : formatDate(selectedLeave?.date || ''))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reason:</span>
                <span className="font-semibold text-slate-800">
                  {selectedLeave?.reason || 'General Leave'}
                </span>
              </div>
            </div>

            {modalType === 'APPROVE' ? (
              <p className="text-slate-600 leading-relaxed">
                Approving this leave will mark the practitioner unavailable for the selected dates and notify the doctor.
              </p>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Decline Reason <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Clinic coverage unavailable, high patient volume"
                  className="text-xs rounded-xl border-slate-200"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModalType(null);
                setSelectedLeave(null);
              }}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            {modalType === 'APPROVE' ? (
              <Button
                type="button"
                onClick={handleApprove}
                disabled={actionLoadingId !== null}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                {actionLoadingId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Confirm Approval'
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleReject}
                disabled={actionLoadingId !== null}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
              >
                {actionLoadingId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Decline Request'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
