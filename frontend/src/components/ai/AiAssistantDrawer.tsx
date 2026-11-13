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
  GripHorizontal,
  History,
  Plus,
  MessageSquare,
  ChevronLeft,
  Clock,
  Loader2,
} from 'lucide-react';
import { AiMessageList, ChatMessage } from './AiMessageList';
import { AiQuickActions } from './AiQuickActions';
import { AiFloatingTrigger } from './AiFloatingTrigger';
import { AiPaymentModal, PaymentOrderData } from './AiPaymentModal';
import { useVoiceAssistant } from '@/lib/hooks/useVoiceAssistant';
import { useRouter } from 'next/navigation';

interface ConversationListItem {
  id: string;
  title: string;
  messageCount: number;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
}

function formatChatDate(dateString?: string | Date): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.getDate() === yesterday.getDate()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

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
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);

  // Chat History state
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Drag and drop state for floating window
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
  } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // Reset position if expanded
  useEffect(() => {
    if (isExpanded) {
      setPosition(null);
    }
  }, [isExpanded]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only allow drag if not clicking interactive buttons/inputs/selects and not expanded
    const target = e.target as HTMLElement;
    if (target.closest('button, select, input, a, textarea') || isExpanded) return;

    if (!windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: rect.left,
      posY: rect.top,
    };
    setIsDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current || !windowRef.current) return;
      const dx = moveEvent.clientX - dragRef.current.startX;
      const dy = moveEvent.clientY - dragRef.current.startY;

      const currentRect = windowRef.current.getBoundingClientRect();
      const width = currentRect.width;
      const height = currentRect.height;

      const maxX = Math.max(0, window.innerWidth - width - 8);
      const maxY = Math.max(0, window.innerHeight - height - 8);

      const nextX = Math.max(8, Math.min(maxX, dragRef.current.posX + dx));
      const nextY = Math.max(8, Math.min(maxY, dragRef.current.posY + dy));

      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

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
  const handleSendMessageRef = useRef<(textToSend?: string) => Promise<void>>(async () => { });

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
    setLastFailedText(null);

    // If retrying, remove the previous failed attempt of this text
    if (textToSend) {
      setMessages((prev) => prev.filter((m) => !(m.isFailed && m.content === textToSend)));
    }

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
        try {
          localStorage.setItem(`careup_ai_active_conv_${role}`, data.conversationId);
        } catch {}
        fetchConversations();
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
        data: data.data,
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
      setLastFailedText(text);
      // Mark message as failed so inline retry button appears
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsgId ? { ...m, isFailed: true } : m)),
      );
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

    const confirmationContent = `🎉 **Payment Successful & Confirmed!**\n\n• **Doctor:** Dr. ${doctorName}\n• **Status:** Confirmed\n• **Appointment ID:** ${appointmentId}${date ? `\n• **Date:** ${date}` : ''
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

  // Fetch list of user conversations
  const fetchConversations = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/ai/conversations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setConversations(data);
          try {
            localStorage.setItem(`careup_ai_history_${role}`, JSON.stringify(data));
          } catch {}
        }
      }
    } catch (e) {
      console.error('Failed to fetch past conversations', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Select and load a conversation
  const handleSelectConversation = async (convId: string) => {
    try {
      setIsLoading(true);
      setShowHistory(false);
      setErrorBanner(null);
      const res = await fetch(`/api/ai/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setConversationId(data.id);
        if (Array.isArray(data.messages)) {
          const loadedMsgs: ChatMessage[] = data.messages.map((m: any) => ({
            id: m.id || String(Math.random()),
            role: m.role,
            content: m.content,
            spokenSummary: m.spokenSummary,
            timestamp: new Date(m.timestamp || Date.now()),
            requiresConfirmation: m.requiresConfirmation,
            requiresPayment: m.requiresPayment,
            confirmationId: m.confirmationId,
            expiresAt: m.expiresAt,
            actions: m.actions,
            data: m.data,
          }));
          setMessages(loadedMsgs);
          try {
            localStorage.setItem(`careup_ai_active_conv_${role}`, convId);
          } catch {}
        }
      }
    } catch (e) {
      console.error('Failed to load conversation', e);
      setErrorBanner('Chat load karne me dikkat aayi.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start new chat
  const handleNewChat = () => {
    stopSpeaking();
    stopListening();
    setMessages([]);
    setConversationId('');
    setErrorBanner(null);
    setLastFailedText(null);
    setShowHistory(false);
    try {
      localStorage.removeItem(`careup_ai_active_conv_${role}`);
    } catch {}
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  // Delete a past conversation
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDeletingId(convId);
      const res = await fetch(`/api/ai/conversations/${convId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (conversationId === convId) {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Initial load effect: load conversation history and restore active session
  useEffect(() => {
    if (isOpen) {
      fetchConversations();
      try {
        const savedConvId = localStorage.getItem(`careup_ai_active_conv_${role}`);
        if (savedConvId && !conversationId && messages.length === 0) {
          handleSelectConversation(savedConvId);
        }
      } catch {}
    }
  }, [isOpen]);

  // Clear chat
  const handleClearChat = () => {
    handleNewChat();
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
          ref={windowRef}
          style={
            position && !isExpanded
              ? {
                left: `${position.x}px`,
                top: `${position.y}px`,
                right: 'auto',
                bottom: 'auto',
              }
              : undefined
          }
          className={`fixed z-50 flex flex-col overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl ${isDragging
            ? 'select-none transition-none shadow-3xl ring-2 ring-blue-500/40'
            : 'transition-all duration-300'
            } ${isExpanded
              ? 'inset-2 sm:inset-6 md:inset-10 rounded-2xl'
              : position
                ? 'h-[85dvh] max-h-[640px] w-[calc(100vw-1rem)] rounded-2xl sm:h-[620px] sm:w-[420px]'
                : 'inset-x-2 bottom-2 h-[85dvh] max-h-[640px] max-w-[calc(100vw-1rem)] rounded-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[620px] sm:w-[420px]'
            }`}
        >
          {/* Header (Drag Handle) */}
          <div
            onPointerDown={handlePointerDown}
            onDoubleClick={() => setPosition(null)}
            title={!isExpanded ? 'Drag to move window • Double-click to reset' : undefined}
            className={`flex items-center justify-between border-b border-zinc-200/80 bg-zinc-50/80 px-3 sm:px-4 py-2.5 sm:py-3 dark:border-zinc-800 dark:bg-zinc-800/50 backdrop-blur-xs select-none touch-none ${!isExpanded
              ? isDragging
                ? 'cursor-grabbing'
                : 'cursor-grab hover:bg-zinc-100/90 dark:hover:bg-zinc-800/80 transition-colors'
              : ''
              }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pointer-events-none">
              <GripHorizontal className="h-4 w-4 text-zinc-400 hidden sm:block shrink-0" />
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {role === 'DOCTOR' ? 'Doctor AI Assistant' : 'CareUp Patient Assistant'}
                  </h3>
                </div>
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

              {/* New Chat Button */}
              <button
                type="button"
                onClick={handleNewChat}
                title="Nayi chat shuru karein"
                className="rounded p-1 sm:p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer text-zinc-600 dark:text-zinc-300"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>

              {/* Chat History Button */}
              <button
                type="button"
                onClick={() => {
                  if (!showHistory) fetchConversations();
                  setShowHistory(!showHistory);
                }}
                title="Chat History / Purani Baatcheet"
                className={`rounded p-1 sm:p-1.5 transition cursor-pointer ${showHistory
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                  : 'text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 dark:text-zinc-300'
                  }`}
              >
                <History className="h-3.5 w-3.5" />
              </button>

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
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-all cursor-pointer shadow-xs ${isContinuous
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
              <span className="flex-1 truncate">{activeError}</span>
              {lastFailedText && (
                <button
                  type="button"
                  onClick={() => handleSendMessage(lastFailedText)}
                  className="rounded bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-rose-700 active:scale-95 transition-all cursor-pointer"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  setLastFailedText(null);
                }}
                className="text-rose-500 hover:text-rose-700 ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {showHistory ? (
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-900">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowHistory(false)}
                    className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition cursor-pointer"
                    title="Back to chat"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Chat History</span>
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold shadow-xs active:scale-95 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Chat</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <p className="text-xs">Loading conversations...</p>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 mb-2.5">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      Koi purani chat nahi mili
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">
                      Aapki saari baatcheet yahan save rahegi taaki aap kabhi bhi wapas dekh sakein.
                    </p>
                    <button
                      type="button"
                      onClick={handleNewChat}
                      className="mt-3.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
                    >
                      Nayi Chat Shuru Karein
                    </button>
                  </div>
                ) : (
                  conversations.map((conv) => {
                    const isActive = conv.id === conversationId;
                    return (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv.id)}
                        className={`group relative flex items-start justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${isActive
                          ? 'border-blue-500/80 bg-blue-50/70 dark:bg-blue-950/30 shadow-xs'
                          : 'border-zinc-200/80 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/80'
                          }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <MessageSquare
                              className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-zinc-400'
                                }`}
                            />
                            <span
                              className={`text-xs font-semibold truncate ${isActive
                                ? 'text-blue-700 dark:text-blue-300'
                                : 'text-zinc-800 dark:text-zinc-200'
                                }`}
                            >
                              {conv.title || 'Conversation'}
                            </span>
                            {isActive && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200 font-medium px-1.5 py-0.2 rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-1">
                              {conv.lastMessage}
                            </p>
                          )}
                          <div className="flex items-center gap-2.5 mt-2 text-[10px] text-zinc-400 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatChatDate(conv.updatedAt || conv.createdAt)}
                            </span>
                            <span>•</span>
                            <span>{conv.messageCount || 0} messages</span>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteConversation(conv.id, e)}
                          disabled={deletingId === conv.id}
                          title="Is chat ko delete karein"
                          className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                        >
                          {deletingId === conv.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-600" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Message History */}
              <AiMessageList
                messages={messages}
                isLoading={isLoading}
                language={languagePreference}
                onConfirm={handleConfirmAction}
                onCancel={handleCancelAction}
                onPay={handleTriggerPayment}
                onSelectPrompt={(prompt) => handleSendMessage(prompt)}
                onRetry={(text) => handleSendMessage(text)}
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
                    className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border transition cursor-pointer ${voiceState === 'LISTENING'
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
            </>
          )}
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
