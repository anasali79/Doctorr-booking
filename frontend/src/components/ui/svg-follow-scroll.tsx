"use client";

import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import React, { useRef } from "react";
import {
  Stethoscope,
  CalendarCheck,
  HeartPulse,
  FileText,
} from "lucide-react";

const journeySteps = [
  {
    step: "01",
    title: "Find Your Doctor",
    subtitle: "Discover Your Specialist",
    description: "Discover trusted healthcare specialists and verified NHS practitioners tailored to your medical needs.",
    highlight: "1,200+ Verified Specialists",
    icon: Stethoscope,
    // Desktop coordinates matching SVG curve (x: ~950, y: ~755)
    desktopStyle: "lg:absolute lg:top-[660px] lg:left-[760px] lg:w-[380px]",
  },
  {
    step: "02",
    title: "Book Your Appointment",
    subtitle: "Select Preferred Slot",
    description: "Choose your preferred date, pick a convenient consultation slot (10, 15, or 30 mins), and receive instant confirmation.",
    highlight: "Zero-Wait Queue Booking",
    icon: CalendarCheck,
    // Desktop coordinates matching SVG curve (x: ~840, y: ~1140)
    desktopStyle: "lg:absolute lg:top-[1060px] lg:left-[640px] lg:w-[380px]",
  },
  {
    step: "03",
    title: "Get Expert Care",
    subtitle: "Clinical Consultation",
    description: "Walk into the consulting cabin without waiting room delays or connect instantly via encrypted HD video.",
    highlight: "In-Clinic & Virtual Cabin",
    icon: HeartPulse,
    // Desktop coordinates matching SVG curve (x: ~80-130, y: ~1500)
    desktopStyle: "lg:absolute lg:top-[1460px] lg:left-[20px] lg:w-[380px]",
  },
  {
    step: "04",
    title: "Your Prescription",
    subtitle: "Digital Records & Rx",
    description: "Access your digital prescriptions, clinical notes, and treatment instructions anytime on your smartphone.",
    highlight: "Instant Digital Access",
    icon: FileText,
    // Desktop coordinates matching SVG curve (x: ~1050-1180, y: ~1950)
    desktopStyle: "lg:absolute lg:top-[1880px] lg:left-[820px] lg:w-[380px]",
  },
];

const Skiper19 = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
  });

  return (
    <section
      ref={ref}
      className="relative mx-auto flex min-h-[250vh] w-full max-w-full flex-col items-center overflow-hidden px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-[#1F3A4B] bg-white"
    >
      {/* Unified Coordinate Container: SVG line and cards share the exact same coordinate space */}
      <div className="relative w-full max-w-[1280px] mx-auto min-h-[2350px] flex flex-col items-center pb-16">

        {/* 1. Top Hero Typography (encircled by top loop of the SVG path) */}
        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center justify-center text-center pt-8 sm:pt-14 pb-12">
          {/* Small Category Label */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-[#1F3A4B]/15 bg-[#1F3A4B]/5 px-4 py-1.5 text-xs font-bold tracking-widest text-[#1F3A4B] uppercase mb-6"
          >
            <span className="h-2 w-2 rounded-full bg-[#1F3A4B] animate-pulse" />
            YOUR HEALTH, OUR PRIORITY
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-sans text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight text-[#1F3A4B] leading-[1.05]"
          >
            Better Care. <br />
            <span className="text-[#1F3A4B]">Smarter Appointments.</span>
          </motion.h1>

          {/* Supporting Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-sans text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-[#1F3A4B]/85 mt-6"
          >
            Every Step, Closer to Better Health.
          </motion.h2>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="font-sans max-w-2xl text-base sm:text-lg lg:text-xl text-[#1F3A4B]/75 leading-relaxed mt-4 font-normal"
          >
            From finding the right doctor to receiving your prescription, experience healthcare that moves with you.
          </motion.p>

          {/* Bottom Hint */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-10 inline-flex items-center gap-2 rounded-full border border-[#1F3A4B]/15 bg-white/70 px-5 py-2 text-xs font-bold tracking-widest text-[#1F3A4B] uppercase backdrop-blur-sm shadow-sm"
          >
            <span>SCROLL TO EXPLORE ↓</span>
          </motion.div>
        </div>

        {/* 2. Original Animated Green SVG Stroke – Centered in container so it passes exactly through each card and reaches the bottom card */}
        <LinePath
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 z-0 select-none"
          scrollYProgress={scrollYProgress}
        />

        {/* 3. The 4 Journey Cards (Positioned directly along the path of the animated line) */}
        <div className="w-full flex flex-col items-center gap-20 my-16 lg:my-0 lg:block">
          {journeySteps.map((s) => {
            const Icon = s.icon;

            return (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6 }}
                className={`w-full max-w-sm sm:max-w-md ${s.desktopStyle} relative z-10`}
              >
                <div
                  className="group relative rounded-3xl border border-[#1F3A4B]/15 p-6 sm:p-7 shadow-xl shadow-[#1F3A4B]/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#1F3A4B]/30 hover:shadow-2xl hover:shadow-[#1F3A4B]/10 bg-white/85"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Step Pill */}
                    <div
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#1F3A4B]/12 px-3.5 py-1 font-mono text-xs font-bold text-[#1F3A4B] transition-colors bg-white"
                    >
                      <span className="text-[#1F3A4B]/60">STEP</span>
                      <span className="text-[#1F3A4B] font-extrabold">{s.step}</span>
                    </div>

                    {/* Icon */}
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1F3A4B] text-[#D1EEFE] shadow-sm transition-transform duration-300 group-hover:scale-105">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="mt-5 space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#1F3A4B]/60 font-mono">
                      {s.subtitle}
                    </div>
                    <h3 className="font-sans text-xl sm:text-2xl font-bold text-[#1F3A4B]">
                      {s.title}
                    </h3>
                    <p className="font-sans text-sm text-[#1F3A4B]/75 leading-relaxed font-normal">
                      {s.description}
                    </p>
                  </div>

                  {/* Highlight footer */}
                  <div className="mt-5 pt-3.5 border-t border-[#1F3A4B]/10 flex items-center justify-between text-xs font-medium text-[#1F3A4B]/70">
                    <span className="font-semibold text-[#1F3A4B]">{s.highlight}</span>
                    <span className="font-mono text-[11px] text-[#1F3A4B]/50">CAREUP</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export { Skiper19 };
export const SvgFollowScroll = Skiper19;
export default Skiper19;

const LinePath = ({
  className,
  scrollYProgress,
}: {
  className: string;
  scrollYProgress: MotionValue<number>;
}) => {
  const pathLength = useTransform(scrollYProgress, [0, 1], [0.5, 1]);

  return (
    <svg
      width="1278"
      height="2670"
      viewBox="0 0 1278 2670"
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <motion.path
        d="M876.605 394.131C788.982 335.917 696.198 358.139 691.836 416.303C685.453 501.424 853.722 498.43 941.95 409.714C1016.1 335.156 1008.64 186.907 906.167 142.846C807.014 100.212 712.699 198.494 789.049 245.127C889.053 306.207 986.062 116.979 840.548 43.3233C743.932 -5.58141 678.027 57.1682 672.279 112.188C666.53 167.208 712.538 172.943 736.353 163.088C760.167 153.234 764.14 120.924 746.651 93.3868C717.461 47.4252 638.894 77.8642 601.018 116.979C568.164 150.908 557 201.079 576.467 246.924C593.342 286.664 630.24 310.55 671.68 302.614C756.114 286.446 729.747 206.546 681.86 186.442C630.54 164.898 492 209.318 495.026 287.644C496.837 334.494 518.402 366.466 582.455 367.287C680.013 368.538 771.538 299.456 898.634 292.434C1007.02 286.446 1192.67 309.384 1242.36 382.258C1266.99 418.39 1273.65 443.108 1247.75 474.477C1217.32 511.33 1149.4 511.259 1096.84 466.093C1044.29 420.928 1029.14 380.576 1033.97 324.172C1038.31 273.428 1069.55 228.986 1117.2 216.384C1152.2 207.128 1188.29 213.629 1194.45 245.127C1201.49 281.062 1132.22 280.104 1100.44 272.673C1065.32 264.464 1044.22 234.837 1032.77 201.413C1019.29 162.061 1029.71 131.126 1056.44 100.965C1086.19 67.4032 1143.96 54.5526 1175.78 86.1513C1207.02 117.17 1186.81 143.379 1156.22 166.691C1112.57 199.959 1052.57 186.238 999.784 155.164C957.312 130.164 899.171 63.7054 931.284 26.3214C952.068 2.12513 996.288 3.87363 1007.22 43.58C1018.15 83.2749 1003.56 122.644 975.969 163.376C948.377 204.107 907.272 255.122 913.558 321.045C919.727 385.734 990.968 497.068 1063.84 503.35C1111.46 507.456 1166.79 511.984 1175.68 464.527C1191.52 379.956 1101.26 334.985 1030.29 377.017C971.109 412.064 956.297 483.647 953.797 561.655C947.587 755.413 1197.56 941.828 936.039 1140.66C745.771 1285.32 321.926 950.737 134.536 1202.19C-6.68295 1391.68 -53.4837 1655.38 131.935 1760.5C478.381 1956.91 1124.19 1515 1201.28 1997.83C1273.66 2451.23 100.805 1864.7 303.794 2668.89"
        stroke="#D1EEFE"
        strokeWidth="20"
        style={{
          pathLength,
          strokeDashoffset: useTransform(pathLength, (value: number) => 1 - value),
          filter: "drop-shadow(0px 3px 10px rgba(0, 102, 204, 0.22))",
        }}
      />
    </svg>
  );
};
