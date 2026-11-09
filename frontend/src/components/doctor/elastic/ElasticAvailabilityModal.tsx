'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatTime, formatDate } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/api/axios';
import { elasticSchedulingApi, ConflictCheckResult } from '@/lib/api/elastic-scheduling';
import {
  Clock,
  ArrowRight,
  Maximize2,
  Minimize2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
} from 'lucide-react';

interface ElasticAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: {
    id: string;
    shiftType: 'RECURRING' | 'CUSTOM';
    title: string;
    dateOrDay: string;
    startTime: string;
    endTime: string;
    slotDuration?: number;
    schedulingType?: 'WAVE' | 'STREAM';
    maxPatients?: number;
  } | null;
  onSuccess: () => void;
  onConflictDetected: (conflicts: ConflictCheckResult, shiftData: any) => void;
}

function toMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function ElasticAvailabilityModal({
  isOpen,
  onClose,
  shift,
  onSuccess,
  onConflictDetected,
}: ElasticAvailabilityModalProps) {
  const [newStartTime, setNewStartTime] = useState<string>('');
  const [newEndTime, setNewEndTime] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Initialize form when shift changes
  React.useEffect(() => {
    if (shift) {
      setNewStartTime(shift.startTime);
      setNewEndTime(shift.endTime);
    }
  }, [shift]);

  // Compute live change classification (Expansion vs Shrinking vs Unchanged)
  const analysis = useMemo(() => {
    if (!shift || !newStartTime || !newEndTime) return null;

    const oldStartMins = toMinutes(shift.startTime);
    const oldEndMins = toMinutes(shift.endTime);
    const newStartMins = toMinutes(newStartTime);
    const newEndMins = toMinutes(newEndTime);

    if (newEndMins <= newStartMins) {
      return { isValid: false, error: 'End time must be later than start time' };
    }

    const startExpanded = newStartMins < oldStartMins;
    const endExpanded = newEndMins > oldEndMins;
    const startShrunk = newStartMins > oldStartMins;
    const endShrunk = newEndMins < oldEndMins;

    const isExpansion = (startExpanded || endExpanded) && !startShrunk && !endShrunk;
    const isShrinking = (startShrunk || endShrunk) && !startExpanded && !endExpanded;
    const isMixed = (startExpanded && endShrunk) || (startShrunk && endExpanded);
    const isUnchanged = newStartMins === oldStartMins && newEndMins === oldEndMins;

    return {
      isValid: true,
      isExpansion,
      isShrinking,
      isMixed,
      isUnchanged,
      startExpanded,
      endExpanded,
      startShrunk,
      endShrunk,
      startDelta: startExpanded
        ? `${newStartTime} – ${shift.startTime}`
        : startShrunk
        ? `${shift.startTime} – ${newStartTime}`
        : null,
      endDelta: endExpanded
        ? `${shift.endTime} – ${newEndTime}`
        : endShrunk
        ? `${newEndTime} – ${shift.endTime}`
        : null,
    };
  }, [shift, newStartTime, newEndTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift || !analysis || !analysis.isValid) return;

    if (analysis.isUnchanged) {
      toast.info('No hours changed');
      onClose();
      return;
    }

    if (analysis.isMixed) {
      toast.error('Mixed boundary change', {
        description: 'Please expand or shrink one boundary at a time to ensure safe booking management.',
      });
      return;
    }

    try {
      setLoading(true);

      if (analysis.isExpansion) {
        // Phase 1: Elastic Expansion
        await elasticSchedulingApi.expandSchedule({
          shiftType: shift.shiftType,
          shiftId: shift.id,
          newStartTime,
          newEndTime,
        });

        toast.success('Schedule Expanded Successfully', {
          description: `Hours extended to ${formatTime(newStartTime)} – ${formatTime(newEndTime)}. Existing bookings preserved.`,
        });
        onSuccess();
        onClose();
      } else if (analysis.isShrinking) {
        // Phase 2: Check for shrinking conflicts first
        const conflicts = await elasticSchedulingApi.checkShrinkConflicts({
          shiftType: shift.shiftType,
          shiftId: shift.id,
          newStartTime,
          newEndTime,
        });

        if (conflicts.hasConflicts) {
          // Case B: Confirmed appointments affected
          onClose();
          onConflictDetected(conflicts, {
            ...shift,
            newStartTime,
            newEndTime,
          });
        } else {
          // Case A: Zero conflicts, apply immediately
          await elasticSchedulingApi.applyShrink({
            shiftType: shift.shiftType,
            shiftId: shift.id,
            newStartTime,
            newEndTime,
            forceIfNoConflicts: true,
          });

          toast.success('Hours Reduced Successfully', {
            description: `Shift updated to ${formatTime(newStartTime)} – ${formatTime(newEndTime)} without conflicts.`,
          });
          onSuccess();
          onClose();
        }
      }
    } catch (err: unknown) {
      toast.error('Schedule adjustment failed', {
        description: extractErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  };

  if (!shift) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border border-slate-200 shadow-xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Elastic Schedule Adjustment
          </DialogTitle>
          <p className="text-xs text-slate-500">
            {shift.title} • {shift.dateOrDay}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Current Working Window */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex justify-between items-center">
            <span className="text-slate-600 font-medium">Current Working Hours:</span>
            <span className="font-semibold text-slate-900 font-mono">
              {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
            </span>
          </div>

          {/* New Start & End Time Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Start Time
              </label>
              <Input
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="font-mono text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New End Time
              </label>
              <Input
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                className="font-mono text-sm"
                required
              />
            </div>
          </div>

          {/* Live Analysis Banner */}
          {analysis && analysis.isValid && (
            <>
              {analysis.isExpansion && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800">
                  <div className="font-semibold flex items-center gap-1.5 mb-1 text-emerald-900">
                    <Maximize2 className="w-4 h-4 text-emerald-600" />
                    Elastic Expansion Detected
                  </div>
                  <p className="text-emerald-700 leading-relaxed">
                    Extending your hours from{' '}
                    <strong>
                      {formatTime(newStartTime)} to {formatTime(newEndTime)}
                    </strong>
                    .
                  </p>
                  <ul className="mt-1.5 list-disc list-inside text-emerald-700 space-y-0.5">
                    {analysis.startDelta && (
                      <li>New slots created for: {analysis.startDelta}</li>
                    )}
                    {analysis.endDelta && (
                      <li>New slots created for: {analysis.endDelta}</li>
                    )}
                    <li className="font-medium text-emerald-900">
                      All existing slots & confirmed bookings are preserved intact.
                    </li>
                  </ul>
                </div>
              )}

              {analysis.isShrinking && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                  <div className="font-semibold flex items-center gap-1.5 mb-1 text-amber-900">
                    <Minimize2 className="w-4 h-4 text-amber-600" />
                    Elastic Shrinking Detected
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    Narrowing hours to{' '}
                    <strong>
                      {formatTime(newStartTime)} – {formatTime(newEndTime)}
                    </strong>
                    .
                  </p>
                  <p className="mt-1 text-amber-700">
                    The system will automatically detect any existing bookings in the reduced
                    time window. If appointments are affected, a conflict resolution prompt will allow
                    you to reschedule them safely.
                  </p>
                </div>
              )}

              {analysis.isMixed && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Mixed Adjustment:</span> Please adjust either the
                    start time or end time separately to preserve clean booking boundaries.
                  </div>
                </div>
              )}
            </>
          )}

          {analysis && !analysis.isValid && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{analysis.error}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !analysis?.isValid || analysis?.isMixed}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Verifying...
                </>
              ) : (
                'Apply Adjustment'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

