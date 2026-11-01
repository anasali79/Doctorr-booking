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
import { Badge } from '@/components/ui/badge';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { toast } from 'sonner';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  RefreshCw,
  Mail,
  MessageSquare,
  Smartphone,
  Bell,
} from 'lucide-react';
import { NotificationDeliveryItem, NotificationDeliveryStats } from '@/types';

interface NotificationMonitoringModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationMonitoringModal({
  open,
  onOpenChange,
}: NotificationMonitoringModalProps) {
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [stats, setStats] = useState<NotificationDeliveryStats | null>(null);
  const [deliveries, setDeliveries] = useState<NotificationDeliveryItem[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>('ALL');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, logsRes] = await Promise.all([
        clientAxios.get<{ data: NotificationDeliveryStats }>('/api/notifications/admin/stats'),
        clientAxios.get<{ data: NotificationDeliveryItem[] }>('/api/notifications/admin/logs?limit=30'),
      ]);

      if (statsRes.data?.data) setStats(statsRes.data.data);
      if (logsRes.data?.data) setDeliveries(logsRes.data.data);
    } catch (err: unknown) {
      toast.error('Could not load delivery logs', { description: extractErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const handleManualRetry = async (deliveryId: string) => {
    try {
      setRetryingId(deliveryId);
      const res = await clientAxios.post<{ success: boolean; message: string }>(
        `/api/notifications/admin/${deliveryId}/retry`,
      );
      if (res.data?.success) {
        toast.success('Retry triggered successfully');
        fetchData();
      } else {
        toast.error(res.data?.message || 'Retry failed');
      }
    } catch (err: unknown) {
      toast.error('Manual retry error', { description: extractErrorMessage(err) });
    } finally {
      setRetryingId(null);
    }
  };

  const filteredDeliveries =
    channelFilter === 'ALL'
      ? deliveries
      : deliveries.filter((d) => d.channel === channelFilter);

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL':
        return <Mail className="w-3.5 h-3.5 text-blue-600" />;
      case 'WHATSAPP':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />;
      case 'SMS':
        return <Smartphone className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">DELIVERED</Badge>;
      case 'SENT':
      case 'ACCEPTED':
        return <Badge className="bg-blue-100 text-blue-800 text-[10px] font-bold">{status}</Badge>;
      case 'RETRY_PENDING':
        return <Badge className="bg-amber-100 text-amber-800 text-[10px] font-bold">RETRY QUEUED</Badge>;
      case 'FAILED':
        return <Badge className="bg-rose-100 text-rose-800 text-[10px] font-bold">FAILED</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-800 text-[10px] font-bold">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-6 rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Multi-Channel Delivery Monitor
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="h-8 px-2.5 text-xs flex items-center gap-1.5 rounded-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Real-time delivery status, Twilio callback confirmations, and fault-tolerant retry queue.
          </DialogDescription>
        </DialogHeader>

        {loading && !stats ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs text-slate-500">Loading delivery telemetry...</span>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            {/* Telemetry KPI Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500">Total Dispatches</span>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{stats?.total ?? 0}</p>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Successful
                </span>
                <p className="text-xl font-bold text-emerald-700 mt-0.5">{stats?.successful ?? 0}</p>
              </div>

              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />
                  Retry Queued
                </span>
                <p className="text-xl font-bold text-amber-700 mt-0.5">{stats?.retryPending ?? 0}</p>
              </div>

              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                <span className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Failed
                </span>
                <p className="text-xl font-bold text-rose-700 mt-0.5">{stats?.failed ?? 0}</p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold text-slate-500 mr-2">Filter Channel:</span>
              {['ALL', 'EMAIL', 'WHATSAPP', 'SMS', 'IN_APP'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannelFilter(ch)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    channelFilter === ch
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>

            {/* Delivery Logs Table */}
            {filteredDeliveries.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No delivery logs recorded for the selected filter.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDeliveries.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-white transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-center shrink-0">
                        {getChannelIcon(item.channel)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 truncate">
                            {item.eventType.replace(/_/g, ' ')}
                          </span>
                          {getStatusBadge(item.status)}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span>To: <strong className="text-slate-700">{item.destination}</strong></span>
                          <span>•</span>
                          <span>Role: <strong>{item.recipientRole}</strong></span>
                          <span>•</span>
                          <span>Attempts: <strong>{item.retryCount}/{item.maxRetries}</strong></span>
                        </div>

                        {item.errorMessage && (
                          <p className="text-[11px] text-rose-600 font-medium mt-1">
                            Error: {item.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'FAILED' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleManualRetry(item.id)}
                          disabled={retryingId === item.id}
                          className="h-7 px-2 text-[11px] font-semibold rounded-lg flex items-center gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                        >
                          {retryingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

