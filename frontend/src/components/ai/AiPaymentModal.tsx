'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Lock,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { launchRazorpayCheckout } from '@/lib/razorpay';
import { toast } from 'sonner';

export interface PaymentOrderData {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  appointmentId: string;
  expiresAt?: string;
}

export interface AiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: PaymentOrderData;
  doctorName?: string;
  fee?: number;
  date?: string;
  time?: string;
  userEmail?: string;
  onPaymentSuccess: (details: {
    appointmentId: string;
    doctorName: string;
    date?: string;
    time?: string;
    tokenNumber?: number;
  }) => void;
  onPaymentFailure: (errorMsg: string) => void;
}

export function AiPaymentModal({
  isOpen,
  onClose,
  orderData,
  doctorName = 'Doctor',
  fee = 500,
  date,
  time,
  userEmail,
  onPaymentSuccess,
  onPaymentFailure,
}: AiPaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 15-minute reservation countdown (default 15 mins = 900s)
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(900);

  useEffect(() => {
    if (!isOpen) return;

    // Reset status on open
    setPaymentStatus('IDLE');
    setErrorMessage(null);
    setIsProcessing(false);

    // If order has an expiresAt timestamp, compute remaining seconds
    if (orderData.expiresAt) {
      const remaining = Math.max(
        0,
        Math.floor((new Date(orderData.expiresAt).getTime() - Date.now()) / 1000),
      );
      setTimeLeftSeconds(remaining > 0 ? remaining : 900);
    } else {
      setTimeLeftSeconds(900);
    }

    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, orderData.expiresAt]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const amountInRupees = orderData.amount ? orderData.amount / 100 : fee;

  // 1. Pay with Razorpay Official Checkout
  const handleRazorpayPay = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      await launchRazorpayCheckout({
        orderData,
        doctorName,
        userEmail: userEmail || '',
        onSuccess: async ({ appointmentId }) => {
          setPaymentStatus('SUCCESS');
          setIsProcessing(false);
          toast.success('Payment Received & Confirmed!');
          setTimeout(() => {
            onPaymentSuccess({
              appointmentId,
              doctorName,
              date,
              time,
            });
            onClose();
          }, 1200);
        },
        onFailure: (err: any) => {
          setIsProcessing(false);
          setPaymentStatus('FAILED');
          const msg =
            err?.description ||
            err?.message ||
            'Payment complete nahi ho saka ya cancel ho gaya.';
          setErrorMessage(msg);
          onPaymentFailure(msg);
        },
        onDismiss: () => {
          setIsProcessing(false);
        },
      });
    } catch (err: unknown) {
      setIsProcessing(false);
      setPaymentStatus('FAILED');
      const msg = extractErrorMessage(err);
      setErrorMessage(msg);
      onPaymentFailure(msg);
    }
  };

  // 2. Instant Sandbox Test Payment (1-click for testing)
  const handleInstantSandboxPay = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await clientAxios.post<{
        success: boolean;
        message: string;
        appointmentId: string;
      }>('/api/payment/verify', {
        orderId: orderData.orderId,
        paymentId: `pay_mock_${Date.now()}`,
        signature: `mock_sig_${Date.now()}`,
        appointmentId: orderData.appointmentId,
      });

      setPaymentStatus('SUCCESS');
      setIsProcessing(false);
      toast.success('Sandbox Payment Verified!');

      setTimeout(() => {
        onPaymentSuccess({
          appointmentId: res.data?.appointmentId || orderData.appointmentId,
          doctorName,
          date,
          time,
        });
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setIsProcessing(false);
      setPaymentStatus('FAILED');
      const msg = extractErrorMessage(err);
      setErrorMessage(msg);
      onPaymentFailure(msg);
    }
  };

  // 3. Simulate Failure (For testing)
  const handleSimulateFailure = () => {
    setPaymentStatus('FAILED');
    const msg = 'User ne payment gateway cancel kar diya ya transaction fail hui.';
    setErrorMessage(msg);
    onPaymentFailure(msg);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-2xl dark:bg-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Complete Appointment Payment</h3>
              <p className="text-xs text-blue-100/90">CareUp Secure Consultation Checkout</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Reservation Timer Warning */}
          <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50">
            <div className="flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Slot Reserved For:</span>
            </div>
            <span className="font-mono font-bold text-amber-800 dark:text-amber-200 text-sm">
              {timeFormatted}
            </span>
          </div>

          {/* Appointment Summary Box */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/40 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Doctor</span>
              <span className="font-semibold text-zinc-900 dark:text-white text-sm">
                Dr. {doctorName}
              </span>
            </div>
            {date && (
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Date & Slot</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {date} {time ? `at ${time}` : ''}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-zinc-200/60 dark:border-zinc-700/60 pt-2 mt-2">
              <span className="font-medium text-zinc-600 dark:text-zinc-400">Total Consultation Fee</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                ₹{amountInRupees}
              </span>
            </div>
          </div>

          {/* Status Message Overlay if Success or Failed */}
          {paymentStatus === 'SUCCESS' && (
            <div className="rounded-xl bg-emerald-50 p-4 text-center border border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-1.5 animate-bounce" />
              <p className="font-bold text-sm">Payment Verified Successfully!</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                Appointment confirmed. AI assistant will speak your confirmation now.
              </p>
            </div>
          )}

          {paymentStatus === 'FAILED' && (
            <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200">
              <div className="flex items-center gap-2 font-bold text-sm text-rose-700 dark:text-rose-300 mb-1">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>Payment Incomplete / Failed</span>
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-300">
                {errorMessage || 'Aapka payment process nahi ho saka. Slot 15 minute ke liye hold hai, aap dobara try karein.'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {paymentStatus !== 'SUCCESS' && (
            <div className="space-y-2.5 pt-1">
              {/* Primary: Razorpay Gateway Checkout */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleRazorpayPay}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0066cc] px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-[#0052a3] active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing Secure Gateway...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Pay ₹{amountInRupees} via Razorpay (UPI / Card)</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Secondary: 1-Click Sandbox Test Pay (Guaranteed Zero-friction test) */}
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleInstantSandboxPay}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2.5 text-xs font-semibold dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <span>Instant Test Payment (Demo / Sandbox)</span>
              </button>

              {/* Tertiary: Simulate Failure (For testing edge-case voice announcement) */}
              <div className="flex justify-between items-center pt-2 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  256-Bit SSL Encrypted
                </span>
                <button
                  type="button"
                  onClick={handleSimulateFailure}
                  className="hover:underline hover:text-rose-500 transition-colors"
                >
                  Test Fail Simulation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

