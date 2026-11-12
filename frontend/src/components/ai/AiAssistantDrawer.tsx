'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Trash2,
  AlertCircle,
  Mic,
  MicOff,
  Volume2,
  Maximize2,
  Minimize2,
  Radio,
} from 'lucide-react';
import { AiMessageList, ChatMessage } from './AiMessageList';
import { AiQuickActions } from './AiQuickActions';
import { AiFloatingTrigger } from './AiFloatingTrigger';
import { AiPaymentModal, PaymentOrderData } from './AiPaymentModal';
import { useVoiceAssistant } from '@/lib/hooks/useVoiceAssistant';
import { useRouter } from 'next/navigation';

interface AiAssistantDrawerProps {
  role: 'PATIENT' | 'DOCTOR';
  defaultOpen?: boolean;
}

export function AiAssistantDrawer({ role, defaultOpen = false }: AiAssistantDrawerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationLoadingId, setConfirmationLoadingId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>('');
  const [languagePreference, setLanguagePreference] = useState<'auto' | 'hi' | 'en'>('auto');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Dedicated Payment Modal State
  const [paymentModalData, setPaymentModalData] = useState<{
    isOpen: boolean;
    orderData: PaymentOrderData | null;
    doctorName?: string;
    fee?: number;
    date?: string;
    time?: string;
  }>({
    isOpen: false,
    orderData: null,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const handleSendMessageRef = useRef<(textToSend?: string) => Promise<void>>(async () => {});

  // Initialize voice hook
  const {
    voiceState,
    interimTranscript,
    isSupported: isVoiceSupported,
    errorMessage: voiceError,
    isContinuous,
    mutePatientNames,
    setMutePatientNames,
    startContinuousVoice,
    stopContinuousVoice,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoiceAssistant({
    languagePreference,
    onFinalTranscript: (transcript) => {
      handleSendMessageRef.current(transcript);
    },
    onSilenceTimeout: () => {
      setErrorBanner('2 minute silence ke baad voice session auto-off kar diya gaya.');
    },
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Send message implementation
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setErrorBanner(null);
    const userMsgId = String(Date.now());
    const newMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMsg]);
    if (!textToSend) setInputValue('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId || undefined,
          languagePreference,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            data.message ||
            'AI response lene me samasya aayi. Kripya dobara koshish karein.',
        );
      }

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: data.message,
        spokenSummary: data.spokenSummary,
        timestamp: new Date(),
        requiresConfirmation: data.requiresConfirmation,
        requiresPayment: Boolean(data.requiresPayment),
        confirmationId: data.confirmationId,
        expiresAt: data.expiresAt,
        actions: data.actions,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If continuous voice is active, speak the spokenSummary automatically
      if (isContinuous && data.spokenSummary) {
        speak(data.spokenSummary, data.language || 'hi');
      }

      // Automatically launch payment modal if payment is required
      const payAction = data.actions?.find((a: any) => a.type === 'PAY_NOW');
      if (payAction?.data?.orderData) {
        handleTriggerPayment({
          ...payAction.data,
          date: data.data?.date,
          time: data.data?.time,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error occurred.';
      setErrorBanner(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Open Dedicated Payment Modal
  const handleTriggerPayment = (actionData: any) => {
    const { orderData, doctorName, fee, date, time } = actionData || {};
    if (!orderData) return;

    setPaymentModalData({
      isOpen: true,
      orderData,
      doctorName: doctorName || 'Doctor',
      fee: fee || 500,
      date,
      time,
    });
  };

  // Payment Success Handler: Confirms appointment and speaks confirmation
  const handlePaymentSuccess = ({
    appointmentId,
    doctorName,
    date,
    time,
  }: {
    appointmentId: string;
    doctorName: string;
    date?: string;
    time?: string;
  }) => {
    const dateFormatted = date ? ` ${date} ko` : '';
    const timeFormatted = time ? ` ${time} baje` : '';
    const spokenText = `Payment successful! Dr. ${doctorName} ke saath aapka appointment${dateFormatted}${timeFormatted} confirm ho gaya hai.`;

    const confirmationContent = `🎉 **Payment Successful & Confirmed!**\n\n• **Doctor:** Dr. ${doctorName}\n• **Status:** Confirmed\n• **Appointment ID:** ${appointmentId}${
      date ? `\n• **Date:** ${date}` : ''
    }${time ? `\n• **Time:** ${time}` : ''}\n\nAapka appointment successfully book ho gaya hai!`;

    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        role: 'assistant',
        content: confirmationContent,
        spokenSummary: spokenText,
        timestamp: new Date(),
      },
    ]);

    // AI announces confirmation by voice!
    speak(spokenText, 'hi');

    router.refresh();
  };

  // Payment Failure Handler: Announces failure by voice and allows retry
  const handlePaymentFailure = (errorMsg: string) => {
    const spokenFail =
      'Aapka payment fail ho gaya hai. Aapka slot 15 minute ke liye hold hai, aap Pay button se dobara koshish kar sakte hain.';
    const failContent = `⚠️ **Payment Failed / Incomplete**\n\n${errorMsg}\n\nAapka slot **15 minute ke liye hold** hai. Aap neeche diye gaye button par click karke dobara payment complete kar sakte hain.`;

    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        role: 'assistant',
        content: failContent,
        spokenSummary: spokenFail,
        timestamp: new Date(),
        actions: paymentModalData.orderData
          ? [
              {
                type: 'PAY_NOW',
                label: `Retry Payment (Rs. ${paymentModalData.fee || 500})`,
                data: {
                  orderData: paymentModalData.orderData,
                  doctorName: paymentModalData.doctorName,
                  fee: paymentModalData.fee,
                },
              },
            ]
          : [],
      },
    ]);

    // AI announces failure by voice!
    speak(spokenFail, 'hi');
  };

  // Sync ref
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  });

  // Toggle Continuous Voice Mode
  const toggleContinuousVoice = () => {
    if (!isVoiceSupported) {
      setErrorBanner('Aapka browser Speech Recognition support nahi karta. Text chat use karein.');
      return;
    }

    if (isContinuous) {
      stopContinuousVoice();
    } else {
      startContinuousVoice();
    }
  };

  // Handle Confirmation
  const handleConfirmAction = async (confId: string) => {
    setConfirmationLoadingId(confId);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'haan confirm karo',
          conversationId,
          confirmationId: confId,
          confirmed: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Confirmation failed');
      }

      const assistantMsg: ChatMessage = {
        id: String(Date.now()),
        role: 'assistant',
        content: data.message,
        spokenSummary: data.spokenSummary,
        timestamp: new Date(),
        requiresConfirmation: false,
        requiresPayment: Boolean(data.requiresPayment),
        actions: data.actions,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (isContinuous && data.spokenSummary) {
        speak(data.spokenSummary, data.language || 'hi');
      }

      // Automatically launch payment modal if payment is required
      const payAction = data.actions?.find((a: any) => a.type === 'PAY_NOW');
      if (payAction?.data?.orderData) {
        handleTriggerPayment({
          ...payAction.data,
          date: data.data?.date,
          time: data.data?.time,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Confirmation execution failed.';
      setErrorBanner(msg);
    } finally {
      setConfirmationLoadingId(null);
    }
  };

  // Handle Cancel Action
  const handleCancelAction = async (confId: string) => {
    setConfirmationLoadingId(confId);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'cancel',
          conversationId,
          confirmationId: confId,
          confirmed: false,
        }),
      });

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: String(Date.now()),
        role: 'assistant',
        content: data.message || 'Operation cancel kar di gayi hai.',
        spokenSummary: 'Operation cancel kar di gayi hai.',
        timestamp: new Date(),
        requiresConfirmation: false,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (isContinuous) {
        speak('Operation cancel kar di gayi hai.', 'hi');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cancel failed.';
      setErrorBanner(msg);
    } finally {
      setConfirmationLoadingId(null);
    }
  };

  // Clear chat
  const handleClearChat = () => {
    stopSpeaking();
    stopListening();
    setMessages([]);
    setConversationId('');
    setErrorBanner(null);
  };

  const activeError = voiceError || errorBanner;

  const inputPlaceholder =
    languagePreference === 'en'
      ? 'Type in English (e.g. Is there any appointment for me?)...'
      : languagePreference === 'hi'
        ? 'यहाँ हिंदी में लिखें (जैसे: क्या आज मेरी कोई अपॉइंटमेंट है?)...'
        : 'Type here in Hindi, English ya Hinglish...';

  return (
    <>
      {/* Draggable Compact Floating Action Button */}
      {!isOpen && (
        <AiFloatingTrigger
          role={role}
          onClick={() => setIsOpen(true)}
          isVoiceActive={isContinuous}
        />
      )}

      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl transition-all duration-300 ${
            isExpanded
              ? 'inset-2 sm:inset-6 md:inset-10 rounded-2xl'
              : 'inset-x-2 bottom-2 h-[85dvh] max-h-[640px] max-w-[calc(100vw-1rem)] rounded-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[620px] sm:w-[420px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200/80 bg-zinc-50/80 px-3 sm:px-4 py-2.5 sm:py-3 dark:border-zinc-800 dark:bg-zinc-800/50 backdrop-blur-xs">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {role === 'DOCTOR' ? 'Doctor AI Assistant' : 'CareUp Patient Assistant'}
                  </h3>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Free
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate">
                  Zero Cost • Gemini Flash • Web Speech
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-zinc-500 shrink-0">
              {/* Language selection */}
              <select
                aria-label="Language preference"
                value={languagePreference}
                onChange={(e) =>
                  setLanguagePreference(e.target.value as 'auto' | 'hi' | 'en')
                }
                className="h-7 rounded border border-zinc-200 bg-white px-1 sm:px-1.5 text-[10px] sm:text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer max-w-[105px] sm:max-w-none"
              >
                <option value="auto">Auto (Hinglish)</option>
                <option value="en">English</option>
                <option value="hi">हिंदी</option>
              </select>

              {/* Clear */}
              <button
                type="button"
                onClick={handleClearChat}
                title="Clear conversation"
                className="rounded p-1 sm:p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              {/* Expand / Minimize */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Minimize' : 'Expand'}
                className="hidden sm:block rounded p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                {isExpanded ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  stopContinuousVoice();
                  setIsOpen(false);
                }}
                title="Close Assistant"
                className="rounded p-1 sm:p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Continuous Voice Session Control Bar (Section 11) */}
          <div className="flex items-center justify-between border-b border-zinc-100 bg-blue-50/50 px-4 py-2 text-xs dark:border-zinc-800 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleContinuousVoice}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-all cursor-pointer shadow-xs ${
                  isContinuous
                    ? 'bg-rose-600 text-white hover:bg-rose-700 animate-pulse'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isContinuous ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" />
                    <span>Voice OFF</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" />
                    <span>Voice ON (Continuous)</span>
                  </>
                )}
              </button>

              {/* Live Voice State Indicator */}
              {isContinuous && (
                <div className="flex items-center gap-1.5 font-medium">
                  {voiceState === 'LISTENING' && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Radio className="h-3.5 w-3.5 animate-pulse" />
                      Listening...
                    </span>
                  )}
                  {voiceState === 'THINKING' && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                      Thinking...
                    </span>
                  )}
                  {voiceState === 'SPEAKING' && (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Volume2 className="h-3.5 w-3.5 animate-bounce" />
                      Speaking...
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Spoken Privacy Toggle */}
            {role === 'DOCTOR' && (
              <label
                title="Do not speak patient names aloud"
                className="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={mutePatientNames}
                  onChange={(e) => setMutePatientNames(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>Mute Names</span>
              </label>
            )}
          </div>

          {/* Live Interim Transcript Bubble */}
          {interimTranscript && (
            <div className="border-b border-blue-200 bg-blue-50/80 px-4 py-2 text-xs italic text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
              &ldquo;{interimTranscript}&rdquo;...
            </div>
          )}

          {/* Error Banner if any */}
          {activeError && (
            <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              <span className="flex-1">{activeError}</span>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-rose-500 hover:text-rose-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Message History */}
          <AiMessageList
            messages={messages}
            isLoading={isLoading}
            language={languagePreference}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
            onPay={handleTriggerPayment}
            confirmationLoadingId={confirmationLoadingId}
          />

          {/* Quick Actions (Patient or Doctor prompts) */}
          <div className="border-t border-zinc-100 bg-zinc-50/50 px-3 dark:border-zinc-800/80 dark:bg-zinc-900/40 max-h-24 sm:max-h-28 overflow-y-auto">
            <AiQuickActions
              role={role}
              language={languagePreference}
              onSelect={(prompt) => handleSendMessage(prompt)}
              disabled={isLoading}
            />
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="border-t border-zinc-200 bg-white p-2.5 sm:p-3 dark:border-zinc-800 dark:bg-zinc-900 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))]"
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                disabled={isLoading}
                className="flex-1 min-w-0 rounded-xl border border-zinc-300/80 bg-white px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 shadow-2xs focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-400 dark:focus:border-blue-500 dark:focus:bg-zinc-800"
              />

              {/* Single Mic Button (Press to speak single query) */}
              <button
                type="button"
                title={
                  voiceState === 'LISTENING'
                    ? 'Stop listening'
                    : 'Click to speak (One-shot mode)'
                }
                onClick={() => {
                  if (voiceState === 'LISTENING') {
                    stopListening();
                  } else {
                    startListening();
                  }
                }}
                className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border transition cursor-pointer ${
                  voiceState === 'LISTENING'
                    ? 'border-rose-300 bg-rose-50 text-rose-600 animate-pulse'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>

              {/* Send button */}
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dedicated In-App Payment Checkout Modal */}
      {paymentModalData.isOpen && paymentModalData.orderData && (
        <AiPaymentModal
          isOpen={paymentModalData.isOpen}
          onClose={() =>
            setPaymentModalData((prev) => ({ ...prev, isOpen: false }))
          }
          orderData={paymentModalData.orderData}
          doctorName={paymentModalData.doctorName}
          fee={paymentModalData.fee}
          date={paymentModalData.date}
          time={paymentModalData.time}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailure={handlePaymentFailure}
        />
      )}
    </>
  );
}
