'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatTime, formatDate } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/api/axios';
import {
  elasticSchedulingApi,
  SmartReschedulePreviewResult,
  SmartRescheduleProposal,
  ShrinkShiftContext,
} from '@/lib/api/elastic-scheduling';
import {
  Sparkles,
  ArrowRight,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  XCircle,
  ShieldCheck,
  Send,
  Edit2,
} from 'lucide-react';

interface SmartReschedulePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: SmartReschedulePreviewResult | null;
  shrinkContext?: ShrinkShiftContext | null;
  onApproved: () => void;
  onModifyProposal: (proposal: SmartRescheduleProposal) => void;
}

export function SmartReschedulePreviewModal({
  isOpen,
  onClose,
  previewData,
  shrinkContext,
  onApproved,
  onModifyProposal,
}: SmartReschedulePreviewModalProps) {
  const [approving, setApproving] = useState<boolean>(false);

  if (!previewData) return null;

  const {
    totalAffected,
    sameDayCount,
    nextDayCount,
    futureDateCount,
    unresolvedCount,
    proposals,
  } = previewData;

  const validProposals = proposals.filter((p) => p.found && p.proposedDate && p.proposedStartTime && p.proposedEndTime);

  const handleApprove = async () => {
    if (validProposals.length === 0) {
      toast.error('No valid alternative slots to approve');
      return;
    }

    try {
      setApproving(true);
      await elasticSchedulingApi.approveSmartReschedule({
        proposals: validProposals.map((p) => ({
          appointmentId: p.appointmentId,
          proposedDate: p.proposedDate!,
          proposedStartTime: p.proposedStartTime!,
          proposedEndTime: p.proposedEndTime!,
          proposedSchedulingType: p.schedulingType,
          doctorReason: 'Schedule adjustment initiated by doctor',
        })),
        shrinkContext: shrinkContext || undefined,
      });

      toast.success('Smart Rescheduling Approved!', {
        description: `Temporary reservations created and notification requests sent to ${validProposals.length} patient(s).`,
      });
      onApproved();
      onClose();
    } catch (err: unknown) {
      toast.error('Failed to approve rescheduling', {
        description: extractErrorMessage(err),
      });
    } finally {
      setApproving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl bg-white border border-slate-200 shadow-2xl rounded-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                Smart Rescheduling Proposal Preview
              </DialogTitle>
              <p className="text-xs text-slate-300 mt-0.5">
                Review automated slot recommendations before approving and sending requests to patients.
              </p>
            </div>
          </div>
        </div>

        {/* Priority Tier Metrics Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-white p-2 rounded border border-slate-200">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Affected</span>
            <span className="text-base font-bold text-slate-900">{totalAffected}</span>
          </div>
          <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
            <span className="text-emerald-700 block text-[10px] uppercase font-bold">Same-Day</span>
            <span className="text-base font-bold text-emerald-800">{sameDayCount}</span>
          </div>
          <div className="bg-blue-50 p-2 rounded border border-blue-200">
            <span className="text-blue-700 block text-[10px] uppercase font-bold">Next-Day</span>
            <span className="text-base font-bold text-blue-800">{nextDayCount}</span>
          </div>
          <div className="bg-purple-50 p-2 rounded border border-purple-200">
            <span className="text-purple-700 block text-[10px] uppercase font-bold">Future Dates</span>
            <span className="text-base font-bold text-purple-800">{futureDateCount}</span>
          </div>
        </div>

        {/* Unresolved Warning if any */}
        {unresolvedCount > 0 && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">No replacement slot found for {unresolvedCount} patient(s).</span>
              <p className="text-rose-700 mt-0.5">
                These patients will require manual date coordination. Valid proposals can still be approved below.
              </p>
            </div>
          </div>
        )}

        {/* Proposals List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {proposals.map((p) => {
            const isFound = p.found && p.proposedDate && p.proposedStartTime;

            return (
              <div
                key={p.appointmentId}
                className={`border rounded-lg p-3.5 transition-colors flex items-center justify-between gap-4 ${
                  isFound
                    ? 'border-slate-200 bg-white hover:border-slate-300'
                    : 'border-rose-200 bg-rose-50/40'
                }`}
              >
                {/* Left: Patient & Original */}
                <div className="space-y-1 min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">
                      {p.patientName}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase text-slate-600">
                      {p.schedulingType}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                    <span className="line-through text-slate-400">
                      {formatDate(p.originalDate)} at {formatTime(p.originalStartTime)}
                    </span>
                  </div>
                </div>

                {/* Center: Arrow & Proposed Slot */}
                <div className="flex items-center gap-3 flex-1">
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                  {isFound ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-blue-700 font-mono">
                          {formatDate(p.proposedDate!)} at {formatTime(p.proposedStartTime!)}
                        </span>
                        {p.priorityTier === 'SAME_DAY' && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-[10px] font-bold">
                            Same Day (P1)
                          </Badge>
                        )}
                        {p.priorityTier === 'NEXT_DAY' && (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 text-[10px] font-bold">
                            Next Day (P2)
                          </Badge>
                        )}
                        {p.priorityTier === 'FUTURE_DATE' && (
                          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200 text-[10px] font-bold">
                            Future Date (P3)
                          </Badge>
                        )}
                        {p.proposedTokenNumber && (
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            Token #{p.proposedTokenNumber}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 block">
                        Slot duration: {formatTime(p.proposedStartTime!)} – {formatTime(p.proposedEndTime!)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-rose-700 font-medium">
                      <XCircle className="w-4 h-4 text-rose-500" />
                      {p.failureReason || 'No compatible slot found'}
                    </div>
                  )}
                </div>

                {/* Right: Modify button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onModifyProposal(p)}
                  className="text-xs text-slate-600 hover:text-blue-700 hover:bg-blue-50 shrink-0"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                  Modify
                </Button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={approving}
            className="text-xs"
          >
            Cancel Operation
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleApprove}
            disabled={approving || validProposals.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2 flex items-center gap-2 shadow-sm"
          >
            {approving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reserving Slots & Dispatching...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Approve & Send Requests ({validProposals.length})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

