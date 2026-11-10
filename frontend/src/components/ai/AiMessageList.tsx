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
  onConfirm: (confirmationId: string) => void;
  onCancel: (confirmationId: string) => void;
  onPay?: (data: any) => void;
  confirmationLoadingId: string | null;
}

export function AiMessageList({
  messages,
  isLoading,
  onConfirm,
  onCancel,
  onPay,
  confirmationLoadingId,
}: AiMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-zinc-500">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">
          CareUp Free AI Assistant
        </h3>
        <p className="mt-1 text-xs text-zinc-500 max-w-xs">
          Aap Hindi, English ya Hinglish me appointment, availability ya status ke baare me pooch sakte hain.
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
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-xs ${
                isUser
                  ? 'bg-blue-600 text-white rounded-tr-xs'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800/90 dark:text-zinc-100 rounded-tl-xs border border-zinc-200/60 dark:border-zinc-700/60'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

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
              <span className="ml-1 text-xs text-zinc-400">Soch raha hoon...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
