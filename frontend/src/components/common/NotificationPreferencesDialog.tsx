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
      // Clean payload: only send valid preference booleans, never id / userId / createdAt
      const payload = {
        emailEnabled: preferences.emailEnabled,
        inAppEnabled: preferences.inAppEnabled,
        whatsappEnabled: preferences.whatsappEnabled,
        smsEnabled: preferences.smsEnabled,
        remindersEnabled: preferences.remindersEnabled,
        paymentAlertsEnabled: preferences.paymentAlertsEnabled,
        refundAlertsEnabled: preferences.refundAlertsEnabled,
      };

      await clientAxios.patch('/api/notifications/preferences', payload);
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
      <DialogContent className="max-w-md w-[92vw] p-5 sm:p-6 rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 leading-tight">
                Notification Preferences
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Choose delivery channels and alerts for your clinical appointments
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2.5">
            <Loader2 className="w-6 h-6 animate-spin text-[#0066cc]" />
            <span className="text-xs text-slate-500 font-medium">Loading preferences...</span>
          </div>
        ) : (
          <div className="space-y-5 pt-3">
            {/* Communication Channels */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Active Channels
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Email */}
                <div
                  onClick={() => toggleField('emailEnabled')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    preferences.emailEnabled
                      ? 'border-blue-200 bg-blue-50/40 text-slate-900 shadow-2xs'
                      : 'border-slate-100 bg-slate-50/50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                      preferences.emailEnabled ? 'bg-blue-100 text-[#0066cc]' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-none">Email</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Invoices & Summary</p>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors flex items-center p-0.5 ${
                    preferences.emailEnabled ? 'bg-[#0066cc] justify-end' : 'bg-slate-300 justify-start'
                  }`}>
                    <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                  </div>
                </div>

                {/* WhatsApp */}
                <div
                  onClick={() => toggleField('whatsappEnabled')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    preferences.whatsappEnabled
                      ? 'border-emerald-200 bg-emerald-50/40 text-slate-900 shadow-2xs'
                      : 'border-slate-100 bg-slate-50/50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                      preferences.whatsappEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-none">WhatsApp</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Instant Tokens & Times</p>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors flex items-center p-0.5 ${
                    preferences.whatsappEnabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}>
                    <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                  </div>
                </div>

                {/* SMS */}
                <div
                  onClick={() => toggleField('smsEnabled')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    preferences.smsEnabled
                      ? 'border-purple-200 bg-purple-50/40 text-slate-900 shadow-2xs'
                      : 'border-slate-100 bg-slate-50/50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                      preferences.smsEnabled ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-none">SMS Text</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Direct Mobile SMS</p>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors flex items-center p-0.5 ${
                    preferences.smsEnabled ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}>
                    <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                  </div>
                </div>

                {/* In-App */}
                <div
                  onClick={() => toggleField('inAppEnabled')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    preferences.inAppEnabled
                      ? 'border-blue-200 bg-blue-50/40 text-slate-900 shadow-2xs'
                      : 'border-slate-100 bg-slate-50/50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                      preferences.inAppEnabled ? 'bg-blue-100 text-[#0066cc]' : 'bg-slate-200 text-slate-400'
                    }`}>
                      <Bell className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-none">In-App</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Live Portal Inbox</p>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors flex items-center p-0.5 ${
                    preferences.inAppEnabled ? 'bg-[#0066cc] justify-end' : 'bg-slate-300 justify-start'
                  }`}>
                    <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Topics */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Alert Categories
              </span>

              <div className="space-y-1.5">
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors text-xs font-medium text-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-[#0066cc]" />
                    <span>Appointment Reminders (24h, 2h, 30m)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.remindersEnabled}
                    onChange={() => toggleField('remindersEnabled')}
                    className="rounded text-[#0066cc] focus:ring-[#0066cc] h-4 w-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors text-xs font-medium text-slate-800">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-[#0066cc]" />
                    <span>Payment Receipts & Invoices</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.paymentAlertsEnabled}
                    onChange={() => toggleField('paymentAlertsEnabled')}
                    className="rounded text-[#0066cc] focus:ring-[#0066cc] h-4 w-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors text-xs font-medium text-slate-800">
                  <div className="flex items-center gap-2.5">
                    <RotateCcw className="w-4 h-4 text-[#0066cc]" />
                    <span>Refund Updates & Bank Credits</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.refundAlertsEnabled}
                    onChange={() => toggleField('refundAlertsEnabled')}
                    className="rounded text-[#0066cc] focus:ring-[#0066cc] h-4 w-4 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Compliance Note */}
            <div className="p-3 bg-slate-50 rounded-xl flex items-start gap-2 border border-slate-100">
              <ShieldCheck className="w-4 h-4 text-[#0066cc] shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-500 leading-tight">
                Critical transactional alerts (such as doctor cancellations, reschedule confirmations, and security notices) are always delivered.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="text-xs h-9 rounded-xl px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#0066cc] hover:bg-[#0055b3] text-white text-xs h-9 rounded-xl px-5 font-semibold flex items-center gap-1.5 shadow-xs"
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
