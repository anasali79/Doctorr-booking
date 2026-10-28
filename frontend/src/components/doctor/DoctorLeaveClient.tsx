'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DoctorLeave } from '@/types';
import { formatDate, getTodayIST } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Plus,
  Trash2,
  Loader2,
  CalendarX2,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

interface DoctorLeaveClientProps {
  initialLeaves: DoctorLeave[];
}

export function DoctorLeaveClient({ initialLeaves }: DoctorLeaveClientProps) {
  const router = useRouter();
  const [leaves, setLeaves] = useState<DoctorLeave[]>(() =>
    Array.isArray(initialLeaves) ? initialLeaves : [],
  );
  const [date, setDate] = useState(getTodayIST());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      await clientAxios.post('/api/doctor/leave-proxy', {
        date,
        reason: reason || undefined,
      });

      toast.success('Leave Scheduled', {
        description: `Marked unavailable on ${formatDate(date)}. Any booked patients are notified.`,
      });

      setDate(getTodayIST());
      setReason('');
      router.refresh();

      // Refetch
      const updatedRes = await clientAxios.get<{ data: DoctorLeave[] }>(
        '/api/doctor/leave-proxy',
      );
      const rawData = updatedRes.data?.data ?? updatedRes.data;
      if (Array.isArray(rawData)) {
        setLeaves(rawData);
      }
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

      toast.success('Leave Cancelled — Slots reopened for booking');
      setLeaves((prev) => (Array.isArray(prev) ? prev.filter((l) => l.id !== id) : []));
      router.refresh();
    } catch (err: unknown) {
      toast.error('Error deleting leave', { description: extractErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  const safeLeaves = Array.isArray(leaves) ? leaves : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Add Leave Form */}
      <Card className="lg:col-span-5 card p-6 sm:p-7 shadow-xs bg-white space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Block Clinical Leave Date
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Prevent patients from booking slots on days you are away or unavailable.
          </p>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong className="block font-semibold mb-0.5">Automated Patient Safeguard</strong>
            If patients are already booked on this date, the clinic system will notify them and reschedule their appointments.
          </div>
        </div>

        <form onSubmit={handleAddLeave} className="space-y-4">
          <div>
            <label className="field-label">Select Leave Date *</label>
            <Input
              type="date"
              min={getTodayIST()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field-input text-xs font-semibold"
              required
            />
          </div>

          <div>
            <label className="field-label">Reason / Clinical Note (Optional)</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Annual Medical Conference, Personal Holiday..."
              className="field-input text-xs"
            />
          </div>

          <Button
            type="submit"
            variant="ghost"
            disabled={saving}
            className="btn-primary w-full py-3 h-auto"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Marking Leave…</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Confirm & Block Date</span>
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* Planned Leaves Table */}
      <div className="lg:col-span-7 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Upcoming Planned Leaves ({safeLeaves.length})
          </h2>
          <p className="text-xs text-slate-500">
            Dates where your practice is closed to patient appointments.
          </p>
        </div>

        {safeLeaves.length === 0 ? (
          <Card className="card py-16 text-center p-8 space-y-2 bg-white">
            <CalendarX2 className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">
              No Leaves Scheduled
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Your clinical calendar is currently active for all recurring weekly slots.
            </p>
          </Card>
        ) : (
          <Card className="card overflow-hidden bg-white shadow-xs p-0">
            <Table className="w-full text-left text-xs">
              <TableHeader className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-bold tracking-wider text-[10px]">
                <TableRow>
                  <TableHead className="py-3 px-4">Date</TableHead>
                  <TableHead className="py-3 px-4">Reason</TableHead>
                  <TableHead className="py-3 px-4 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {safeLeaves.map((leave) => (
                  <TableRow
                    key={leave.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <TableCell className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {formatDate(leave.date)}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-slate-600">
                      {leave.reason || <span className="italic text-slate-400">No reason specified</span>}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconSm"
                        onClick={() => handleDeleteLeave(leave.id)}
                        disabled={deletingId === leave.id}
                        className="p-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors cursor-pointer"
                        title="Cancel leave and reopen slots"
                      >
                        {deletingId === leave.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
