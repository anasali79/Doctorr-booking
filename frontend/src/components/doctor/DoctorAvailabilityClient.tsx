'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RecurringAvailability } from '@/types';
import { DAYS_OF_WEEK } from '@/lib/constants';
import { formatTime } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Calendar,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

interface DoctorAvailabilityClientProps {
  initialAvailability: RecurringAvailability[];
}

function parseAvailabilityList(input: unknown): RecurringAvailability[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const obj = input as any;
    if (Array.isArray(obj.recurring)) return obj.recurring;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

export function DoctorAvailabilityClient({
  initialAvailability,
}: DoctorAvailabilityClientProps) {
  const router = useRouter();
  const [availabilities, setAvailabilities] = useState<RecurringAvailability[]>(() =>
    parseAvailabilityList(initialAvailability),
  );

  // Form State
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
  ]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState<number>(30);
  const [schedulingType, setSchedulingType] = useState<'STREAM' | 'WAVE'>('STREAM');
  const [bufferTime, setBufferTime] = useState<number>(0);
  const [maxPatients, setMaxPatients] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toggle Day Selection
  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) {
        toast.warning('Select at least one day');
        return;
      }
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // Calculate Slot Count Preview
  const calculatePreviewSlots = () => {
    try {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;

      if (endMin <= startMin) return 0;

      const totalWorkingMins = endMin - startMin;
      const slotAndBuffer = slotDuration + bufferTime;
      if (slotAndBuffer <= 0) return 0;

      return Math.floor(totalWorkingMins / slotAndBuffer);
    } catch {
      return 0;
    }
  };

  const previewSlotCount = calculatePreviewSlots();

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (endTime <= startTime) {
      toast.error('Invalid Time Range', {
        description: 'End time must be later than start time',
      });
      return;
    }

    try {
      setSaving(true);
      await clientAxios.post('/api/doctor/availability-proxy', {
        daysOfWeek: selectedDays,
        startTime,
        endTime,
        slotDuration,
        schedulingType,
        bufferTime,
        maxPatients: schedulingType === 'WAVE' ? maxPatients : undefined,
      });

      toast.success('Availability Schedule Saved!');
      router.refresh();

      // Refetch via Axios
      const updatedRes = await clientAxios.get<any>(
        '/api/doctor/availability-proxy',
      );
      const rawData = updatedRes.data?.data ?? updatedRes.data;
      setAvailabilities(parseAvailabilityList(rawData));
    } catch (err: unknown) {
      toast.error('Schedule Failed', { description: extractErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await clientAxios.delete(`/api/doctor/availability-proxy/${id}`);

      toast.success('Availability Slot Removed');
      setAvailabilities((prev) => (Array.isArray(prev) ? prev.filter((a) => a.id !== id) : []));
      router.refresh();
    } catch (err: unknown) {
      toast.error('Deletion Failed', { description: extractErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  const safeAvailabilities = Array.isArray(availabilities) ? availabilities : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Schedule Configuration Form */}
      <Card className="lg:col-span-5 card p-6 sm:p-7 shadow-xs bg-white space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Set Weekly Working Hours
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Define recurring consultation slots that automatically open for patient booking.
          </p>
        </div>

        <form onSubmit={handleCreateSchedule} className="space-y-5">
          {/* Days of Week Selector */}
          <div>
            <label className="field-label">Select Days of Week</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <Button
                    key={day}
                    type="button"
                    variant="ghost"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer h-auto ${
                      isSelected
                        ? 'bg-blue-700 text-white shadow-xs hover:bg-blue-800 hover:text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Start Time</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="field-input text-xs font-semibold"
                required
              />
            </div>
            <div>
              <label className="field-label">End Time</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="field-input text-xs font-semibold"
                required
              />
            </div>
          </div>

          {/* Slot Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Slot Duration</label>
              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                className="field-input text-xs font-semibold"
              >
                <option value={15}>15 Minutes</option>
                <option value={20}>20 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>

            <div>
              <label className="field-label">Buffer Time</label>
              <select
                value={bufferTime}
                onChange={(e) => setBufferTime(Number(e.target.value))}
                className="field-input text-xs font-semibold"
              >
                <option value={0}>0 Min (Back to back)</option>
                <option value={5}>5 Minutes</option>
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes</option>
              </select>
            </div>
          </div>

          {/* Scheduling Type */}
          <div>
            <label className="field-label">Scheduling Flow</label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSchedulingType('STREAM')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer h-auto flex flex-col items-start ${
                  schedulingType === 'STREAM'
                    ? 'border-blue-700 bg-blue-50/80 text-blue-900 shadow-2xs hover:bg-blue-50/80'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="font-bold text-xs block">STREAM</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  1 patient per slot (Linear)
                </span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setSchedulingType('WAVE')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer h-auto flex flex-col items-start ${
                  schedulingType === 'WAVE'
                    ? 'border-blue-700 bg-blue-50/80 text-blue-900 shadow-2xs hover:bg-blue-50/80'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="font-bold text-xs block">WAVE</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Multiple patients grouped
                </span>
              </Button>
            </div>
          </div>

          {schedulingType === 'WAVE' && (
            <div>
              <label className="field-label">Max Patients per Wave</label>
              <Input
                type="number"
                min={2}
                max={10}
                value={maxPatients}
                onChange={(e) => setMaxPatients(Number(e.target.value))}
                className="field-input text-xs font-semibold"
              />
            </div>
          )}

          {/* Slot Count Preview Box */}
          <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-900 block">
                Estimated Slot Generation:
              </span>
              <span className="text-[11px] text-blue-700">
                {previewSlotCount} slots per active clinic day
              </span>
            </div>
            <span className="text-xl font-black text-blue-800 font-mono">
              {previewSlotCount * selectedDays.length} slots/wk
            </span>
          </div>

          <Button
            type="submit"
            variant="ghost"
            disabled={saving || previewSlotCount === 0}
            className="btn-primary w-full py-3 h-auto"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Configuring Slots…</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Save Recurring Availability</span>
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* Configured Recurring Availability Table */}
      <div className="lg:col-span-7 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Current Weekly Roster ({safeAvailabilities.length})
          </h2>
          <p className="text-xs text-slate-500">
            Active rules determining when your clinic accepts appointments.
          </p>
        </div>

        {safeAvailabilities.length === 0 ? (
          <Card className="card py-16 text-center p-8 space-y-2 bg-white">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">
              No Weekly Schedule Set
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Please use the form on the left to set up your consultation hours so patients can book slots.
            </p>
          </Card>
        ) : (
          <Card className="card overflow-hidden bg-white shadow-xs p-0">
            <Table className="w-full text-left text-xs">
              <TableHeader className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-bold tracking-wider text-[10px]">
                <TableRow>
                  <TableHead className="py-3 px-4">Day of Week</TableHead>
                  <TableHead className="py-3 px-4">Time Window</TableHead>
                  <TableHead className="py-3 px-4">Duration</TableHead>
                  <TableHead className="py-3 px-4">Type</TableHead>
                  <TableHead className="py-3 px-4 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {safeAvailabilities.map((item) => (
                  <TableRow
                    key={item.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <TableCell className="py-3.5 px-4 font-bold text-slate-900">
                      {item.dayOfWeek}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 font-semibold text-slate-700">
                      {formatTime(item.startTime)} - {formatTime(item.endTime)}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-slate-600">
                      {item.slotDuration} min
                      {item.bufferTime > 0 ? ` (+${item.bufferTime}m buffer)` : ''}
                    </TableCell>
                    <TableCell className="py-3.5 px-4">
                      <Badge variant="outline" className="px-2.5 py-0.5 rounded-full bg-slate-100 font-semibold text-[10px] text-slate-700 border border-slate-200/60">
                        {item.schedulingType || 'STREAM'}
                        {item.schedulingType === 'WAVE' ? ` (${item.maxPatients || 2})` : ''}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconSm"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="p-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors cursor-pointer"
                        title="Remove availability"
                      >
                        {deletingId === item.id ? (
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
