"use client";
import React, { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react";

export type CollapsingCardItem = {
  idx: number;
  wordmark: string;
  tag?: string;
  badge?: string;
  title: string;
  subtitle?: string;
  desc?: string;
  features?: string[];
  metric?: string;
  img: string;
  ctaText?: string;
  ctaHref?: string;
};

const DEFAULT_CARDS: CollapsingCardItem[] = [
  {
    idx: 1,
    wordmark: "PACING",
    badge: "Real-time Math",
    title: "Smart Queue Velocity Estimator",
    subtitle: "Autonomous Consultation Pace Engine",
    desc: "Analyzes live doctor pacing, consultation complexity, and room turnarounds to provide realistic, dynamic wait estimations down to the minute.",
    features: [
      "Self-adjusting based on active consultation length",
      "Calculates delay buffer before alerting next patient",
      "Sends early warning if clinic is running ahead or behind",
    ],
    metric: "94% Prediction Accuracy",
    img: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80",
    ctaText: "Explore Pacing Engine",
    ctaHref: "/doctors",
  },
  {
    idx: 2,
    wordmark: "TRIAGE",
    badge: "Clinical Routing",
    title: "Specialist Triage & Department Matcher",
    subtitle: "Guided Clinical Routing",
    desc: "Helps patients immediately identify whether they need General Practice, Psychiatry, Pediatrics, Cardiology, or Orthopedic care before booking.",
    features: [
      "Matches common symptoms with certified doctors",
      "Prevents incorrect bookings and referral delays",
      "Supports GP secondary review notes",
    ],
    metric: "100% Specialist Alignment",
    img: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80",
    ctaText: "Find Right Specialist",
    ctaHref: "/doctors",
  },
  {
    idx: 3,
    wordmark: "SYNC",
    badge: "Sub-150ms Sync",
    title: "Real-Time Clinic & TV Queue Sync",
    subtitle: "Multi-Screen Broadcasting",
    desc: "Synchronizes patient queue tokens seamlessly across practitioner cabins, reception desks, and waiting room TV displays with under 150ms WebSocket latency.",
    features: [
      "Real-time audio-visual token chime announcements",
      "Instant walk-in & emergency insertion without collisions",
      "Live mobile tracking for waiting in car or cafe",
    ],
    metric: "< 150ms Instant Sync",
    img: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80",
    ctaText: "View Live Demo",
    ctaHref: "/doctors",
  },
];

export interface CollapsingCardsProps {
  cards?: CollapsingCardItem[];
  defaultActive?: number;
  className?: string;
  height?: string;
}

export function CollapsingCards({
  cards = DEFAULT_CARDS,
  defaultActive = 1,
  className = "",
  height = "560px",
}: CollapsingCardsProps) {
  const [activeIdx, setActiveIdx] = useState<number>(defaultActive);

  return (
    <div className={`relative w-full max-w-6xl mx-auto ${className}`}>
      <style>{CSS}</style>
      <div className="cc-cards-wrapper" style={{ minHeight: height }}>
        <div className="cc-cards">
          {cards.map((c) => {
            const isActive = activeIdx === c.idx;

            return (
              <div
                key={c.idx}
                className={`cc-card ${isActive ? "active" : ""}`}
                onMouseEnter={() => setActiveIdx(c.idx)}
                onClick={() => setActiveIdx(c.idx)}
                tabIndex={0}
                role="button"
                aria-expanded={isActive}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setActiveIdx(c.idx);
                  }
                }}
              >
                {/* Background Photo with gradient overlays */}
                <div
                  className="cc-img"
                  style={{ backgroundImage: `url('${c.img}')` }}
                />

                {/* Dark Vignette Overlay for Crisp Typography Contrast */}
                <div className="cc-overlay" />

                {/* Vertical Wordmark shown when collapsed */}
                <div className="cc-v-title font-mono">
                  <span>{c.wordmark}</span>
                </div>

                {/* Detailed Content shown when active/expanded */}
                <div className="cc-content">
                  {/* Top Header: Tag Badge */}
                  {c.tag && (
                    <div className="flex items-center justify-start">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/40 bg-sky-950/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-200 backdrop-blur-md">
                        <Sparkles className="h-3 w-3 text-sky-300" />
                        <span>{c.tag}</span>
                      </div>
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="cc-meta">
                    <div className="space-y-3 max-w-xl">
                      {c.subtitle && (
                        <div className="text-xs uppercase font-mono tracking-widest text-sky-300 font-semibold">
                          {c.subtitle}
                        </div>
                      )}

                      <h3 className="cc-title font-sans">
                        {c.title}
                      </h3>

                      {c.desc && (
                        <p className="cc-desc text-xs sm:text-sm text-slate-200/90 leading-relaxed font-normal">
                          {c.desc}
                        </p>
                      )}

                      {/* Feature Checklist */}
                      {c.features && c.features.length > 0 && (
                        <ul className="cc-features pt-2 space-y-1.5 border-t border-white/15">
                          {c.features.map((feat, fIdx) => (
                            <li
                              key={fIdx}
                              className="flex items-start gap-2 text-xs text-slate-100 font-medium"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Bottom Action Row */}
                    <div className="mt-5 pt-3.5 border-t border-white/20 flex flex-wrap items-center justify-between gap-3">
                      {c.metric ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-950/70 px-3 py-1.5 text-xs font-bold text-emerald-300 shadow-sm backdrop-blur-md">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          {c.metric}
                        </span>
                      ) : <div />}

                      <Link
                        href={c.ctaHref || "#"}
                        className="cc-cta inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-slate-900 shadow-lg shadow-black/30 transition-all hover:bg-sky-50 active:scale-95"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>{c.ctaText || "Explore"}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[#0066cc]" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CollapsingCards;

const CSS = `
.cc-cards-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  align-items: stretch;
}

.cc-cards {
  display: flex;
  gap: 14px;
  width: 100%;
  height: 560px;
}

.cc-card {
  position: relative;
  flex: 0.8;
  min-width: 96px;
  border-radius: 28px;
  overflow: hidden;
  cursor: pointer;
  transition: flex 0.75s cubic-bezier(0.2, 1, 0.3, 1), border-color 0.3s ease;
  will-change: flex;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.25);
  outline: none;
}

.cc-card:focus-visible {
  ring: 2px solid #0066cc;
}

.cc-card.active {
  flex: 3.2;
  border-color: rgba(0, 102, 204, 0.55);
  box-shadow: 0 20px 40px -15px rgba(0, 102, 204, 0.3);
}

.cc-img {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transform: scale(1.05);
  transition: transform 0.9s cubic-bezier(0.2, 1, 0.3, 1),
              filter 0.75s cubic-bezier(0.2, 1, 0.3, 1);
  filter: grayscale(35%) brightness(0.65);
}

.cc-card.active .cc-img {
  transform: scale(1);
  filter: grayscale(0%) brightness(0.85);
}

.cc-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(10, 16, 30, 0.92) 0%,
    rgba(10, 16, 30, 0.65) 45%,
    rgba(10, 16, 30, 0.25) 75%,
    rgba(10, 16, 30, 0.45) 100%
  );
  pointer-events: none;
}

.cc-content {
  position: relative;
  z-index: 2;
  height: 100%;
  padding: 28px;
  display: flex;
  flex-direction: column;
  color: #fff;
}

.cc-idx {
  font-size: 12px;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 700;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 4px 12px;
  border-radius: 999px;
  backdrop-filter: blur(8px);
}

.cc-v-title {
  position: absolute;
  left: 30px;
  bottom: 30px;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.95);
  transition: opacity 0.3s ease;
  z-index: 2;
  white-space: nowrap;
}

.cc-card.active .cc-v-title {
  opacity: 0;
  pointer-events: none;
}

.cc-meta {
  margin-top: auto;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.4s ease 0.15s,
              transform 0.5s cubic-bezier(0.2, 1, 0.3, 1) 0.15s;
  pointer-events: none;
}

.cc-card.active .cc-meta {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.cc-title {
  font-size: clamp(20px, 2.2vw, 28px);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: #ffffff;
}

.cc-desc {
  max-width: 52ch;
}

@media (max-width: 900px) {
  .cc-cards {
    height: 520px;
    gap: 10px;
  }
  .cc-card {
    min-width: 72px;
    border-radius: 22px;
  }
  .cc-content {
    padding: 20px;
  }
}

@media (max-width: 700px) {
  .cc-cards {
    flex-direction: column;
    height: 720px;
    gap: 10px;
  }
  .cc-card {
    flex: 0.8;
    min-height: 80px;
  }
  .cc-card.active {
    flex: 3.5;
  }
  .cc-v-title {
    writing-mode: horizontal-tb;
    transform: none;
    left: 20px;
    bottom: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cc-card, .cc-img, .cc-meta, .cc-v-title {
    transition-duration: 0.15s !important;
  }
}
`;
