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
  Sparkles,
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

    try {
      setLoading(true);

      if (analysis.isExpansion) {
        // Phase 1: Pure Elastic Expansion
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
      } else if (analysis.isShrinking || analysis.isMixed) {
        // Phase 2: Elastic Shrinking or Combined Adjustment
        // Check for conflicts on any clipped boundaries first
        const conflicts = await elasticSchedulingApi.checkShrinkConflicts({
          shiftType: shift.shiftType,
          shiftId: shift.id,
          newStartTime,
          newEndTime,
        });

        if (conflicts.hasConflicts) {
          // Confirmed appointments affected in the clipped window
          onClose();
          onConflictDetected(conflicts, {
            ...shift,
            newStartTime,
            newEndTime,
          });
        } else {
          // Zero conflicts, apply immediately
          await elasticSchedulingApi.applyShrink({
            shiftType: shift.shiftType,
            shiftId: shift.id,
            newStartTime,
            newEndTime,
            forceIfNoConflicts: true,
          });

          const successTitle = analysis.isMixed
            ? 'Combined Schedule Adjusted Successfully'
            : 'Hours Reduced Successfully';
          const successDesc = analysis.isMixed
            ? `Hours updated to ${formatTime(newStartTime)} – ${formatTime(newEndTime)}. Expanded slots opened and reduced boundaries safely applied without conflicts.`
            : `Shift updated to ${formatTime(newStartTime)} – ${formatTime(newEndTime)} without conflicts.`;

          toast.success(successTitle, {
            description: successDesc,
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                  <div className="font-semibold flex items-center gap-1.5 mb-1 text-blue-900">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Combined Adjustment Detected (Expansion + Shrink)
                  </div>
                  <p className="text-blue-800 leading-relaxed">
                    Adjusting hours to{' '}
                    <strong>
                      {formatTime(newStartTime)} – {formatTime(newEndTime)}
                    </strong>
                    .
                  </p>
                  <ul className="mt-1.5 list-disc list-inside text-blue-800 space-y-0.5">
                    {analysis.startExpanded && (
                      <li>
                        <span className="font-semibold text-emerald-800">Expansion:</span> Morning extended earlier by{' '}
                        {analysis.startDelta} (new slots opened).
                      </li>
                    )}
                    {analysis.endExpanded && (
                      <li>
                        <span className="font-semibold text-emerald-800">Expansion:</span> Evening extended later by{' '}
                        {analysis.endDelta} (new slots opened).
                      </li>
                    )}
                    {analysis.startShrunk && (
                      <li>
                        <span className="font-semibold text-amber-800">Shrinking:</span> Morning reduced by{' '}
                        {analysis.startDelta} (conflict scan will run).
                      </li>
                    )}
                    {analysis.endShrunk && (
                      <li>
                        <span className="font-semibold text-amber-800">Shrinking:</span> Evening reduced by{' '}
                        {analysis.endDelta} (conflict scan will run).
                      </li>
                    )}
                    <li className="font-medium text-blue-950">
                      Existing bookings are strictly protected. If bookings fall in the reduced period, you can easily reschedule them.
                    </li>
                  </ul>
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
              disabled={loading || !analysis?.isValid || analysis?.isUnchanged}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[130px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Verifying...
                </>
              ) : analysis?.isExpansion ? (
                'Expand Schedule'
              ) : analysis?.isShrinking ? (
                'Reduce Hours'
              ) : analysis?.isMixed ? (
                'Apply Combined'
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

