'use client';

import React, { useState, useEffect } from 'react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { formatDate, formatTime, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { launchRazorpayCheckout } from '@/lib/razorpay';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Loader2,
  Calendar,
  DollarSign,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PaymentItem {
  id: string;
  orderId: string;
  paymentId: string | null;
  amount: number;
  amountRefunded: number;
  currency: string;
  status: string;
  method: string | null;
  createdAt: string;
  appointment?: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    pendingExpiresAt?: string | null;
    doctor?: {
      id: string;
      fullName: string;
      specialization: string;
    };
  } | null;
  refunds?: Array<{
    id: string;
    providerRefundId: string | null;
    amount: number;
    status: string;
    reason: string | null;
    processedAt: string | null;
    createdAt: string;
  }>;
}

export function PatientPaymentsClient() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundTarget, setRefundTarget] = useState<PaymentItem | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await clientAxios.get<{
        message: string;
        data: PaymentItem[];
      }>('/api/payment/history');
      setPayments(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load payment history', { description: extractErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleOpenRefund = (payment: PaymentItem) => {
    setRefundTarget(payment);
    setRefundReason('');
  };

  const handleConfirmRefund = async () => {
    if (!refundTarget || !refundTarget.appointment) return;

    try {
      setRefunding(true);
      await clientAxios.post('/api/payment/refund', {
        appointmentId: refundTarget.appointment.id,
        paymentId: refundTarget.id,
        reason: refundReason || 'Patient requested cancellation refund',
        idempotencyKey: `rfnd_req_${refundTarget.id}_${Date.now()}`,
      });

      toast.success('Refund Initiated Successfully!', {
        description: 'Amount will be credited back to your original payment method in 5-7 business days.',
      });

      setRefundTarget(null);
      fetchPayments();
    } catch (err) {
      toast.error('Refund Request Failed', {
        description: extractErrorMessage(err),
      });
    } finally {
      setRefunding(false);
    }
  };

  const handleRetryPayment = async (p: PaymentItem) => {
    if (!p.appointment?.id) return;
    try {
      setRetryingId(p.id);
      const res = await clientAxios.post<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        appointmentId: string;
        expiresAt: string;
      }>('/api/payment/retry-order', {
        appointmentId: p.appointment.id,
      });

      const orderData = res.data;

      await launchRazorpayCheckout({
        orderData,
        doctorName: p.appointment?.doctor?.fullName || 'Doctor',
        onSuccess: () => {
          toast.success('Payment Received! Your appointment is confirmed.');
          fetchPayments();
        },
        onFailure: (err) => {
          toast.error('Payment Incomplete', {
            description: extractErrorMessage(err) || 'You can retry before the 15-minute reservation expires.',
          });
        },
      });
    } catch (err) {
      toast.error('Failed to retry payment', {
        description: extractErrorMessage(err),
      });
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Paid</Badge>;
      case 'REFUNDED':
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Refunded</Badge>;
      case 'PARTIALLY_REFUNDED':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Partially Refunded</Badge>;
      case 'PENDING':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Pending</Badge>;
      case 'FAILED':
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Failed</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Policy banner */}
      <Card className="rounded-2xl border border-blue-100 bg-[#f0f7ff] p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#0066cc] shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 leading-relaxed space-y-1">
            <p className="font-bold text-slate-900">CareUp Cancellation & Refund Policy</p>
            <p>
              Full refunds are granted when an appointment is cancelled at least 30 minutes prior to the consultation start time.
              Refunds are processed automatically and credited via Razorpay within 5–7 banking days.
            </p>
          </div>
        </div>
      </Card>

      {/* Payment Records */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#0066cc] mb-3" />
          <span className="text-xs font-medium">Loading payments…</span>
        </div>
      ) : payments.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No payment records found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            When you complete consultation bookings, receipts and refund statuses will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {payments.map((p) => {
            const amountInRupees = p.amount / 100;
            const remainingBalance = (p.amount - (p.amountRefunded || 0)) / 100;
            const isEligibleForRefund =
              p.status === 'COMPLETED' &&
              remainingBalance > 0 &&
              p.appointment?.status !== 'CANCELLED';

            return (
              <Card key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {p.appointment?.doctor?.fullName ? `Dr. ${p.appointment.doctor.fullName}` : 'Consultation Booking'}
                      </span>
                      {getStatusBadge(p.status)}
                    </div>

                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{p.appointment?.doctor?.specialization || 'General Consultation'}</span>
                      {p.appointment?.date && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(p.appointment.date)} at {formatTime(p.appointment.startTime)}
                          </span>
                        </>
                      )}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono pt-1">
                      <span>Order: {p.orderId}</span>
                      {p.paymentId && <span>Ref: {p.paymentId}</span>}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <div className="text-right">
                      <div className="text-base font-extrabold text-slate-900">
                        {formatCurrency(amountInRupees)}
                      </div>
                      {p.amountRefunded > 0 && (
                        <div className="text-[11px] font-semibold text-purple-600">
                          Refunded: {formatCurrency(p.amountRefunded / 100)}
                        </div>
                      )}
                    </div>

                    {isEligibleForRefund && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleOpenRefund(p)}
                        className="mt-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 px-3 rounded-lg border border-rose-200"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Cancel & Refund
                      </Button>
                    )}

                    {p.status === 'PENDING' && p.appointment && (
                      <div className="mt-2 flex flex-col items-end gap-1.5">
                        {p.appointment.pendingExpiresAt && new Date(p.appointment.pendingExpiresAt).getTime() > nowMs ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-700 animate-spin" />
                              {(() => {
                                const rem = Math.max(0, new Date(p.appointment.pendingExpiresAt!).getTime() - nowMs);
                                const m = Math.floor(rem / 60000);
                                const s = Math.floor((rem % 60000) / 1000);
                                return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} left`;
                              })()}
                            </span>
                            <Button
                              type="button"
                              onClick={() => handleRetryPayment(p)}
                              disabled={retryingId === p.id}
                              className="text-xs font-bold bg-[#0066cc] hover:bg-[#0052a3] text-white h-8 px-3 rounded-lg shadow-xs"
                            >
                              {retryingId === p.id ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <CreditCard className="w-3 h-3 mr-1" />
                              )}
                              Complete Payment
                            </Button>
                          </>
                        ) : (
                          <Badge className="bg-zinc-100 text-zinc-500 border-zinc-200 text-xs">
                            Expired (Slot Released)
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Refund records list if any */}
                {p.refunds && p.refunds.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Refund Activity
                    </span>
                    {p.refunds.map((rf) => (
                      <div key={rf.id} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(rf.amount / 100)}
                            </span>
                            <Badge className="text-[9px] bg-purple-50 text-purple-700 border-purple-200">
                              {rf.status}
                            </Badge>
                          </div>
                          {rf.reason && <p className="text-[11px] text-slate-500">{rf.reason}</p>}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {rf.providerRefundId || rf.id.substring(0, 12)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Refund Confirmation Modal */}
      <Dialog open={Boolean(refundTarget)} onOpenChange={(open) => !open && setRefundTarget(null)}>
        {refundTarget && (
          <DialogContent className="sm:max-w-[420px] rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                Cancel Appointment & Request Refund
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 my-2 text-xs text-slate-600">
              <p>
                Are you sure you want to cancel your consultation with{' '}
                <strong>{refundTarget.appointment?.doctor?.fullName || 'the Doctor'}</strong>?
              </p>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5">
                <div className="flex justify-between">
                  <span>Paid Amount:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(refundTarget.amount / 100)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Refundable Balance:</span>
                  <span>{formatCurrency((refundTarget.amount - (refundTarget.amountRefunded || 0)) / 100)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Cancellation (optional)
                </label>
                <Input type="text" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g. Schedule conflict, feeling better" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-hidden focus:border-[#0066cc] h-auto" />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRefundTarget(null)}
                disabled={refunding}
                className="btn-secondary flex-1 py-2.5 text-xs font-semibold rounded-xl h-auto"
              >
                Keep Appointment
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleConfirmRefund}
                disabled={refunding}
                className="bg-rose-600 hover:bg-rose-700 text-white flex-1 py-2.5 text-xs font-semibold rounded-xl h-auto"
              >
                {refunding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    Processing…
                  </>
                ) : (
                  'Confirm Refund'
                )}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

