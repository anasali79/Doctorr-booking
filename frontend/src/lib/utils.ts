import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a date string 'YYYY-MM-DD' or ISO timestamp into readable 'dd MMM yyyy' */
export function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '';
  try {
    if (dateStr instanceof Date) {
      if (isNaN(dateStr.getTime())) return '';
      return dateStr.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }

    const str = String(dateStr).trim();
    if (!str) return '';

    // If it contains 'T' or time portion or is an ISO timestamp
    if (str.includes('T') || str.includes(':')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    }

    // Standard 'YYYY-MM-DD'
    const parts = str.split('-');
    if (parts.length >= 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = parseInt(parts[2], 10);
      if (year && month && day && !isNaN(day)) {
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }

    return str;
  } catch {
    return String(dateStr);
  }
}

/** Formats a date string or ISO timestamp into readable 'dd MMM yyyy, hh:mm AM/PM' */
export function formatDateTime(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '';
  try {
    const d = dateStr instanceof Date ? dateStr : new Date(String(dateStr));
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateStr);
  }
}

/** Formats 'HH:mm' 24h string or ISO timestamp into 12h AM/PM string (IST) */
export function formatTime(timeStr: string | Date | undefined | null): string {
  if (!timeStr) return '';
  try {
    if (timeStr instanceof Date) {
      if (isNaN(timeStr.getTime())) return '';
      return timeStr.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    const str = String(timeStr).trim();
    if (!str) return '';

    // If it's an ISO timestamp or date-time string (e.g. contains 'T' or '-')
    if (str.includes('T') || (str.includes('-') && str.includes(':'))) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
    }

    const [hoursStr, minutesStr] = str.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (isNaN(hours) || isNaN(minutes)) return str;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${formattedMinutes} ${ampm}`;
  } catch {
    return String(timeStr);
  }
}

/** Returns human-readable elapsed duration since check-in, e.g. '12m in clinic' or 'Just now' */
export function formatWaitDuration(checkedInAt: string | Date | undefined | null): string {
  if (!checkedInAt) return '';
  try {
    const d = checkedInAt instanceof Date ? checkedInAt : new Date(String(checkedInAt));
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return 'Just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m in clinic`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m in clinic`;
  } catch {
    return '';
  }
}

/** Format currency INR */
export function formatCurrency(amount: number | string | undefined | null): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount ?? 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

/** Returns today's date in IST (YYYY-MM-DD) */
export function getTodayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
