'use client';

import React from 'react';
import StickerSlapFooter from '@/components/ui/sticker-slap-footer';

export function Footer() {
  return (
    <StickerSlapFooter
      wordmark="careup"
      homeHref="/"
      navLabel="doctors"
      navHref="/doctors"
      chatHref="/patient/dashboard"
      chatLabel="live queue tracker"
      jobsLabel="platform"
      jobs={[
        { title: "find doctors", href: "/doctors" },
        { title: "specialties & gps", href: "/doctors" },
        { title: "doctor portal", href: "/doctor/dashboard" },
        { title: "join as practitioner", href: "/signup" },
      ]}
      officeLabel="practice"
      address={[
        "careup health network",
        "london • edinburgh clinics",
        "zero-wait clinical orchestration",
      ]}
      mapLabel="view doctor directory →"
      mapHref="/doctors"
      contactLabel="support & emergency"
      email="support@careup.health"
      copiedLabel="email copied, we are here to help!"
      note="*in medical emergencies, call 999 or 112 immediately."
      paper="#FFFFFF"
      panel="#CCECFD"
      ink="#0f172a"
      cream="#ffffff"
      accent="#D1EEFE"
      height="auto"
      wordmarkMaxHeight="42svh"
    />
  );
}

export default Footer;
