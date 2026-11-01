'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { toast } from 'sonner';
import {
  Mail,
  MessageSquare,
  Smartphone,
  Bell,
  Clock,
  CreditCard,
  RotateCcw,
  Loader2,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { NotificationPreference } from '@/types';

interface NotificationPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationPreferencesDialog({
  open,
  onOpenChange,
}: NotificationPreferencesDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreference>({
    id: '',
    userId: '',
    emailEnabled: true,
    inAppEnabled: true,
    whatsappEnabled: true,
    smsEnabled: true,
    remindersEnabled: true,
    paymentAlertsEnabled: true,
    refundAlertsEnabled: true,
  });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    clientAxios
      .get<{ data: NotificationPreference }>('/api/notifications/preferences')
      .then((res) => {
        if (res.data?.data) {
          setPreferences(res.data.data);
        }
      })
      .catch((err) => {
        toast.error('Could not load preferences', { description: extractErrorMessage(err) });
      })
      .finally(() => setLoading(false));
  }, [open]);

  const toggleField = (field: keyof NotificationPreference) => {
    setPreferences((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await clientAxios.patch('/api/notifications/preferences', preferences);
      toast.success('Notification preferences saved successfully');
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error('Failed to update preferences', { description: extractErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 rounded-2xl bg-white shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            Notification Channels & Preferences
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Control which channels and alerts you receive for appointments, payments, and clinic updates.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs text-slate-500">Loading your settings...</span>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Delivery Channels */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Communication Channels
              </h4>

              <div className="space-y-2">
                {/* Email */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Email Notifications</p>
                      <p className="text-[11px] text-slate-500">Official receipts, confirmations & PDF summaries</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleField('emailEnabled')}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      preferences.emailEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </button>
                </div>

                {/* WhatsApp */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">WhatsApp Alerts</p>
                      <p className="text-[11px] text-slate-500">Instant reminders, token updates & schedule changes</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleField('whatsappEnabled')}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      preferences.whatsappEnabled ? 'bg-emerald-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </button>
                </div>

                {/* SMS */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">SMS Alerts</p>
                      <p className="text-[11px] text-slate-500">Reliable text messages to your verified phone</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleField('smsEnabled')}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      preferences.smsEnabled ? 'bg-purple-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </button>
                </div>

                {/* In-App */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">In-App Notification Center</p>
                      <p className="text-[11px] text-slate-500">Live notifications in the portal</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleField('inAppEnabled')}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      preferences.inAppEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                  </button>
                </div>
              </div>
            </div>

            {/* Notification Topics */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Alert Topics
              </h4>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-800">Appointment Reminders (24h, 2h, 30m)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.remindersEnabled}
                    onChange={() => toggleField('remindersEnabled')}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-800">Payment Confirmations & Receipts</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.paymentAlertsEnabled}
                    onChange={() => toggleField('paymentAlertsEnabled')}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <RotateCcw className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-800">Refund Status & Credit Updates</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.refundAlertsEnabled}
                    onChange={() => toggleField('refundAlertsEnabled')}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </div>
              </div>
            </div>

            {/* Mandatory policy note */}
            <div className="p-3 bg-slate-50 rounded-xl flex items-start gap-2.5 border border-slate-200/60">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-tight">
                Mandatory transactional communications (such as cancellation notices, security alerts, and critical schedule conflicts) remain active.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

