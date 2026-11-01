/**
 * Phone number normalization and validation for Vonage (Nexmo) SMS and WhatsApp APIs
 * Complies with E.164 and Indian National numbering standards
 */

export function normalizePhoneNumber(rawPhone: string, defaultCountryCode: string = '+91'): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return null;
  }

  // Remove whitespace, dashes, parens, dots
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, '').trim();

  // If already starts with '+', validate and return
  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.slice(1);
    if (/^\d{8,15}$/.test(digitsOnly)) {
      return cleaned;
    }
    return null;
  }

  // Handle leading '00' international prefix
  if (cleaned.startsWith('00')) {
    const formatted = `+${cleaned.slice(2)}`;
    if (/^\+[1-9]\d{7,14}$/.test(formatted)) {
      return formatted;
    }
  }

  // Handle leading '0' for Indian local format (e.g., 09876543210 -> +919876543210)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  // Standard 10-digit mobile number default to country code (+91)
  if (/^\d{10}$/.test(cleaned)) {
    const cc = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
    return `${cc}${cleaned}`;
  }

  // If digits length between 11 and 15 without plus, prepend '+'
  if (/^\d{11,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return null;
}

export function isValidE164(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  // ITU-T E.164: + followed by 1 to 15 digits, starting with 1-9
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Formats recipient phone for Vonage (Nexmo) SMS and Messages API (WhatsApp).
 * Vonage expects international digits without the leading '+': e.g. '917987087000' or '14155552671'
 */
export function toVonageRecipient(rawPhone: string): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  const normalized = normalizePhoneNumber(rawPhone);
  if (!normalized) return null;
  return normalized.replace(/^\+/, '');
}

/**
 * Extracts a standard 10-digit Indian mobile number
 */
export function toIndian10Digit(rawPhone: string): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  let digits = rawPhone.replace(/\D/g, '');

  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  }

  if (/^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  if (/^\d{10}$/.test(digits)) {
    return digits;
  }

  return null;
}

export function toMetaWhatsAppRecipient(rawPhone: string): string | null {
  return toVonageRecipient(rawPhone);
}

export function formatWhatsAppRecipient(e164Phone: string): string {
  if (e164Phone.startsWith('whatsapp:')) {
    return e164Phone;
  }
  return `whatsapp:${e164Phone}`;
}
