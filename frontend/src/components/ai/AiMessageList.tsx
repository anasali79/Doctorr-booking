'use client';

import React, { useEffect, useRef } from 'react';
import { Bot, User, Sparkles, CreditCard, Lock } from 'lucide-react';
import { AiConfirmationCard } from './AiConfirmationCard';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  spokenSummary?: string;
  timestamp: string | Date;
  requiresConfirmation?: boolean;
  requiresPayment?: boolean;
  data?: Record<string, unknown>;
  confirmationId?: string;
  expiresAt?: string;
  actions?: Array<{
    type: string;
    label: string;
    data?: Record<string, unknown>;
  }>;
}

interface AiMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  language?: 'auto' | 'hi' | 'en';
  onConfirm: (confirmationId: string) => void;
  onCancel: (confirmationId: string) => void;
  onPay?: (data: any) => void;
  confirmationLoadingId: string | null;
}

function renderInlineFormatting(text: string, isUser: boolean) {
  // Matches **bold**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2).trim();
      return (
        <strong
          key={index}
          className={
            isUser
              ? 'font-bold text-white'
              : 'font-semibold text-zinc-900 dark:text-zinc-50'
          }
        >
          {boldText}
        </strong>
      );
    }
    // Remove any remaining stray single asterisks
    const cleaned = part.replace(/(^|\s)\*(\S)/g, '$1$2').replace(/(\S)\*(\s|$)/g, '$1$2');
    return <React.Fragment key={index}>{cleaned}</React.Fragment>;
  });
}

function renderFormattedMessage(content: string, isUser: boolean) {
  if (isUser) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { text: string; num?: string }[] = [];

  const flushList = (key: number) => {
    if (currentList.length === 0) return;
    elements.push(
      <ul key={`list-${key}`} className="my-2 space-y-1.5 pl-1">
        {currentList.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 dark:bg-blue-400" />
            <span className="flex-1 leading-relaxed">
              {renderInlineFormatting(item.text, false)}
            </span>
          </li>
        ))}
      </ul>,
    );
    currentList = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Check if line is a bullet (*, -, •) or numbered list item
    const bulletMatch = trimmed.match(/^([*•\-]|(\d+\.))\s+(.*)$/);
    if (bulletMatch) {
      currentList.push({ text: bulletMatch[3], num: bulletMatch[2] });
      return;
    }

    // Flush any pending list before normal paragraph
    flushList(index);

    if (!trimmed) {
      elements.push(<div key={`space-${index}`} className="h-1.5" />);
      return;
    }

    elements.push(
      <p key={`p-${index}`} className="leading-relaxed">
        {renderInlineFormatting(line, false)}
      </p>,
    );
  });

  flushList(lines.length);

  return <div className="space-y-1 text-sm">{elements}</div>;
}

export function AiMessageList({
  messages,
  isLoading,
  language = 'auto',
  onConfirm,
  onCancel,
  onPay,
  confirmationLoadingId,
}: AiMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const emptyStateTexts = {
    en: {
      title: 'CareUp Free AI Assistant',
      desc: 'Ask anything about appointments, available doctor slots, rescheduling, or booking status in English.',
    },
    hi: {
      title: 'CareUp फ्री AI असिस्टेंट',
      desc: 'आप अपॉइंटमेंट, डॉक्टर के उपलब्ध स्लॉट, रीशेड्यूल या स्थिति के बारे में हिंदी में पूछ सकते हैं।',
    },
    auto: {
      title: 'CareUp Free AI Assistant',
      desc: 'Aap Hindi, English ya Hinglish me appointment, availability ya status ke baare me pooch sakte hain.',
    },
  };

  const currentEmptyText = emptyStateTexts[language] || emptyStateTexts.auto;

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-zinc-500">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">
          {currentEmptyText.title}
        </h3>
        <p className="mt-1 text-xs text-zinc-500 max-w-xs">
          {currentEmptyText.desc}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';

        return (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            {!isUser && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                isUser
                  ? 'bg-blue-600 text-white rounded-tr-xs'
                  : 'bg-white text-zinc-900 dark:bg-zinc-800/95 dark:text-zinc-100 rounded-tl-xs border border-zinc-200/80 dark:border-zinc-700/80'
              }`}
            >
              {renderFormattedMessage(msg.content, isUser)}

              {/* Confirmation card if required */}
              {!isUser && msg.requiresConfirmation && msg.confirmationId && (
                <AiConfirmationCard
                  confirmationId={msg.confirmationId}
                  expiresAt={msg.expiresAt}
                  data={msg.actions?.[0]?.data}
                  onConfirm={onConfirm}
                  onCancel={onCancel}
                  isLoading={confirmationLoadingId === msg.confirmationId}
                />
              )}

              {/* Payment Card for PAY_NOW actions */}
              {!isUser &&
                msg.actions?.map((act, idx) => {
                  if (act.type === 'PAY_NOW') {
                    const feeAmount =
                      act.data?.fee ||
                      (act.data?.orderData as any)?.amount
                        ? Number((act.data?.orderData as any)?.amount) / 100
                        : 500;

                    return (
                      <div
                        key={idx}
                        className="mt-3 rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30 text-zinc-800 dark:text-zinc-200"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span>Payment Required</span>
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                            Rs. {feeAmount}
                          </span>
                        </div>
                        <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mb-3">
                          Aapka slot 15 minute ke liye hold hai. Pay karke appointment confirm karein.
                        </p>
                        <button
                          type="button"
                          onClick={() => onPay?.(act.data)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#0052a3] active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>{act.label || `Pay Rs. ${feeAmount} & Confirm`}</span>
                        </button>
                      </div>
                    );
                  }
                  return null;
                })}

              <div
                className={`mt-1 text-[10px] ${
                  isUser ? 'text-blue-200 text-right' : 'text-zinc-400 text-left'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>

            {isUser && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-white mt-0.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex gap-2.5 justify-start">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          <div className="rounded-2xl rounded-tl-xs bg-zinc-100 px-4 py-3 text-sm text-zinc-500 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:0.4s]" />
              <span className="ml-1 text-xs text-zinc-400">
                {language === 'en'
                  ? 'Thinking...'
                  : language === 'hi'
                    ? 'सोच रहा हूँ...'
                    : 'Soch raha hoon...'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
