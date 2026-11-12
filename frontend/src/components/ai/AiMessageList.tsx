'use client';

import React, { useEffect, useRef } from 'react';
import {
  Bot,
  User,
  Sparkles,
  CreditCard,
  Lock,
  Calendar,
  Clock,
  Stethoscope,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  FileText,
  Pill,
  ExternalLink,
} from 'lucide-react';
import { AiConfirmationCard } from './AiConfirmationCard';
import { DoctorRosterCard } from './DoctorRosterCard';
import { PatientClinicalDossierCard } from './PatientClinicalDossierCard';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  spokenSummary?: string;
  timestamp: string | Date;
  requiresConfirmation?: boolean;
  requiresPayment?: boolean;
  isFailed?: boolean;
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
  onSelectPrompt?: (prompt: string) => void;
  onRetry?: (text: string) => void;
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
    const cleaned = part
      .replace(/(^|\s)\*(\S)/g, '$1$2')
      .replace(/(\S)\*(\s|$)/g, '$1$2');
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

    // Bullet points: starts with * or - or •
    const bulletMatch = trimmed.match(/^[\*\-\•]\s+(.*)$/);
    if (bulletMatch) {
      currentList.push({ text: bulletMatch[1] });
      return;
    }

    // Numbered list: starts with 1., 2., etc.
    const numMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (numMatch) {
      currentList.push({ num: numMatch[1], text: numMatch[2] });
      return;
    }

    // If non-list line encountered, flush any pending list items
    flushList(index);

    if (!trimmed) {
      elements.push(<div key={`blank-${index}`} className="h-2" />);
      return;
    }

    // Headings: ###
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4
          key={`h4-${index}`}
          className="mt-3 mb-1 text-xs font-bold tracking-wide uppercase text-blue-900 dark:text-blue-300"
        >
          {renderInlineFormatting(trimmed.slice(4), false)}
        </h4>,
      );
      return;
    }

    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      elements.push(
        <h3
          key={`h3-${index}`}
          className="mt-3.5 mb-1.5 text-sm font-bold text-zinc-900 dark:text-zinc-100"
        >
          {renderInlineFormatting(trimmed.replace(/^#+\s*/, ''), false)}
        </h3>,
      );
      return;
    }

    // Normal paragraph line
    elements.push(
      <p key={`p-${index}`} className="my-1 leading-relaxed">
        {renderInlineFormatting(trimmed, false)}
      </p>,
    );
  });

  flushList(lines.length);
  return <div className="space-y-0.5">{elements}</div>;
}

export function AiMessageList({
  messages,
  isLoading,
  language = 'auto',
  onConfirm,
  onCancel,
  onPay,
  onSelectPrompt,
  onRetry,
  confirmationLoadingId,
}: AiMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const emptyStateTexts = {
    en: {
      title: 'CareUp Free AI Assistant',
      desc: 'Ask anything about symptoms, available doctor slots, appointments, schedule, or prescriptions in English.',
    },
    hi: {
      title: 'CareUp फ्री AI असिस्टेंट',
      desc: 'आप लक्षणों, डॉक्टर के उपलब्ध स्लॉट, शेड्यूल या प्रिस्क्रिप्शन के बारे में हिंदी में पूछ सकते हैं।',
    },
    auto: {
      title: 'CareUp Free AI Assistant',
      desc: 'Aap Hindi, English ya Hinglish me appointment, bimari ke lakshan, availability ya doctor schedule pooch sakte hain.',
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

        // Extract any structured doctor recommendations
        const rawDoctors = (msg.data?.doctors as any[]) || [];
        const hasDoctorCards = rawDoctors.length > 0;

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
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                isUser
                  ? 'bg-[#0066cc] text-white rounded-tr-xs'
                  : 'bg-white text-zinc-900 dark:bg-zinc-800/95 dark:text-zinc-100 rounded-tl-xs border border-zinc-200/80 dark:border-zinc-700/80'
              }`}
            >
              {renderFormattedMessage(msg.content, isUser)}

              {/* Confirmation card if required */}
              {!isUser && msg.requiresConfirmation && msg.confirmationId && (
                <AiConfirmationCard
                  confirmationId={msg.confirmationId}
                  expiresAt={msg.expiresAt}
                  data={
                    (msg.data as Record<string, unknown>) ||
                    (msg.actions?.[0]?.data as Record<string, unknown>)
                  }
                  onConfirm={onConfirm}
                  onCancel={onCancel}
                  isLoading={confirmationLoadingId === msg.confirmationId}
                />
              )}

              {/* Doctor Daily Schedule Roster Card */}
              {!isUser && (msg.data as any)?.dataType === 'DOCTOR_DAILY_SCHEDULE' && (
                <DoctorRosterCard
                  data={msg.data as any}
                  onSelectSummary={(patientName) =>
                    onSelectPrompt?.(`Give me clinical summary of ${patientName}`)
                  }
                />
              )}

              {/* Patient Clinical Dossier Card */}
              {!isUser && (msg.data as any)?.dataType === 'PATIENT_CLINICAL_SUMMARY' && (
                <PatientClinicalDossierCard
                  data={msg.data as any}
                  onSelectAction={onSelectPrompt}
                />
              )}

              {/* Rich Visual Doctor Recommendation Cards */}
              {!isUser && hasDoctorCards && (
                <div className="mt-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Recommended Doctors:</span>
                  </div>

                  {rawDoctors.map((doc: any, dIdx: number) => {
                    const nextSlot = doc.nextSlot;
                    const docCleanName = (doc.name || 'Doctor').replace(/^Dr\.?\s+/i, '');

                    return (
                      <div
                        key={dIdx}
                        className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-3 shadow-2xs dark:border-zinc-700/80 dark:bg-zinc-800/80 transition-all hover:border-blue-300 dark:hover:border-blue-700"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-extrabold text-sm dark:bg-blue-950 dark:text-blue-300">
                              {docCleanName.charAt(0) || 'D'}
                            </div>
                            <div>
                              <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 leading-tight">
                                Dr. {docCleanName}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="inline-block rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                  {doc.specialization}
                                </span>
                                {doc.experience ? (
                                  <span className="text-[10px] text-zinc-500">
                                    • {doc.experience} yrs exp
                                  </span>
                                ) : null}
                              </div>
                              {doc.clinic && (
                                <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                                  📍 {doc.clinic}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                              Rs. {doc.consultationFee ?? 500}
                            </span>
                          </div>
                        </div>

                        {/* Earliest Slot Pill */}
                        {nextSlot ? (
                          <div className="mt-2.5 flex items-center justify-between gap-1.5 rounded-lg bg-emerald-50/90 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Earliest Slot:</span>
                              <span className="font-bold">
                                {nextSlot.date} at {nextSlot.startTime}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 text-[10px] text-zinc-400 italic">
                            No immediate slots available.
                          </div>
                        )}

                        {/* Two Clear Actions: View Profile & Book Slot */}
                        <div className="mt-2.5 flex items-center gap-2">
                          <a
                            href={`/doctors/${doc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-100 hover:text-blue-600 transition-all dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            <span>View Profile</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>

                          {nextSlot && (
                            <button
                              type="button"
                              onClick={() =>
                                onSelectPrompt?.(
                                  `Book appointment with Dr. ${docCleanName} on ${nextSlot.date} at ${nextSlot.startTime}`,
                                )
                              }
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0066cc] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-[#0052a3] active:scale-95 transition-all cursor-pointer"
                            >
                              <span>Book Slot</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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

                  // Only show individual BOOK_DOCTOR_SLOT if we did not already render the rich doctor cards
                  if (act.type === 'BOOK_DOCTOR_SLOT' && !hasDoctorCards) {
                    const actionData = (act.data as any) || {};
                    const doctorName = actionData.doctorName || 'Doctor';
                    const date = actionData.date;
                    const startTime = actionData.startTime;
                    const fee = actionData.fee;

                    return (
                      <div
                        key={idx}
                        className="mt-2.5 rounded-xl border border-emerald-200/90 bg-emerald-50/80 p-3 shadow-2xs dark:border-emerald-900/60 dark:bg-emerald-950/40 text-zinc-800 dark:text-zinc-200"
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="flex items-center gap-1.5 font-bold text-emerald-950 dark:text-emerald-100">
                            <Stethoscope className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Dr. {doctorName}</span>
                          </span>
                          {fee !== undefined && (
                            <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                              Rs. {fee}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-zinc-600 dark:text-zinc-300 mb-2.5">
                          {date && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              <span>{date}</span>
                            </span>
                          )}
                          {startTime && (
                            <span className="inline-flex items-center gap-1 font-semibold text-zinc-800 dark:text-zinc-200">
                              <Clock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              <span>{startTime}</span>
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onSelectPrompt?.(
                              `Book appointment with Dr. ${doctorName} on ${date} at ${startTime}`,
                            )
                          }
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.98] transition-all cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500"
                        >
                          <span>Book This Slot</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  }

                  if (act.type === 'EXPLAIN_PRESCRIPTION') {
                    const actionData = (act.data as any) || {};
                    const docName = actionData.doctorName || 'Doctor';

                    return (
                      <div
                        key={idx}
                        className="mt-2.5 rounded-xl border border-indigo-200/90 bg-indigo-50/80 p-3 shadow-2xs dark:border-indigo-900/60 dark:bg-indigo-950/40 text-zinc-800 dark:text-zinc-200"
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-100">
                            <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Prescription: Dr. {docName}</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mb-2.5">
                          Dawaiyon ka schedule, time aur doctor ki advice aasan bhasha me samjhein.
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            onSelectPrompt?.(
                              `Dr. ${docName} ka prescription poora aasan bhasha me samjha do`,
                            )
                          }
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer dark:bg-indigo-600 dark:hover:bg-indigo-500"
                        >
                          <Pill className="h-3.5 w-3.5" />
                          <span>{act.label || `Dr. ${docName} ka prescription samjhao`}</span>
                        </button>
                      </div>
                    );
                  }
                  if (act.type === 'GET_PATIENT_SUMMARY') {
                    const actionData = (act.data as any) || (act as any).payload || {};
                    const patientName = actionData.patientName || act.label?.replace(/^Summary:\s*/i, '');

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          onSelectPrompt?.(`Give me clinical summary of ${patientName}`)
                        }
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-600 hover:text-white transition-all mr-2 cursor-pointer dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>{act.label}</span>
                      </button>
                    );
                  }
                  return null;
                })}

              <div
                className={`mt-1 text-[10px] ${
                  isUser ? 'text-blue-100 text-right' : 'text-zinc-400 text-left'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>

              {/* Inline Retry if message failed */}
              {isUser && msg.isFailed && (
                <div className="mt-1.5 flex items-center justify-end gap-1.5 text-xs text-rose-200 font-medium">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-300" />
                  <span className="text-[11px] text-rose-100">Send failed</span>
                  <button
                    type="button"
                    onClick={() => onRetry?.(msg.content)}
                    className="inline-flex items-center gap-1 rounded bg-white/20 hover:bg-white/30 px-2 py-0.5 text-[11px] font-bold text-white active:scale-95 cursor-pointer transition-all ml-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Retry</span>
                  </button>
                </div>
              )}
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
