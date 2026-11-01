import { NotificationEventType } from '../enums/notification-event-type.enum';
import { formatDate, formatTime } from '../../common/utils/appointment.utils';

export interface RenderedTemplate {
  title: string;
  inAppMessage: string;
  emailSubject: string;
  emailHtml: string;
  whatsAppText: string;
  smsText: string;
  note?: string | null;
  templateParams?: {
    patientName: string;
    doctorName: string;
    appointmentDate: string;
    appointmentTime: string;
    reference: string;
    amount: string;
    reason?: string;
  };
}

function safeString(val: any, fallback = ''): string {
  if (val === undefined || val === null) return fallback;
  return String(val).trim();
}

function formatCurrency(paise?: number): string {
  if (paise === undefined || paise === null || isNaN(paise)) return '₹0.00';
  return `₹${(paise / 100).toFixed(2)}`;
}

function buildBaseEmail(title: string, titleColor: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0066cc; padding: 20px 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px;">CareUp</h1>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #bae0fd; letter-spacing: 0.5px; text-transform: uppercase;">Healthcare Appointment System</p>
      </div>
      <div style="padding: 24px 24px 16px 24px;">
        <h2 style="color: ${titleColor}; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">${title}</h2>
        <div style="color: #334155; font-size: 14px; line-height: 1.6;">
          ${bodyHtml}
        </div>
        ${ctaLabel && ctaUrl ? `
          <div style="text-align: center; margin: 24px 0 8px 0;">
            <a href="${ctaUrl}" style="display: inline-block; padding: 11px 24px; background-color: #0066cc; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
              ${ctaLabel}
            </a>
          </div>
        ` : ''}
      </div>
      <div style="border-top: 1px solid #f1f5f9; padding: 16px 24px; background-color: #f8fafc; text-align: center;">
        <p style="margin: 0; font-size: 11px; color: #94a3b8;">This is an automated notification from CareUp. Please do not reply directly.</p>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">© ${new Date().getFullYear()} CareUp. All rights reserved.</p>
      </div>
    </div>
  `;
}

export function renderNotificationTemplate(
  eventType: NotificationEventType,
  data: Record<string, any>,
  recipientRole: 'PATIENT' | 'DOCTOR' | 'ADMIN',
  appBaseUrl: string = 'https://doctorbook-five.vercel.app',
): RenderedTemplate {
  const patientName = safeString(data.patientName, 'Patient');
  const doctorName = safeString(data.doctorName, 'Doctor');
  const spec = safeString(data.specialization, 'Specialist');
  const dateStr = data.appointmentDate ? formatDate(data.appointmentDate) : 'scheduled date';
  const timeStr = data.startTime ? formatTime(data.startTime) : 'scheduled time';
  const endTimeStr = data.endTime ? formatTime(data.endTime) : '';
  const token = data.tokenNumber ? `#${data.tokenNumber}` : '';
  const amountStr = data.amountFormatted || formatCurrency(data.amountInPaise);
  const refId = safeString(data.appointmentId || data.orderId || data.refundId || data.transactionId, 'N/A');

  const templateResult: Omit<RenderedTemplate, 'templateParams'> = (() => {
    switch (eventType) {
    // ─── APPOINTMENT CREATED / BOOKING REQUESTED ─────────────────────────────
    case NotificationEventType.APPOINTMENT_CREATED: {
      if (recipientRole === 'DOCTOR') {
        const title = 'New Appointment Booking';
        const msg = `New appointment booked by ${patientName} on ${dateStr} at ${timeStr}. Token: ${token || 'Pending'}.`;
        return {
          title,
          inAppMessage: msg,
          emailSubject: `New Appointment: ${patientName} on ${dateStr}`,
          emailHtml: buildBaseEmail(
            title,
            '#0066cc',
            `<p>Hello Dr. ${doctorName},</p>
             <p>A new appointment has been scheduled with you:</p>
             <div style="background-color: #f8fafc; border-left: 4px solid #0066cc; padding: 12px 16px; margin: 12px 0;">
               <p style="margin: 4px 0;"><strong>Patient:</strong> ${patientName}</p>
               <p style="margin: 4px 0;"><strong>Date:</strong> ${dateStr}</p>
               <p style="margin: 4px 0;"><strong>Time:</strong> ${timeStr}${endTimeStr ? ` - ${endTimeStr}` : ''}</p>
               ${token ? `<p style="margin: 4px 0;"><strong>Token:</strong> ${token}</p>` : ''}
             </div>`,
            'View Doctor Schedule',
            `${appBaseUrl}/doctor/appointments`,
          ),
          whatsAppText: `*CareUp Booking Alert*\n\nHello Dr. ${doctorName},\nA new appointment has been booked by *${patientName}* on *${dateStr}* at *${timeStr}*.\nToken: ${token || 'Assigned on arrival'}\nRef: ${refId}`,
          smsText: `CareUp: New booking by ${patientName} on ${dateStr} at ${timeStr}. Token: ${token || 'N/A'}. Ref: ${refId.slice(0, 8)}.`,
          note: token ? `Token ${token}` : null,
        };
      } else {
        const title = 'Appointment Request Received';
        const msg = `Your appointment request with Dr. ${doctorName} on ${dateStr} at ${timeStr} is received.`;
        return {
          title,
          inAppMessage: msg,
          emailSubject: `Appointment Received: Dr. ${doctorName}`,
          emailHtml: buildBaseEmail(
            title,
            '#0066cc',
            `<p>Hello ${patientName},</p>
             <p>Your appointment request with <strong>Dr. ${doctorName}</strong> (${spec}) has been received.</p>
             <div style="background-color: #f8fafc; border-left: 4px solid #0066cc; padding: 12px 16px; margin: 12px 0;">
               <p style="margin: 4px 0;"><strong>Doctor:</strong> Dr. ${doctorName} (${spec})</p>
               <p style="margin: 4px 0;"><strong>Date:</strong> ${dateStr}</p>
               <p style="margin: 4px 0;"><strong>Time:</strong> ${timeStr}</p>
               ${token ? `<p style="margin: 4px 0;"><strong>Token:</strong> ${token}</p>` : ''}
             </div>
             <p>Please arrive 5 minutes before your scheduled slot.</p>`,
            'View My Appointments',
            `${appBaseUrl}/patient/appointments`,
          ),
          whatsAppText: `*CareUp Booking Update*\n\nHello ${patientName},\nYour appointment request with *Dr. ${doctorName}* on *${dateStr}* at *${timeStr}* has been received.\nToken: ${token || 'Pending confirmation'}\nRef: ${refId}`,
          smsText: `CareUp: Appointment requested with Dr. ${doctorName} on ${dateStr} at ${timeStr}. Token: ${token || 'Pending'}. Ref: ${refId.slice(0, 8)}.`,
          note: 'Please arrive 5 minutes prior to scheduled slot.',
        };
      }
    }

    // ─── APPOINTMENT CONFIRMED ───────────────────────────────────────────────
    case NotificationEventType.APPOINTMENT_CONFIRMED: {
      const isDoc = recipientRole === 'DOCTOR';
      const title = isDoc ? 'Appointment Confirmed' : 'Appointment Confirmed! ✅';
      const msg = isDoc
        ? `Appointment confirmed with ${patientName} for ${dateStr} at ${timeStr}. Token: ${token}.`
        : `Your appointment with Dr. ${doctorName} on ${dateStr} at ${timeStr} is confirmed. Token: ${token}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Confirmed: Consultation with ${isDoc ? patientName : `Dr. ${doctorName}`}`,
        emailHtml: buildBaseEmail(
          title,
          '#16a34a',
          `<p>Hello ${isDoc ? `Dr. ${doctorName}` : patientName},</p>
           <p>The consultation on <strong>${dateStr}</strong> at <strong>${timeStr}</strong> is confirmed.</p>
           <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 12px 0;">
             <p style="margin: 4px 0;"><strong>${isDoc ? 'Patient' : 'Doctor'}:</strong> ${isDoc ? patientName : `Dr. ${doctorName} (${spec})`}</p>
             <p style="margin: 4px 0;"><strong>Date:</strong> ${dateStr}</p>
             <p style="margin: 4px 0;"><strong>Time:</strong> ${timeStr}</p>
             ${token ? `<p style="margin: 4px 0;"><strong>Token Number:</strong> ${token}</p>` : ''}
             <p style="margin: 4px 0;"><strong>Booking Reference:</strong> ${refId}</p>
           </div>
           <p>${isDoc ? 'Please review patient history in your clinical queue.' : 'Please arrive 5 minutes prior to your slot with any previous records.'}</p>`,
          isDoc ? 'Open Doctor Portal' : 'View Appointment & QR',
          isDoc ? `${appBaseUrl}/doctor/appointments` : `${appBaseUrl}/patient/appointments`,
        ),
        whatsAppText: `*CareUp Appointment Confirmed* ✅\n\nHello ${isDoc ? `Dr. ${doctorName}` : patientName},\nYour consultation on *${dateStr}* at *${timeStr}* is confirmed.\n${isDoc ? `Patient: *${patientName}*` : `Doctor: *Dr. ${doctorName}* (${spec})`}\nToken: *${token || 'Standard'}*\nRef: ${refId}`,
        smsText: `CareUp: Consultation confirmed for ${dateStr} at ${timeStr} with ${isDoc ? patientName : `Dr. ${doctorName}`}. Token: ${token || 'N/A'}. Ref: ${refId.slice(0, 8)}.`,
        note: token ? `Token ${token}` : 'Confirmed',
      };
    }

    // ─── APPOINTMENT PENDING ─────────────────────────────────────────────────
    case NotificationEventType.APPOINTMENT_PENDING: {
      const title = 'Appointment Pending Confirmation';
      const msg = `Your appointment with Dr. ${doctorName} is awaiting final slot confirmation.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Pending Confirmation: Consultation with Dr. ${doctorName}`,
        emailHtml: buildBaseEmail(
          title,
          '#d97706',
          `<p>Hello ${patientName},</p>
           <p>Your appointment with <strong>Dr. ${doctorName}</strong> on <strong>${dateStr}</strong> is currently pending confirmation.</p>
           <p>We will notify you immediately once the doctor or clinic finalizes your slot.</p>`,
          'Check Status',
          `${appBaseUrl}/patient/appointments`,
        ),
        whatsAppText: `*CareUp Update*\n\nHello ${patientName},\nYour appointment with *Dr. ${doctorName}* on *${dateStr}* at *${timeStr}* is awaiting confirmation.\nRef: ${refId}`,
        smsText: `CareUp: Your appointment with Dr. ${doctorName} on ${dateStr} is pending confirmation. Ref: ${refId.slice(0, 8)}.`,
      };
    }

    // ─── APPOINTMENT REJECTED ────────────────────────────────────────────────
    case NotificationEventType.APPOINTMENT_REJECTED: {
      const reason = safeString(data.cancelReason || data.rejectionReason, 'Doctor unavailable');
      const title = 'Appointment Request Declined';
      const msg = `Your appointment with Dr. ${doctorName} on ${dateStr} could not be confirmed: ${reason}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Appointment Update: Dr. ${doctorName}`,
        emailHtml: buildBaseEmail(
          title,
          '#dc2626',
          `<p>Hello ${patientName},</p>
           <p>Your appointment request with <strong>Dr. ${doctorName}</strong> on <strong>${dateStr}</strong> could not be accepted.</p>
           <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 12px 0;">
             <p style="margin: 4px 0;"><strong>Reason:</strong> ${reason}</p>
           </div>
           <p>If payment was collected, a full refund has been automatically initiated.</p>`,
          'Book Another Slot',
          `${appBaseUrl}/doctors`,
        ),
        whatsAppText: `*CareUp Update*\n\nHello ${patientName},\nYour appointment with *Dr. ${doctorName}* on *${dateStr}* was not accepted.\nReason: ${reason}\nAny paid fee is refunded automatically.`,
        smsText: `CareUp: Appointment with Dr. ${doctorName} on ${dateStr} could not be confirmed (${reason}). Any paid fees are refunded.`,
        note: reason,
      };
    }

    // ─── APPOINTMENT RESCHEDULED ─────────────────────────────────────────────
    case NotificationEventType.APPOINTMENT_RESCHEDULED: {
      const isDoc = recipientRole === 'DOCTOR';
      const prevDate = data.previousDate ? formatDate(data.previousDate) : 'original date';
      const prevTime = data.previousStartTime ? formatTime(data.previousStartTime) : 'original time';
      const title = 'Appointment Rescheduled 🗓️';
      const msg = isDoc
        ? `Appointment with ${patientName} moved from ${prevDate} ${prevTime} to ${dateStr} at ${timeStr}.`
        : `Your appointment with Dr. ${doctorName} was rescheduled from ${prevDate} to ${dateStr} at ${timeStr}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Rescheduled: Consultation with ${isDoc ? patientName : `Dr. ${doctorName}`}`,
        emailHtml: buildBaseEmail(
          title,
          '#2563eb',
          `<p>Hello ${isDoc ? `Dr. ${doctorName}` : patientName},</p>
           <p>The appointment has been successfully rescheduled:</p>
           <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 12px 0;">
             <p style="margin: 4px 0;"><strong>New Date:</strong> ${dateStr}</p>
             <p style="margin: 4px 0;"><strong>New Time:</strong> ${timeStr}</p>
             ${token ? `<p style="margin: 4px 0;"><strong>New Token:</strong> ${token}</p>` : ''}
             <p style="margin: 4px 0; color: #64748b;"><strong>Previous:</strong> <del>${prevDate} at ${prevTime}</del></p>
           </div>
           <p>Reminders have been updated automatically.</p>`,
          'View Updated Schedule',
          isDoc ? `${appBaseUrl}/doctor/appointments` : `${appBaseUrl}/patient/appointments`,
        ),
        whatsAppText: `*CareUp Rescheduled* 🗓️\n\nHello ${isDoc ? `Dr. ${doctorName}` : patientName},\nAppointment rescheduled to *${dateStr}* at *${timeStr}*.\nPrevious: ${prevDate} at ${prevTime}\nToken: *${token || 'N/A'}*\nRef: ${refId}`,
        smsText: `CareUp: Appointment rescheduled to ${dateStr} at ${timeStr} with ${isDoc ? patientName : `Dr. ${doctorName}`}. Prev: ${prevDate}. Token: ${token || 'N/A'}.`,
        note: `Moved to ${dateStr} at ${timeStr}`,
      };
    }

    // ─── APPOINTMENT CANCELLED BY PATIENT ─────────────────────────────────────
    case NotificationEventType.APPOINTMENT_CANCELLED_BY_PATIENT: {
      const isDoc = recipientRole === 'DOCTOR';
      const title = 'Appointment Cancelled by Patient';
      const msg = isDoc
        ? `Patient ${patientName} cancelled their appointment for ${dateStr} at ${timeStr}.`
        : `You cancelled your appointment with Dr. ${doctorName} for ${dateStr} at ${timeStr}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Cancellation: Consultation on ${dateStr}`,
        emailHtml: buildBaseEmail(
          title,
          '#e11d48',
          `<p>Hello ${isDoc ? `Dr. ${doctorName}` : patientName},</p>
           <p>The appointment on <strong>${dateStr}</strong> at <strong>${timeStr}</strong> has been cancelled by the patient.</p>
           <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 12px 16px; margin: 12px 0;">
             <p style="margin: 4px 0;"><strong>${isDoc ? 'Patient' : 'Doctor'}:</strong> ${isDoc ? patientName : `Dr. ${doctorName}`}</p>
             <p style="margin: 4px 0;"><strong>Scheduled Slot:</strong> ${dateStr} at ${timeStr}</p>
             ${data.cancelReason ? `<p style="margin: 4px 0;"><strong>Reason:</strong> ${data.cancelReason}</p>` : ''}
           </div>`,
          isDoc ? 'View Schedule' : 'Book a New Appointment',
          isDoc ? `${appBaseUrl}/doctor/appointments` : `${appBaseUrl}/doctors`,
        ),
        whatsAppText: `*CareUp Cancellation Notice*\n\nHello ${isDoc ? `Dr. ${doctorName}` : patientName},\nAppointment on *${dateStr}* at *${timeStr}* was cancelled by the patient.\nRef: ${refId}`,
        smsText: `CareUp: Appointment on ${dateStr} at ${timeStr} cancelled by patient. Ref: ${refId.slice(0, 8)}.`,
      };
    }

    // ─── APPOINTMENT CANCELLED BY DOCTOR ─────────────────────────────────────
    case NotificationEventType.APPOINTMENT_CANCELLED_BY_DOCTOR: {
      const isDoc = recipientRole === 'DOCTOR';
      const title = 'Appointment Cancelled by Doctor';
      const msg = isDoc
        ? `You cancelled the appointment with ${patientName} for ${dateStr} at ${timeStr}.`
        : `Dr. ${doctorName} cancelled your appointment for ${dateStr} at ${timeStr}. Automatic refund initiated if applicable.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Appointment Cancelled: Dr. ${doctorName}`,
        emailHtml: buildBaseEmail(
          title,
          '#e11d48',
          `<p>Hello ${isDoc ? `Dr. ${doctorName}` : patientName},</p>
           <p>${isDoc ? 'You have cancelled the appointment:' : `We regret to inform you that <strong>Dr. ${doctorName}</strong> had to cancel the consultation:`}</p>
           <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 12px 16px; margin: 12px 0;">
             <p style="margin: 4px 0;"><strong>Date:</strong> ${dateStr} at ${timeStr}</p>
             ${data.cancelReason ? `<p style="margin: 4px 0;"><strong>Reason:</strong> ${data.cancelReason}</p>` : ''}
           </div>
           <p>${isDoc ? 'Affected slot released.' : 'If you paid a consultation fee, an automatic full refund has been triggered to your original payment method.'}</p>`,
          isDoc ? 'View Appointments' : 'Find Another Doctor',
          isDoc ? `${appBaseUrl}/doctor/appointments` : `${appBaseUrl}/doctors`,
        ),
        whatsAppText: `*CareUp Notice*\n\nHello ${isDoc ? `Dr. ${doctorName}` : patientName},\nAppointment on *${dateStr}* at *${timeStr}* was cancelled by the doctor.\n${!isDoc ? 'Automatic refund initiated for any paid fee.\n' : ''}Ref: ${refId}`,
        smsText: `CareUp: Appointment with Dr. ${doctorName} on ${dateStr} cancelled by doctor. Automatic refund initiated if paid.`,
      };
    }

    // ─── APPOINTMENT CANCELLED BY ADMIN ──────────────────────────────────────
    case NotificationEventType.APPOINTMENT_CANCELLED_BY_ADMIN: {
      const title = 'Appointment Cancelled (Admin)';
      const msg = `Appointment on ${dateStr} at ${timeStr} was cancelled by system administration.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Administrative Notice: Appointment Cancelled`,
        emailHtml: buildBaseEmail(
          title,
          '#64748b',
          `<p>Hello,</p>
           <p>The appointment scheduled on <strong>${dateStr}</strong> at <strong>${timeStr}</strong> has been cancelled by administration.</p>`,
          'Support Desk',
          `${appBaseUrl}/support`,
        ),
        whatsAppText: `*CareUp Administrative Notice*\n\nAppointment on *${dateStr}* at *${timeStr}* cancelled by admin.\nRef: ${refId}`,
        smsText: `CareUp: Appointment on ${dateStr} at ${timeStr} cancelled by admin. Contact support if needed.`,
      };
    }

    // ─── APPOINTMENT COMPLETED ───────────────────────────────────────────────
    case NotificationEventType.APPOINTMENT_COMPLETED: {
      const title = 'Consultation Completed ✅';
      const msg = `Your consultation with Dr. ${doctorName} has been marked completed. Thank you for visiting!`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Completed: Consultation with Dr. ${doctorName}`,
        emailHtml: buildBaseEmail(
          title,
          '#16a34a',
          `<p>Hello ${patientName},</p>
           <p>Your consultation with <strong>Dr. ${doctorName}</strong> on <strong>${dateStr}</strong> has concluded.</p>
           <p>Thank you for choosing CareUp. You can view your visit records and summary in your patient dashboard.</p>`,
          'View Visit Details',
          `${appBaseUrl}/patient/appointments`,
        ),
        whatsAppText: `*CareUp Consultation Completed* ✅\n\nHello ${patientName},\nYour visit with *Dr. ${doctorName}* on *${dateStr}* is marked completed. Thank you for choosing CareUp!`,
        smsText: `CareUp: Consultation with Dr. ${doctorName} on ${dateStr} marked completed. Thank you for choosing CareUp!`,
      };
    }

    // ─── APPOINTMENT EXPIRED ─────────────────────────────────────────────────
    case NotificationEventType.APPOINTMENT_EXPIRED: {
      const title = 'Booking Window Expired ⏳';
      const msg = `Your reservation for Dr. ${doctorName} on ${dateStr} expired because payment or confirmation was not completed in time.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Reservation Expired: Dr. ${doctorName}`,
        emailHtml: buildBaseEmail(
          title,
          '#f59e0b',
          `<p>Hello ${patientName},</p>
           <p>Your 15-minute slot reservation with <strong>Dr. ${doctorName}</strong> on <strong>${dateStr}</strong> at <strong>${timeStr}</strong> has expired.</p>
           <p>The slot has been released. You may choose another available slot anytime.</p>`,
          'Select New Slot',
          `${appBaseUrl}/doctors`,
        ),
        whatsAppText: `*CareUp Notice* ⏳\n\nHello ${patientName},\nYour reservation with *Dr. ${doctorName}* for *${dateStr}* has expired. The slot is released. You can book again anytime!`,
        smsText: `CareUp: Slot reservation with Dr. ${doctorName} for ${dateStr} expired. Please visit ${appBaseUrl} to select a new slot.`,
      };
    }

    // ─── APPOINTMENT REMINDERS (24H, 2H, 30M) ───────────────────────────────
    case NotificationEventType.APPOINTMENT_REMINDER_24H:
    case NotificationEventType.APPOINTMENT_REMINDER_2H:
    case NotificationEventType.APPOINTMENT_REMINDER_30M: {
      const label =
        eventType === NotificationEventType.APPOINTMENT_REMINDER_24H
          ? 'tomorrow'
          : eventType === NotificationEventType.APPOINTMENT_REMINDER_2H
          ? 'in 2 hours'
          : 'in 30 minutes';
      const title = `Appointment Reminder (${label}) ⏰`;
      const msg = `Reminder: Your appointment with Dr. ${doctorName} is ${label} at ${timeStr}. Token: ${token || 'Standard'}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Reminder: Appointment ${label} with Dr. ${doctorName}`,
        emailHtml: buildBaseEmail(
          title,
          '#0066cc',
          `<p>Hello ${patientName},</p>
           <p>Friendly reminder: your appointment with <strong>Dr. ${doctorName}</strong> (${spec}) is scheduled <strong>${label}</strong>.</p>
           <div style="background-color: #f8fafc; border-left: 4px solid #0066cc; padding: 12px 16px; margin: 12px 0;">
             <p style="margin: 4px 0;"><strong>Date:</strong> ${dateStr}</p>
             <p style="margin: 4px 0;"><strong>Time:</strong> ${timeStr}</p>
             ${token ? `<p style="margin: 4px 0;"><strong>Token:</strong> ${token}</p>` : ''}
           </div>
           <p>Please arrive 5 minutes before your time to complete QR check-in.</p>`,
          'View QR & Check-In',
          `${appBaseUrl}/patient/appointments`,
        ),
        whatsAppText: `*CareUp Appointment Reminder* ⏰\n\nHello ${patientName},\nYour consultation with *Dr. ${doctorName}* is *${label}* (*${dateStr}* at *${timeStr}*).\nToken: *${token || 'Standard'}*\nPlease arrive 5 min early.\nRef: ${refId}`,
        smsText: `CareUp Reminder: Appointment with Dr. ${doctorName} is ${label} at ${timeStr}. Token: ${token || 'N/A'}. Arrive 5m early.`,
        note: `Slot: ${timeStr} (${label})`,
      };
    }

    // ─── PAYMENT INITIATED ───────────────────────────────────────────────────
    case NotificationEventType.PAYMENT_INITIATED: {
      const title = 'Payment Initiated';
      const msg = `Payment order initiated for ${amountStr} (Consultation with Dr. ${doctorName}).`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Payment Initiated: Consultation with Dr. ${doctorName}`,
        emailHtml: buildBaseEmail(
          title,
          '#0066cc',
          `<p>Hello ${patientName},</p>
           <p>Payment of <strong>${amountStr}</strong> has been initiated for your consultation with <strong>Dr. ${doctorName}</strong>.</p>
           <p>Order ID: <code>${safeString(data.orderId, refId)}</code></p>`,
          'Complete Payment',
          `${appBaseUrl}/patient/appointments`,
        ),
        whatsAppText: `*CareUp Payment Initiated*\n\nHello ${patientName},\nA payment of *${amountStr}* was initiated for Dr. ${doctorName}.\nOrder: ${safeString(data.orderId, refId)}`,
        smsText: `CareUp: Payment of ${amountStr} initiated for Dr. ${doctorName}. Complete within 15 min to secure slot.`,
      };
    }

    // ─── PAYMENT PENDING ─────────────────────────────────────────────────────
    case NotificationEventType.PAYMENT_PENDING: {
      const title = 'Payment Pending Provider Confirmation';
      const msg = `Payment of ${amountStr} is currently pending provider confirmation.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Payment Status Pending: Dr. ${doctorName}`,
        emailHtml: buildBaseEmail(
          title,
          '#f59e0b',
          `<p>Hello ${patientName},</p>
           <p>Your payment of <strong>${amountStr}</strong> is awaiting confirmation from your bank/gateway.</p>
           <p>We will update your appointment automatically as soon as payment is confirmed.</p>`,
          'Check Payment Status',
          `${appBaseUrl}/patient/payments`,
        ),
        whatsAppText: `*CareUp Payment Pending*\n\nHello ${patientName},\nYour payment of *${amountStr}* is awaiting bank confirmation. We will notify you once confirmed.`,
        smsText: `CareUp: Payment of ${amountStr} is pending bank verification. We will update you once confirmed.`,
      };
    }

    // ─── PAYMENT SUCCESSFUL ──────────────────────────────────────────────────
    case NotificationEventType.PAYMENT_SUCCESSFUL: {
      const title = 'Payment Received! 💳';
      const msg = `Payment of ${amountStr} verified successfully for Dr. ${doctorName}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Payment Receipt: Consultation with Dr. ${doctorName}`,
        emailHtml: buildBaseEmail(
          title,
          '#16a34a',
          `<p>Hello ${patientName},</p>
           <p>We have successfully received your payment of <strong>${amountStr}</strong> for your consultation with <strong>Dr. ${doctorName}</strong>.</p>
           <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 12px 0;">
             <p style="margin: 4px 0;"><strong>Amount Paid:</strong> ${amountStr}</p>
             <p style="margin: 4px 0;"><strong>Payment ID:</strong> ${safeString(data.paymentId, 'Verified')}</p>
             <p style="margin: 4px 0;"><strong>Date:</strong> ${dateStr} at ${timeStr}</p>
           </div>`,
          'View Payment History',
          `${appBaseUrl}/patient/payments`,
        ),
        whatsAppText: `*CareUp Payment Confirmed* 💳\n\nHello ${patientName},\nReceived *${amountStr}* for consultation with *Dr. ${doctorName}*.\nPayment Ref: ${safeString(data.paymentId, refId)}\nYour slot is confirmed!`,
        smsText: `CareUp: Received payment of ${amountStr} for Dr. ${doctorName}. Slot is confirmed for ${dateStr}.`,
        note: `Paid ${amountStr}`,
      };
    }

    // ─── PAYMENT FAILED ──────────────────────────────────────────────────────
    case NotificationEventType.PAYMENT_FAILED: {
      const title = 'Payment Unsuccessful ⚠️';
      const msg = `Your payment attempt of ${amountStr} could not be completed. You may retry.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Payment Failed: Consultation with Dr. ${doctorName}`,
        emailHtml: buildBaseEmail(
          title,
          '#dc2626',
          `<p>Hello ${patientName},</p>
           <p>Your payment attempt of <strong>${amountStr}</strong> was not successful.</p>
           <p>No funds were charged. You can retry your payment before your slot reservation expires.</p>`,
          'Retry Payment',
          `${appBaseUrl}/patient/appointments`,
        ),
        whatsAppText: `*CareUp Payment Failed* ⚠️\n\nHello ${patientName},\nPayment of *${amountStr}* for Dr. ${doctorName} was unsuccessful. You can retry safely from your portal.`,
        smsText: `CareUp: Payment of ${amountStr} failed. Please retry on ${appBaseUrl} before reservation expires.`,
        note: 'Payment failed',
      };
    }

    // ─── PAYMENT VERIFICATION PENDING / FAILED / DUPLICATE / RECONCILED ──────
    case NotificationEventType.PAYMENT_VERIFICATION_PENDING:
    case NotificationEventType.PAYMENT_VERIFICATION_FAILED:
    case NotificationEventType.PAYMENT_DUPLICATE_DETECTED:
    case NotificationEventType.PAYMENT_RECONCILED: {
      const isReconciled = eventType === NotificationEventType.PAYMENT_RECONCILED;
      const title = isReconciled ? 'Payment Reconciled Successfully' : 'Payment Status Notice';
      const msg = isReconciled
        ? `Your transaction of ${amountStr} was verified during reconciliation and your slot is confirmed.`
        : `Update regarding your payment for Dr. ${doctorName}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: title,
        emailHtml: buildBaseEmail(title, '#0066cc', `<p>Hello ${patientName},</p><p>${msg}</p>`),
        whatsAppText: `*CareUp Payment Notice*\n\nHello ${patientName},\n${msg}`,
        smsText: `CareUp: ${msg}`,
      };
    }

    // ─── REFUND INITIATED / REQUESTED / PROCESSING ───────────────────────────
    case NotificationEventType.REFUND_REQUESTED:
    case NotificationEventType.REFUND_INITIATED:
    case NotificationEventType.REFUND_PENDING:
    case NotificationEventType.REFUND_PROCESSING: {
      const title = 'Refund Initiated ↩️';
      const msg = `Refund of ${amountStr} has been initiated for your consultation with Dr. ${doctorName}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Refund Initiated: ${amountStr}`,
        emailHtml: buildBaseEmail(
          title,
          '#0066cc',
          `<p>Hello ${patientName},</p>
           <p>A refund of <strong>${amountStr}</strong> for your consultation with <strong>Dr. ${doctorName}</strong> has been initiated.</p>
           <div style="background-color: #f8fafc; border-left: 4px solid #0066cc; padding: 12px 16px; margin: 12px 0;">
             <p style="margin: 4px 0;"><strong>Refund Amount:</strong> ${amountStr}</p>
             <p style="margin: 4px 0;"><strong>Reference:</strong> ${safeString(data.refundId, refId)}</p>
             <p style="margin: 4px 0; color: #64748b; font-size: 12px;">Refunds usually reflect in your bank account or card within 5-7 business days.</p>
           </div>`,
          'View Refund Status',
          `${appBaseUrl}/patient/payments`,
        ),
        whatsAppText: `*CareUp Refund Initiated* ↩️\n\nHello ${patientName},\nA refund of *${amountStr}* for Dr. ${doctorName} has been initiated.\nRef: ${safeString(data.refundId, refId)}\nFunds usually reflect in 5-7 business days.`,
        smsText: `CareUp: Refund of ${amountStr} initiated for Dr. ${doctorName}. Ref: ${safeString(data.refundId, refId).slice(0, 8)}. Reflects in 5-7 business days.`,
        note: `Refund: ${amountStr}`,
      };
    }

    // ─── REFUND SUCCESSFUL ───────────────────────────────────────────────────
    case NotificationEventType.REFUND_SUCCESSFUL: {
      const title = 'Refund Completed ✅';
      const msg = `Your refund of ${amountStr} has been successfully processed by your bank.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Refund Completed: ${amountStr}`,
        emailHtml: buildBaseEmail(
          title,
          '#16a34a',
          `<p>Hello ${patientName},</p>
           <p>Your refund of <strong>${amountStr}</strong> for your consultation with <strong>Dr. ${doctorName}</strong> has been credited.</p>
           <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 12px 0;">
             <p style="margin: 4px 0;"><strong>Credited Amount:</strong> ${amountStr}</p>
             <p style="margin: 4px 0;"><strong>Refund ID:</strong> ${safeString(data.refundId, refId)}</p>
           </div>`,
          'View Account',
          `${appBaseUrl}/patient/payments`,
        ),
        whatsAppText: `*CareUp Refund Credited* ✅\n\nHello ${patientName},\nYour refund of *${amountStr}* has been successfully processed by your bank.\nRef: ${safeString(data.refundId, refId)}`,
        smsText: `CareUp: Refund of ${amountStr} credited successfully. Ref: ${safeString(data.refundId, refId).slice(0, 8)}.`,
      };
    }

    // ─── REFUND FAILED / REJECTED / DELAYED ──────────────────────────────────
    case NotificationEventType.REFUND_FAILED:
    case NotificationEventType.REFUND_REJECTED:
    case NotificationEventType.REFUND_DELAYED: {
      const isFailed = eventType === NotificationEventType.REFUND_FAILED;
      const title = isFailed ? 'Refund Notice: Action Required' : 'Refund Delayed';
      const msg = `Issue updating your refund of ${amountStr}. Our finance team is reviewing it.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: title,
        emailHtml: buildBaseEmail(
          title,
          '#dc2626',
          `<p>Hello ${patientName},</p>
           <p>There was a delay processing your refund of <strong>${amountStr}</strong>.</p>
           <p>Our finance team has been notified and is manually reconciling your transaction with the payment gateway.</p>`,
          'Contact Support',
          `${appBaseUrl}/support`,
        ),
        whatsAppText: `*CareUp Refund Notice*\n\nHello ${patientName},\nAn issue occurred processing your refund of *${amountStr}*. Our team is manually reconciling it.`,
        smsText: `CareUp: Update on refund of ${amountStr}: Under manual review. Our team will resolve it shortly.`,
      };
    }

    // ─── CHECK IN REQUEST ────────────────────────────────────────────────────
    case NotificationEventType.CHECK_IN_REQUEST: {
      const code = safeString(data.kioskCode, '');
      const title = 'Clinic Check-In Request 🏥';
      const msg = `Kiosk check-in scan detected for appointment with Dr. ${doctorName}. Code: ${code}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Clinic Check-In Request: Dr. ${doctorName}`,
        emailHtml: buildBaseEmail(
          title,
          '#0066cc',
          `<p>Hello ${patientName},</p>
           <p>A kiosk check-in request was scanned for your appointment with <strong>Dr. ${doctorName}</strong>.</p>
           <p>Please approve the request from your phone if you are at the clinic.</p>`,
          'Approve Check-In',
          `${appBaseUrl}/patient/appointments`,
        ),
        whatsAppText: `*CareUp Clinic Check-In*\n\nHello ${patientName},\nCheck-in scanned for Dr. ${doctorName}.\nApprove on your device: ${appBaseUrl}/patient/appointments`,
        smsText: `CareUp: Check-in scan detected for Dr. ${doctorName}. Open ${appBaseUrl}/patient/appointments to approve.`,
      };
    }

    default: {
      const title = 'CareUp Notification';
      const msg = safeString(data.message, 'You have a new update.');
      return {
        title,
        inAppMessage: msg,
        emailSubject: title,
        emailHtml: buildBaseEmail(title, '#0066cc', `<p>${msg}</p>`),
        whatsAppText: `*CareUp*: ${msg}`,
        smsText: `CareUp: ${msg}`,
      };
    }
    }
  })();

  return {
    ...templateResult,
    templateParams: {
      patientName,
      doctorName,
      appointmentDate: dateStr,
      appointmentTime: timeStr,
      reference: refId,
      amount: amountStr,
      reason: safeString(data.reason || data.rescheduleReason || data.cancellationReason || data.rejectionReason, ''),
    },
  };
}

