'use client';

import React from 'react';
import { RibbonType } from '@/components/ui/ribbon-type';

export function LandingLogoMarquee() {
  return (
    <section className="relative overflow-hidden py-4 sm:py-6 border-y border-[#1F3A4B]/10 bg-white">
      <div className="w-full">
        <RibbonType
          text="TRUSTED BY HEALTHCARE PROFESSIONALS • NHS GP SURGERIES • MODERN CLINICS • ZERO-WAIT CLINICAL QUEUES • CAREUP HEALTH • VERIFIED PRACTITIONERS • "
          speed={1.2}
          ribbonWidth={66}
          amplitude={46}
          frequency={1.05}
          fontSize={23}
          ribbonColor="#CFEDFD"
          textColor="#004494"
          backgroundColor="#FFFFFF"
          className="h-[200px] sm:h-[240px]"
        />
      </div>
    </section>
  );
}
