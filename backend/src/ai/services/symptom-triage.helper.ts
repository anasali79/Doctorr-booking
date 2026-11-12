import {
  VALID_SPECIALIZATIONS,
  Specialization,
  isValidSpecialization,
  normalizeSpecialization,
} from '../../doctor/constants/specializations';

export interface SymptomTriageResult {
  primarySpecialization: Specialization;
  explanation: {
    en: string;
    hi: string;
  };
  isEmergency: boolean;
  emergencyNotice?: {
    en: string;
    hi: string;
  };
  urgencyLevel: 'emergency' | 'urgent' | 'routine';
}

const EMERGENCY_KEYWORDS = [
  'chest pain',
  'seene me dard',
  'chhati me dard',
  'heart attack',
  'unconscious',
  'behosh',
  'fainting',
  'cannot breathe',
  'saans nahi aa rahi',
  'breathing difficulty',
  'heavy bleeding',
  'bahut khoon',
  'stroke',
  'face drooping',
  'severe trauma',
  'severe accident',
  'sudden paralysis',
  'choking',
];

/**
 * Deterministic Safety Check for Life-Threatening Medical Emergencies.
 * Runs in parallel with AI judgment to ensure zero-risk safety net.
 */
export function checkEmergencyRedFlags(text: string): {
  isEmergency: boolean;
  emergencyNotice?: { en: string; hi: string };
} {
  const normalized = (text || '').toLowerCase();
  const isEmergency = EMERGENCY_KEYWORDS.some((kw) => normalized.includes(kw));

  if (!isEmergency) {
    return { isEmergency: false };
  }

  return {
    isEmergency: true,
    emergencyNotice: {
      en: '⚠️ Emergency Notice: Your described symptoms could indicate a critical condition. Please call 108/112 or visit the nearest Hospital Emergency Room immediately.',
      hi: '⚠️ Emergency Alert: Yeh lakshan serious ho sakte hain. Kripya bina deri kiye Emergency Helpline (108 / 112) par call karein ya nazdeeki Hospital Emergency me jayein.',
    },
  };
}

/**
 * AI-Driven Symptom Triage Helper.
 * Instead of maintaining brittle hardcoded keyword dictionaries,
 * this accepts the AI's clinical judgment of the target specialty,
 * validates it against the platform catalog, and adds emergency safeguards.
 */
export function triageSymptoms(
  symptomsText: string,
  aiSpecialization?: string,
): SymptomTriageResult {
  const emergencyCheck = checkEmergencyRedFlags(symptomsText);

  // Normalize AI determined specialization or fallback to general physician
  let targetSpec: Specialization = 'general physician';
  if (aiSpecialization && isValidSpecialization(aiSpecialization)) {
    targetSpec = normalizeSpecialization(aiSpecialization) as Specialization;
  } else if (!aiSpecialization && symptomsText) {
    // Quick fallback check for core vital systems if no AI specialty provided
    const lower = symptomsText.toLowerCase();
    if (lower.includes('heart') || lower.includes('seene') || lower.includes('chest') || lower.includes('dil')) {
      targetSpec = 'cardiologist';
    } else if (lower.includes('skin') || lower.includes('rash') || lower.includes('khujli') || lower.includes('pimple')) {
      targetSpec = 'dermatologist';
    } else if (lower.includes('sar dard') || lower.includes('headache') || lower.includes('migraine')) {
      targetSpec = 'neurologist';
    } else if (lower.includes('haddi') || lower.includes('bone') || lower.includes('joint') || lower.includes('ghutn')) {
      targetSpec = 'orthopedist';
    } else if (lower.includes('bachh') || lower.includes('baby') || lower.includes('child')) {
      targetSpec = 'pediatrician';
    } else if (lower.includes('kaan') || lower.includes('gala') || lower.includes('throat') || lower.includes('ear')) {
      targetSpec = 'ent specialist';
    } else if (lower.includes('aankh') || lower.includes('eye') || lower.includes('vision')) {
      targetSpec = 'ophthalmologist';
    }
  }

  return {
    primarySpecialization: targetSpec,
    explanation: {
      en: `Based on your described symptoms, a consultation with a ${targetSpec} is recommended.`,
      hi: `Aapke lakshan ke aadhar par ${targetSpec} se paramarsh (consultation) lena uchit rahega.`,
    },
    isEmergency: emergencyCheck.isEmergency,
    emergencyNotice: emergencyCheck.emergencyNotice,
    urgencyLevel: emergencyCheck.isEmergency ? 'emergency' : 'routine',
  };
}
