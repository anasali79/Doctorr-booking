'use client';

import React, { useEffect, useRef } from 'react';

interface RibbonTypeProps {
  text?: string;
  speed?: number;
  ribbonWidth?: number;
  amplitude?: number;
  frequency?: number;
  fontSize?: number;
  ribbonColor?: string;
  textColor?: string;
  backgroundColor?: string;
  className?: string;
}

export function RibbonType({
  text = 'TRUSTED BY HEALTHCARE PROFESSIONALS • NHS GP SURGERIES • MODERN CLINICS • ZERO-WAIT CARE • VERIFIED SPECIALISTS • CAREUP HEALTH • ',
  speed = 1.2,
  ribbonWidth = 64,
  amplitude = 50,
  frequency = 1.05,
  fontSize = 22,
  ribbonColor = '#CFEDFD',
  textColor = '#004494',
  backgroundColor = '#FFFFFF',
  className = '',
}: RibbonTypeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let textOffset = 0;
    let wavePhase = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Handle high-DPI crisp rendering
    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height || 260;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Compute curve path points and tangents
    const getCurvePoint = (x: number, phase: number) => {
      const u = x / width;
      // Primary sine wave + subtle secondary harmonic for natural organic fabric folding
      const angle = u * Math.PI * 2 * frequency + phase;
      const y =
        height / 2 +
        Math.sin(angle) * amplitude +
        Math.sin(angle * 1.8 + 0.5) * (amplitude * 0.25);

      // Derivative dy/dx for tangent
      const dy =
        Math.cos(angle) * amplitude * ((Math.PI * 2 * frequency) / width) +
        Math.cos(angle * 1.8 + 0.5) *
        (amplitude * 0.25) *
        ((Math.PI * 2 * frequency * 1.8) / width);

      const tangent = Math.atan2(dy, 1);
      return { x, y, tangent };
    };

    // Pre-calculate sample points along the ribbon
    const SAMPLES = 240;

    const render = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Advance physics
      textOffset += speed;
      wavePhase += 0.008 * speed;

      // Build path points
      const points: Array<{
        x: number;
        y: number;
        tangent: number;
        topX: number;
        topY: number;
        botX: number;
        botY: number;
      }> = [];

      const step = (width + 160) / SAMPLES;
      const startX = -80;

      for (let i = 0; i <= SAMPLES; i++) {
        const x = startX + i * step;
        const p = getCurvePoint(x, wavePhase);

        // Normal perpendicular to tangent
        const nx = -Math.sin(p.tangent);
        const ny = Math.cos(p.tangent);

        const halfW = ribbonWidth / 2;
        points.push({
          ...p,
          topX: p.x - nx * halfW,
          topY: p.y - ny * halfW,
          botX: p.x + nx * halfW,
          botY: p.y + ny * halfW,
        });
      }

      // 1. Draw ribbon body with satin lighting gradient
      if (points.length > 1) {
        // Draw soft ambient shadow beneath ribbon for 3D depth on light backgrounds
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].topX, points[0].topY + 12);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].topX, points[i].topY + 12);
        }
        for (let i = points.length - 1; i >= 0; i--) {
          ctx.lineTo(points[i].botX, points[i].botY + 12);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
        ctx.fill();
        ctx.restore();

        // Create continuous mesh segments with satin lighting
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];

          // Compute lighting highlight based on curve slope / elevation
          const slopeFactor = Math.cos(p1.tangent * 1.5);
          const depthShade = Math.sin((p1.x / width) * Math.PI * 2 * frequency + wavePhase);

          // Satin sheen calculation
          const brightness = 1 + slopeFactor * 0.18 + depthShade * 0.12;

          ctx.beginPath();
          ctx.moveTo(p1.topX, p1.topY);
          ctx.lineTo(p2.topX, p2.topY);
          ctx.lineTo(p2.botX, p2.botY);
          ctx.lineTo(p1.botX, p1.botY);
          ctx.closePath();

          // Smooth gradient slice
          const sliceGrad = ctx.createLinearGradient(p1.topX, p1.topY, p1.botX, p1.botY);
          const isLightRibbon = ribbonColor.toLowerCase().includes('cfedfd') || ribbonColor.toLowerCase() === '#cfedfd';

          if (isLightRibbon) {
            // #CFEDFD Soft Satin Sky Palette
            if (brightness > 1.08) {
              // Highlight peak (lustrous glossy light)
              sliceGrad.addColorStop(0, '#E8F6FE');
              sliceGrad.addColorStop(0.35, '#F7FBFF');
              sliceGrad.addColorStop(0.7, '#CFEDFD');
              sliceGrad.addColorStop(1, '#BBE4FC');
            } else if (brightness < 0.92) {
              // Fold / shadow trough (soft deeper sky blue shadow)
              sliceGrad.addColorStop(0, '#92CEF7');
              sliceGrad.addColorStop(0.5, '#79C1F4');
              sliceGrad.addColorStop(1, '#60B4EE');
            } else {
              // Standard satin body
              sliceGrad.addColorStop(0, '#DAF0FE');
              sliceGrad.addColorStop(0.4, '#CFEDFD');
              sliceGrad.addColorStop(0.8, '#B8E2FB');
              sliceGrad.addColorStop(1, '#A0D5F9');
            }
          } else {
            // Royal / Purple-blue satin palette
            if (brightness > 1.1) {
              sliceGrad.addColorStop(0, '#5f75ff');
              sliceGrad.addColorStop(0.35, '#768aff');
              sliceGrad.addColorStop(0.7, '#4860ff');
              sliceGrad.addColorStop(1, '#344df5');
            } else if (brightness < 0.9) {
              sliceGrad.addColorStop(0, '#2339d6');
              sliceGrad.addColorStop(0.5, '#1e33c7');
              sliceGrad.addColorStop(1, '#1729a8');
            } else {
              sliceGrad.addColorStop(0, '#4a62ff');
              sliceGrad.addColorStop(0.4, '#556eff');
              sliceGrad.addColorStop(0.8, '#3b54fc');
              sliceGrad.addColorStop(1, '#2c45eb');
            }
          }

          ctx.fillStyle = sliceGrad;
          ctx.fill();
        }

        // Top & bottom subtle satin edge highlights (gives real 3D ribbon edge)
        const isLightRibbon = ribbonColor.toLowerCase().includes('cfedfd') || ribbonColor.toLowerCase() === '#cfedfd';

        ctx.beginPath();
        ctx.moveTo(points[0].topX, points[0].topY);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].topX, points[i].topY);
        }
        ctx.strokeStyle = isLightRibbon ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(points[0].botX, points[0].botY);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].botX, points[i].botY);
        }
        ctx.strokeStyle = isLightRibbon ? 'rgba(0, 102, 204, 0.22)' : 'rgba(10, 20, 80, 0.5)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // 2. Measure & render flowing text along the ribbon path
      ctx.font = `900 ${fontSize}px "Inter", "Helvetica Neue", system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      // Pre-compute cumulative arc length
      const arcLengths: number[] = [0];
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        arcLengths.push(arcLengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
      }
      const totalArcLength = arcLengths[arcLengths.length - 1];

      // Helper to interpolate position and tangent at distance s along the arc
      const getPosAtArc = (s: number) => {
        let lo = 0;
        let hi = arcLengths.length - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (arcLengths[mid] < s) lo = mid + 1;
          else hi = mid - 1;
        }
        const idx = Math.max(1, Math.min(lo, points.length - 1));
        const prev = points[idx - 1];
        const next = points[idx];
        const segLen = arcLengths[idx] - arcLengths[idx - 1];
        const t = segLen > 0 ? (s - arcLengths[idx - 1]) / segLen : 0;

        return {
          x: prev.x + (next.x - prev.x) * t,
          y: prev.y + (next.y - prev.y) * t,
          tangent: prev.tangent + (next.tangent - prev.tangent) * t,
        };
      };

      // Measure total string width and loop
      const fullText = text;
      const charWidths: number[] = [];
      let fullTextWidth = 0;
      for (let i = 0; i < fullText.length; i++) {
        const cw = ctx.measureText(fullText[i]).width;
        charWidths.push(cw);
        fullTextWidth += cw;
      }

      // Loop over characters to cover the entire visible ribbon
      const normOffset = textOffset % fullTextWidth;
      let currArc = -normOffset - fullTextWidth;

      while (currArc < totalArcLength + 80) {
        for (let i = 0; i < fullText.length; i++) {
          const char = fullText[i];
          const cw = charWidths[i];
          const charMidArc = currArc + cw / 2;

          if (charMidArc >= -20 && charMidArc <= totalArcLength + 20) {
            const pos = getPosAtArc(charMidArc);

            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(pos.tangent);

            // Text shadow for depth on ribbon
            if (isLightRibbon) {
              ctx.shadowColor = 'rgba(0, 55, 119, 0.15)';
              ctx.shadowBlur = 1;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 1;
            } else {
              ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
              ctx.shadowBlur = 4;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 1.5;
            }

            // Crisp bold letter
            ctx.fillStyle = textColor;
            ctx.fillText(char, 0, 0.5);

            ctx.restore();
          }

          currArc += cw;
        }
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [text, speed, ribbonWidth, amplitude, frequency, fontSize, ribbonColor, textColor]);

  const isLightRibbon = ribbonColor.toLowerCase().includes('cfedfd') || ribbonColor.toLowerCase() === '#cfedfd';

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none ${className}`}
      style={{ backgroundColor, minHeight: '220px' }}
    >
      {/* Ambient background glow for high-end aesthetic */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: isLightRibbon
            ? 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(207, 237, 253, 0.6), transparent 75%)'
            : 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(59, 130, 246, 0.18), transparent 75%)',
        }}
      />

      <canvas
        ref={canvasRef}
        className="relative z-10 block w-full h-full cursor-grab active:cursor-grabbing"
      />
    </div>
  );
}

