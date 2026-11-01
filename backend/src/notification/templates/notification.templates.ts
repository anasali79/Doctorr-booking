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

// ─── Crisp Inline SVG Icons for Clinical Email Compatibility ─────────────────
const ICONS = {
  medicalCross: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: 0 auto;">
      <path d="M12 2v20M2 12h20"/>
    </svg>`,
  calendar: `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0066cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`,
  clock: `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0066cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>`,
  doctor: `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0066cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>`,
  patient: `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0066cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>`,
  shieldCheck: `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
    </svg>`,
  creditCard: `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0066cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>`,
  refresh: `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>`,
  alertCircle: `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>`,
  pin: `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>`,
};

interface BaseEmailOptions {
  badgeText: string;
  badgeTheme: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  title: string;
  subtitle?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  noticeText?: string;
  appBaseUrl: string;
}

function buildBaseEmail(opts: BaseEmailOptions): string {
  const {
    badgeText,
    badgeTheme,
    title,
    subtitle,
    bodyHtml,
    ctaLabel,
    ctaUrl,
    noticeText,
    appBaseUrl,
  } = opts;

  const themeStyles = {
    primary: { bg: '#eff6ff', text: '#0066cc', border: '#bfdbfe' },
    success: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
    warning: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
    danger: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
    neutral: { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
  }[badgeTheme];

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f6f8fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f6f8fb; padding: 24px 12px;">
        <tr>
          <td align="center">
            <!-- Main Email Card -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.04);">
              
              <!-- Brand Header -->
              <tr>
                <td style="background-color: #0055b3; background: linear-gradient(135deg, #004494 0%, #0066cc 100%); padding: 24px 32px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="vertical-align: middle;">
                        <table cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="background-color: rgba(255, 255, 255, 0.18); border-radius: 8px; width: 36px; height: 36px; text-align: center; vertical-align: middle;">
                              ${ICONS.medicalCross}
                            </td>
                            <td style="padding-left: 14px; vertical-align: middle;">
                              <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px; display: block; line-height: 1.2;">CareUp</span>
                              <span style="font-size: 11px; color: #bae0fd; letter-spacing: 0.6px; text-transform: uppercase; display: block; font-weight: 600;">Clinical Healthcare Appointments</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Title & Status Badge -->
              <tr>
                <td style="padding: 28px 32px 0 32px;">
                  <div style="display: inline-block; background-color: ${themeStyles.bg}; color: ${themeStyles.text}; border: 1px solid ${themeStyles.border}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 12px; border-radius: 20px;">
                    ${badgeText}
                  </div>
                  <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 14px 0 6px 0; line-height: 1.3;">
                    ${title}
                  </h1>
                  ${subtitle ? `<p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0; line-height: 1.5;">${subtitle}</p>` : '<div style="margin-bottom: 20px;"></div>'}
                </td>
              </tr>

              <!-- Body Content -->
              <tr>
                <td style="padding: 0 32px 28px 32px; color: #334155; font-size: 14px; line-height: 1.6;">
                  ${bodyHtml}

                  ${ctaLabel && ctaUrl ? `
                    <div style="margin: 28px 0 12px 0; text-align: left;">
                      <a href="${ctaUrl}" target="_blank" style="display: inline-block; background-color: #0066cc; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; letter-spacing: 0.2px;">
                        ${ctaLabel} &rarr;
                      </a>
                    </div>
                  ` : ''}

                  ${noticeText ? `
                    <div style="background-color: #f8fafc; border-left: 3px solid #0066cc; padding: 12px 16px; border-radius: 4px; margin-top: 24px;">
                      <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${noticeText}</p>
                    </div>
                  ` : ''}
                </td>
              </tr>

              <!-- Clinical Compliance Footer -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: left;">
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                    <strong>Confidential Medical Communication:</strong> This automated transmission contains patient scheduling records intended solely for the designated recipient.
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
                    CareUp Healthcare Platform &bull; Need assistance? Access the <a href="${appBaseUrl}/support" style="color: #0066cc; text-decoration: none; font-weight: 500;">Clinical Support Portal</a>
                  </p>
                  <p style="margin: 6px 0 0 0; font-size: 11px; color: #94a3b8;">
                    &copy; ${new Date().getFullYear()} CareUp Technologies. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ─── Structured Details Cards ────────────────────────────────────────────────
function buildAppointmentCard(params: {
  doctorName: string;
  specialization?: string;
  patientName?: string;
  dateStr: string;
  timeStr: string;
  endTimeStr?: string;
  token?: string;
  refId: string;
  isDoctor?: boolean;
}): string {
  const { doctorName, specialization, patientName, dateStr, timeStr, endTimeStr, token, refId, isDoctor } = params;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 18px 0; overflow: hidden;">
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.6px;">
                Consultation Record
              </td>
              ${token ? `
                <td align="right">
                  <span style="background-color: #0066cc; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px;">
                    TOKEN #${token.replace('#', '')}
                  </span>
                </td>
              ` : ''}
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${isDoctor && patientName ? `
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b; width: 34%;">Patient:</td>
                <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${ICONS.patient} ${patientName}</td>
              </tr>
            ` : `
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b; width: 34%;">Doctor:</td>
                <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${ICONS.doctor} Dr. ${doctorName} ${specialization ? `<span style="font-weight: 400; color: #64748b; font-size: 12px;">(${specialization})</span>` : ''}</td>
              </tr>
            `}
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Date:</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${ICONS.calendar} ${dateStr}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Time:</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${ICONS.clock} ${timeStr}${endTimeStr ? ` - ${endTimeStr}` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Booking ID:</td>
              <td style="padding: 6px 0; font-size: 13px; font-family: monospace; color: #334155;">${refId}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function buildPaymentCard(params: {
  amountStr: string;
  paymentId: string;
  doctorName: string;
  dateStr: string;
  timeStr: string;
  statusBadge: string;
}): string {
  const { amountStr, paymentId, doctorName, dateStr, timeStr, statusBadge } = params;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 18px 0; overflow: hidden;">
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.6px;">
                Transaction Receipt
              </td>
              <td align="right">
                <span style="background-color: #16a34a; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px;">
                  ${statusBadge}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b; width: 34%;">Amount Paid:</td>
              <td style="padding: 6px 0; font-size: 16px; font-weight: 700; color: #16a34a;">${amountStr}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Transaction ID:</td>
              <td style="padding: 6px 0; font-size: 13px; font-family: monospace; color: #334155;">${paymentId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Doctor:</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">Dr. ${doctorName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Date & Time:</td>
              <td style="padding: 6px 0; font-size: 13px; color: #334155;">${dateStr} at ${timeStr}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function buildRefundCard(params: {
  amountStr: string;
  refundId: string;
  reason?: string;
  doctorName?: string;
}): string {
  const { amountStr, refundId, reason, doctorName } = params;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 18px 0; overflow: hidden;">
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.6px;">
                Refund Statement
              </td>
              <td align="right">
                <span style="background-color: #0066cc; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px;">
                  INITIATED
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b; width: 34%;">Refund Amount:</td>
              <td style="padding: 6px 0; font-size: 16px; font-weight: 700; color: #0066cc;">${amountStr}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Refund ID:</td>
              <td style="padding: 6px 0; font-size: 13px; font-family: monospace; color: #334155;">${refundId}</td>
            </tr>
            ${doctorName ? `
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Consultation:</td>
                <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">Dr. ${doctorName}</td>
              </tr>
            ` : ''}
            ${reason ? `
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Reason:</td>
                <td style="padding: 6px 0; font-size: 13px; color: #334155;">${reason}</td>
              </tr>
            ` : ''}
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Processing Window:</td>
              <td style="padding: 6px 0; font-size: 13px; color: #334155;">5 to 7 business days to original payment method</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

// ─── Main Notification Template Renderer ─────────────────────────────────────
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
          emailHtml: buildBaseEmail({
            badgeText: 'NEW APPOINTMENT',
            badgeTheme: 'primary',
            title: 'New Clinical Appointment Received',
            subtitle: `A new patient consultation has been registered in your clinic queue.`,
            bodyHtml: `
              <p style="margin: 0 0 16px 0;">Dear Dr. ${doctorName},</p>
              <p style="margin: 0 0 16px 0;">A patient consultation has been scheduled with you. Please review the booking particulars below:</p>
              ${buildAppointmentCard({ doctorName, specialization: spec, patientName, dateStr, timeStr, endTimeStr, token, refId, isDoctor: true })}
            `,
            ctaLabel: 'View Clinical Schedule',
            ctaUrl: `${appBaseUrl}/doctor/appointments`,
            noticeText: 'Please review the patient clinical history prior to the consultation slot.',
            appBaseUrl,
          }),
          whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nNEW BOOKING NOTIFICATION\n\nDear Dr. ${doctorName},\n\nA new consultation has been booked by *${patientName}*.\n\n• Date: ${dateStr}\n• Time: ${timeStr}\n• Token: ${token || 'Assigned on arrival'}\n• Booking ID: ${refId}\n\nReview Schedule:\n${appBaseUrl}/doctor/appointments\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
          smsText: `CareUp: New booking by ${patientName} on ${dateStr} at ${timeStr}. Token: ${token || 'N/A'}. Ref: ${refId.slice(0, 8)}. Schedule: ${appBaseUrl}/doctor/appointments`,
          note: token ? `Token ${token}` : null,
        };
      } else {
        const title = 'Appointment Request Received';
        const msg = `Your appointment request with Dr. ${doctorName} on ${dateStr} at ${timeStr} is received.`;
        return {
          title,
          inAppMessage: msg,
          emailSubject: `Appointment Request: Dr. ${doctorName}`,
          emailHtml: buildBaseEmail({
            badgeText: 'REQUEST RECEIVED',
            badgeTheme: 'primary',
            title: 'Appointment Request Registered',
            subtitle: `Your consultation request with Dr. ${doctorName} has been recorded.`,
            bodyHtml: `
              <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
              <p style="margin: 0 0 16px 0;">Thank you for scheduling with CareUp. Your consultation details are outlined below:</p>
              ${buildAppointmentCard({ doctorName, specialization: spec, dateStr, timeStr, endTimeStr, token, refId })}
            `,
            ctaLabel: 'Manage My Appointments',
            ctaUrl: `${appBaseUrl}/patient/appointments`,
            noticeText: 'Please arrive 10 minutes prior to your designated slot for front-desk check-in.',
            appBaseUrl,
          }),
          whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nAPPOINTMENT REQUEST RECEIVED\n\nDear ${patientName},\n\nYour consultation request with *Dr. ${doctorName}* (${spec}) has been received.\n\n• Date: ${dateStr}\n• Time: ${timeStr}\n• Token: ${token || 'Pending confirmation'}\n• Booking ID: ${refId}\n\nView Appointment:\n${appBaseUrl}/patient/appointments\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
          smsText: `CareUp: Appointment requested with Dr. ${doctorName} on ${dateStr} at ${timeStr}. Token: ${token || 'Pending'}. Ref: ${refId.slice(0, 8)}.`,
          note: 'Please arrive 10 minutes prior to scheduled slot.',
        };
      }
    }

    // ─── APPOINTMENT CONFIRMED ───────────────────────────────────────────────
    case NotificationEventType.APPOINTMENT_CONFIRMED: {
      const isDoc = recipientRole === 'DOCTOR';
      const title = 'Appointment Confirmed';
      const msg = isDoc
        ? `Appointment confirmed with ${patientName} for ${dateStr} at ${timeStr}. Token: ${token || 'Standard'}.`
        : `Your appointment with Dr. ${doctorName} on ${dateStr} at ${timeStr} is confirmed. Token: ${token || 'Standard'}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Appointment Confirmed: ${isDoc ? patientName : `Dr. ${doctorName}`}`,
        emailHtml: buildBaseEmail({
          badgeText: 'CONFIRMED',
          badgeTheme: 'success',
          title: 'Consultation Confirmed',
          subtitle: `The consultation on ${dateStr} at ${timeStr} has been successfully verified.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${isDoc ? `Dr. ${doctorName}` : patientName},</p>
            <p style="margin: 0 0 16px 0;">The appointment has been verified and registered in the clinic management system:</p>
            ${buildAppointmentCard({ doctorName, specialization: spec, patientName, dateStr, timeStr, endTimeStr, token, refId, isDoctor: isDoc })}
          `,
          ctaLabel: isDoc ? 'Open Doctor Queue' : 'View Appointment & QR Code',
          ctaUrl: isDoc ? `${appBaseUrl}/doctor/appointments` : `${appBaseUrl}/patient/appointments`,
          noticeText: isDoc
            ? 'The patient has been instructed to arrive 10 minutes prior to the scheduled slot.'
            : 'Please bring any previous medical prescriptions or diagnostic reports. QR check-in is available at clinic reception.',
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\n*CareUp Appointment Confirmed*\n\nDear ${isDoc ? `Dr. ${doctorName}` : patientName},\n\nThe consultation on *${dateStr}* at *${timeStr}* is confirmed.\n\n• ${isDoc ? `Patient: *${patientName}*` : `Doctor: *Dr. ${doctorName}* (${spec})`}\n• Date: ${dateStr}\n• Time: ${timeStr}\n• Token: *${token || 'Standard'}*\n• Booking ID: ${refId}\n\nPlease arrive 10 minutes early for check-in.\n\nManage Details:\n${isDoc ? `${appBaseUrl}/doctor/appointments` : `${appBaseUrl}/patient/appointments`}\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Consultation confirmed for ${dateStr} at ${timeStr} with ${isDoc ? patientName : `Dr. ${doctorName}`}. Token: ${token || 'N/A'}. Ref: ${refId.slice(0, 8)}.`,
        note: token ? `Token ${token}` : 'Confirmed',
      };
    }

    // ─── APPOINTMENT PENDING ─────────────────────────────────────────────────
    case NotificationEventType.APPOINTMENT_PENDING: {
      const title = 'Appointment Pending Confirmation';
      const msg = `Your appointment with Dr. ${doctorName} is awaiting slot confirmation.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Pending Confirmation: Consultation with Dr. ${doctorName}`,
        emailHtml: buildBaseEmail({
          badgeText: 'PENDING CONFIRMATION',
          badgeTheme: 'warning',
          title: 'Appointment Pending Confirmation',
          subtitle: `Our clinic staff is verifying doctor availability for your chosen slot.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">Your appointment request with <strong>Dr. ${doctorName}</strong> on <strong>${dateStr}</strong> at <strong>${timeStr}</strong> is currently pending confirmation.</p>
            ${buildAppointmentCard({ doctorName, specialization: spec, dateStr, timeStr, endTimeStr, token, refId })}
            <p style="margin: 16px 0 0 0;">You will receive an immediate confirmation update once the clinical slot is finalized.</p>
          `,
          ctaLabel: 'Check Status',
          ctaUrl: `${appBaseUrl}/patient/appointments`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nAPPOINTMENT PENDING CONFIRMATION\n\nDear ${patientName},\n\nYour appointment with *Dr. ${doctorName}* on *${dateStr}* at *${timeStr}* is awaiting slot confirmation.\n\n• Booking ID: ${refId}\n\nTrack Status:\n${appBaseUrl}/patient/appointments\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
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
        emailHtml: buildBaseEmail({
          badgeText: 'REQUEST DECLINED',
          badgeTheme: 'danger',
          title: 'Appointment Request Declined',
          subtitle: `The selected appointment slot could not be accommodated.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">We regret to inform you that your appointment request with <strong>Dr. ${doctorName}</strong> on <strong>${dateStr}</strong> could not be accepted.</p>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
              <p style="margin: 0; font-size: 13px; color: #991b1b;"><strong>Reason:</strong> ${reason}</p>
            </div>
            <p style="margin: 16px 0 0 0;">If a consultation fee was charged, an automatic 100% refund has been initiated to your original payment method.</p>
          `,
          ctaLabel: 'Choose Another Slot',
          ctaUrl: `${appBaseUrl}/doctors`,
          noticeText: 'Refunds are automatically processed within 5-7 business days.',
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nAPPOINTMENT DECLINED\n\nDear ${patientName},\n\nYour appointment request with *Dr. ${doctorName}* on *${dateStr}* could not be accepted.\n\n• Reason: ${reason}\n• Booking ID: ${refId}\n\nAny paid fee has been automatically initiated for full refund.\n\nBook Alternative Slot:\n${appBaseUrl}/doctors\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Appointment with Dr. ${doctorName} on ${dateStr} could not be confirmed (${reason}). Any paid fees are refunded.`,
        note: reason,
      };
    }

    // ─── APPOINTMENT RESCHEDULED ─────────────────────────────────────────────
    case NotificationEventType.APPOINTMENT_RESCHEDULED: {
      const isDoc = recipientRole === 'DOCTOR';
      const prevDate = data.previousDate ? formatDate(data.previousDate) : 'original date';
      const prevTime = data.previousStartTime ? formatTime(data.previousStartTime) : 'original time';
      const title = 'Appointment Rescheduled';
      const msg = isDoc
        ? `Appointment with ${patientName} moved from ${prevDate} ${prevTime} to ${dateStr} at ${timeStr}.`
        : `Your appointment with Dr. ${doctorName} was rescheduled from ${prevDate} to ${dateStr} at ${timeStr}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Appointment Rescheduled: ${isDoc ? patientName : `Dr. ${doctorName}`}`,
        emailHtml: buildBaseEmail({
          badgeText: 'RESCHEDULED',
          badgeTheme: 'primary',
          title: 'Appointment Rescheduled',
          subtitle: `Your consultation timing has been updated in the clinical schedule.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${isDoc ? `Dr. ${doctorName}` : patientName},</p>
            <p style="margin: 0 0 16px 0;">The consultation slot has been updated. Please find the revised schedule below:</p>
            ${buildAppointmentCard({ doctorName, specialization: spec, patientName, dateStr, timeStr, endTimeStr, token, refId, isDoctor: isDoc })}
            <div style="background-color: #f1f5f9; border-left: 3px solid #64748b; padding: 10px 14px; border-radius: 4px; margin-top: 12px;">
              <span style="font-size: 12px; color: #475569;"><strong>Previous Slot:</strong> <del>${prevDate} at ${prevTime}</del></span>
            </div>
          `,
          ctaLabel: 'View Updated Schedule',
          ctaUrl: isDoc ? `${appBaseUrl}/doctor/appointments` : `${appBaseUrl}/patient/appointments`,
          noticeText: 'Clinical appointment reminders have been recalibrated to your new slot.',
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nAPPOINTMENT RESCHEDULED\n\nDear ${isDoc ? `Dr. ${doctorName}` : patientName},\n\nThe appointment has been rescheduled.\n\n• New Date: ${dateStr}\n• New Time: ${timeStr}\n• Previous: ${prevDate} at ${prevTime}\n• Token: *${token || 'Standard'}*\n• Booking ID: ${refId}\n\nView Schedule:\n${isDoc ? `${appBaseUrl}/doctor/appointments` : `${appBaseUrl}/patient/appointments`}\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Appointment rescheduled to ${dateStr} at ${timeStr} with ${isDoc ? patientName : `Dr. ${doctorName}`}. Prev: ${prevDate}. Token: ${token || 'N/A'}. Ref: ${refId.slice(0, 8)}.`,
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
        emailSubject: `Appointment Cancellation: Consultation on ${dateStr}`,
        emailHtml: buildBaseEmail({
          badgeText: 'CANCELLED BY PATIENT',
          badgeTheme: 'danger',
          title: 'Appointment Cancelled',
          subtitle: `The consultation slot on ${dateStr} at ${timeStr} was cancelled.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${isDoc ? `Dr. ${doctorName}` : patientName},</p>
            <p style="margin: 0 0 16px 0;">The appointment has been cancelled upon patient request:</p>
            ${buildAppointmentCard({ doctorName, specialization: spec, patientName, dateStr, timeStr, endTimeStr, token, refId, isDoctor: isDoc })}
            ${data.cancelReason ? `
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin: 12px 0;">
                <p style="margin: 0; font-size: 13px; color: #991b1b;"><strong>Cancellation Reason:</strong> ${data.cancelReason}</p>
              </div>
            ` : ''}
          `,
          ctaLabel: isDoc ? 'View Schedule' : 'Schedule New Appointment',
          ctaUrl: isDoc ? `${appBaseUrl}/doctor/appointments` : `${appBaseUrl}/doctors`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nAPPOINTMENT CANCELLATION NOTICE\n\nDear ${isDoc ? `Dr. ${doctorName}` : patientName},\n\nConsultation on *${dateStr}* at *${timeStr}* was cancelled by the patient.\n\n• Booking ID: ${refId}\n${data.cancelReason || data.cancellationReason ? `• Reason: ${data.cancelReason || data.cancellationReason}\n` : ''}• Status: Cancellation confirmed\n\nSchedule New Appointment:\n${appBaseUrl}/doctors\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
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
        emailHtml: buildBaseEmail({
          badgeText: 'CANCELLED BY CLINIC',
          badgeTheme: 'danger',
          title: 'Appointment Cancelled',
          subtitle: `The doctor has cancelled the scheduled consultation.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${isDoc ? `Dr. ${doctorName}` : patientName},</p>
            <p style="margin: 0 0 16px 0;">${isDoc ? 'You have cancelled the following appointment:' : `We regret to inform you that <strong>Dr. ${doctorName}</strong> had to cancel the consultation:`}</p>
            ${buildAppointmentCard({ doctorName, specialization: spec, patientName, dateStr, timeStr, endTimeStr, token, refId, isDoctor: isDoc })}
            ${data.cancelReason ? `
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin: 12px 0;">
                <p style="margin: 0; font-size: 13px; color: #991b1b;"><strong>Reason:</strong> ${data.cancelReason}</p>
              </div>
            ` : ''}
            <p style="margin: 16px 0 0 0;">${isDoc ? 'The clinic slot has been made available.' : 'Any paid consultation fee has been automatically triggered for a 100% refund.'}</p>
          `,
          ctaLabel: isDoc ? 'View Schedule' : 'Find Alternative Doctor',
          ctaUrl: isDoc ? `${appBaseUrl}/doctor/appointments` : `${appBaseUrl}/doctors`,
          noticeText: 'Refunds reflect within 5-7 business days to the original payment source.',
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nAPPOINTMENT CANCELLED\n\nDear ${isDoc ? `Dr. ${doctorName}` : patientName},\n\nConsultation on *${dateStr}* at *${timeStr}* was cancelled by the clinic.\n\n• Booking ID: ${refId}\n${data.cancelReason ? `• Reason: ${data.cancelReason}\n` : ''}${!isDoc ? '• Automatic refund initiated for paid fees.\n' : ''}\nFind Alternative Doctor:\n${appBaseUrl}/doctors\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Appointment with Dr. ${doctorName} on ${dateStr} cancelled by doctor. Automatic refund initiated if paid. Ref: ${refId.slice(0, 8)}.`,
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
        emailHtml: buildBaseEmail({
          badgeText: 'ADMINISTRATIVE NOTICE',
          badgeTheme: 'neutral',
          title: 'Appointment Cancelled by Administration',
          subtitle: `The appointment scheduled on ${dateStr} at ${timeStr} has been revoked.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear User,</p>
            <p style="margin: 0 0 16px 0;">The appointment scheduled on <strong>${dateStr}</strong> at <strong>${timeStr}</strong> has been cancelled by administration.</p>
            ${buildAppointmentCard({ doctorName, specialization: spec, dateStr, timeStr, endTimeStr, token, refId })}
          `,
          ctaLabel: 'Support Desk',
          ctaUrl: `${appBaseUrl}/support`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nADMINISTRATIVE NOTICE\n\nAppointment on *${dateStr}* at *${timeStr}* was cancelled by system administration.\n\n• Booking ID: ${refId}\n\nSupport Desk:\n${appBaseUrl}/support\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Appointment on ${dateStr} at ${timeStr} cancelled by admin. Contact support if needed.`,
      };
    }

    // ─── APPOINTMENT COMPLETED ───────────────────────────────────────────────
    case NotificationEventType.APPOINTMENT_COMPLETED: {
      const title = 'Consultation Completed';
      const msg = `Your consultation with Dr. ${doctorName} has been marked completed. Thank you for visiting!`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Consultation Completed: Dr. ${doctorName}`,
        emailHtml: buildBaseEmail({
          badgeText: 'COMPLETED',
          badgeTheme: 'success',
          title: 'Consultation Concluded',
          subtitle: `Thank you for visiting CareUp for your clinical consultation.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">Your medical consultation with <strong>Dr. ${doctorName}</strong> on <strong>${dateStr}</strong> has been marked completed in the clinical records.</p>
            ${buildAppointmentCard({ doctorName, specialization: spec, dateStr, timeStr, endTimeStr, token, refId })}
            <p style="margin: 16px 0 0 0;">You can access visit notes, prescription records, and formal payment receipts from your Patient Portal.</p>
          `,
          ctaLabel: 'View Visit Summary',
          ctaUrl: `${appBaseUrl}/patient/appointments`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nCONSULTATION COMPLETED\n\nDear ${patientName},\n\nYour consultation with *Dr. ${doctorName}* on *${dateStr}* has concluded.\n\n• Booking ID: ${refId}\n\nAccess Visit Summary & Invoices:\n${appBaseUrl}/patient/appointments\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Consultation with Dr. ${doctorName} on ${dateStr} marked completed. Access records at ${appBaseUrl}/patient/appointments`,
      };
    }

    // ─── APPOINTMENT EXPIRED ─────────────────────────────────────────────────
    case NotificationEventType.APPOINTMENT_EXPIRED: {
      const title = 'Booking Window Expired';
      const msg = `Your reservation for Dr. ${doctorName} on ${dateStr} expired because payment or confirmation was not completed in time.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Reservation Expired: Dr. ${doctorName}`,
        emailHtml: buildBaseEmail({
          badgeText: 'WINDOW EXPIRED',
          badgeTheme: 'warning',
          title: 'Slot Reservation Expired',
          subtitle: `The 15-minute temporary slot reservation has elapsed.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">Your temporary 15-minute slot reservation for <strong>Dr. ${doctorName}</strong> on <strong>${dateStr}</strong> at <strong>${timeStr}</strong> has expired as confirmation was not finalized within the allotted window.</p>
            <p style="margin: 0 0 16px 0;">The slot has been released back into public availability. You may choose an available slot at your convenience.</p>
          `,
          ctaLabel: 'Select New Slot',
          ctaUrl: `${appBaseUrl}/doctors`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nRESERVATION EXPIRED\n\nDear ${patientName},\n\nYour temporary slot reservation with *Dr. ${doctorName}* for *${dateStr}* has expired. The slot has been released.\n\nBook Again:\n${appBaseUrl}/doctors\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Slot reservation with Dr. ${doctorName} for ${dateStr} expired. Visit ${appBaseUrl} to select a new slot.`,
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
      const title = `Appointment Reminder (${label})`;
      const msg = `Reminder: Your appointment with Dr. ${doctorName} is ${label} at ${timeStr}. Token: ${token || 'Standard'}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Reminder: Appointment ${label} with Dr. ${doctorName}`,
        emailHtml: buildBaseEmail({
          badgeText: `REMINDER: ${label.toUpperCase()}`,
          badgeTheme: 'primary',
          title: 'Clinical Appointment Reminder',
          subtitle: `Your upcoming consultation with Dr. ${doctorName} is scheduled ${label}.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">This is a scheduled reminder for your upcoming consultation with <strong>Dr. ${doctorName}</strong> (${spec}):</p>
            ${buildAppointmentCard({ doctorName, specialization: spec, dateStr, timeStr, endTimeStr, token, refId })}
          `,
          ctaLabel: 'View Check-In QR Code',
          ctaUrl: `${appBaseUrl}/patient/appointments`,
          noticeText: 'Please arrive 10 minutes prior to your time. Scan your QR code at the clinic reception to enter the queue.',
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nAPPOINTMENT REMINDER\n\nDear ${patientName},\n\nYour consultation with *Dr. ${doctorName}* is scheduled for *${label}* (*${dateStr}* at *${timeStr}*).\n\n• Token: *${token || 'Standard'}*\n• Booking ID: ${refId}\n\nPlease arrive 10 minutes early.\n\nCheck-In & QR Code:\n${appBaseUrl}/patient/appointments\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp Reminder: Appointment with Dr. ${doctorName} is ${label} at ${timeStr}. Token: ${token || 'N/A'}. Arrive 10m early. Details: ${appBaseUrl}/patient/appointments`,
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
        emailSubject: `Payment Order Created: Dr. ${doctorName}`,
        emailHtml: buildBaseEmail({
          badgeText: 'PAYMENT INITIATED',
          badgeTheme: 'primary',
          title: 'Payment Order Created',
          subtitle: `An online payment session of ${amountStr} has been opened.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">A secure payment order of <strong>${amountStr}</strong> has been initiated for your consultation with <strong>Dr. ${doctorName}</strong>.</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
              <p style="margin: 4px 0; font-size: 13px;"><strong>Order ID:</strong> <span style="font-family: monospace;">${safeString(data.orderId, refId)}</span></p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Amount:</strong> ${amountStr}</p>
            </div>
            <p style="margin: 16px 0 0 0;">Please complete the transaction within 15 minutes to guarantee your reserved slot.</p>
          `,
          ctaLabel: 'Complete Payment Now',
          ctaUrl: `${appBaseUrl}/patient/appointments`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nPAYMENT ORDER CREATED\n\nDear ${patientName},\n\nA payment session of *${amountStr}* was initiated for consultation with *Dr. ${doctorName}*.\n\n• Order ID: ${safeString(data.orderId, refId)}\n\nComplete Payment:\n${appBaseUrl}/patient/appointments\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Payment of ${amountStr} initiated for Dr. ${doctorName}. Complete within 15 min to secure slot: ${appBaseUrl}/patient/appointments`,
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
        emailHtml: buildBaseEmail({
          badgeText: 'PENDING VERIFICATION',
          badgeTheme: 'warning',
          title: 'Payment Awaiting Settlement',
          subtitle: `Your transaction of ${amountStr} is undergoing bank authorization.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">Your payment of <strong>${amountStr}</strong> is undergoing verification from your issuing bank or payment gateway.</p>
            <p style="margin: 0 0 16px 0;">Your appointment status will update automatically as soon as payment webhook confirmation arrives.</p>
          `,
          ctaLabel: 'Check Payment Status',
          ctaUrl: `${appBaseUrl}/patient/payments`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nPAYMENT VERIFICATION PENDING\n\nDear ${patientName},\n\nYour transaction of *${amountStr}* is awaiting bank authorization. We will notify you once confirmed.\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Payment of ${amountStr} is pending bank verification. We will update you once confirmed.`,
      };
    }

    // ─── PAYMENT SUCCESSFUL ──────────────────────────────────────────────────
    case NotificationEventType.PAYMENT_SUCCESSFUL: {
      const title = 'Payment Received';
      const msg = `Payment of ${amountStr} verified successfully for Dr. ${doctorName}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Payment Receipt: Consultation with Dr. ${doctorName}`,
        emailHtml: buildBaseEmail({
          badgeText: 'PAYMENT VERIFIED',
          badgeTheme: 'success',
          title: 'Payment Receipt Verified',
          subtitle: `We have confirmed receipt of ${amountStr} for your consultation.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">Thank you. Your consultation payment has been verified. Here is your transaction breakdown:</p>
            ${buildPaymentCard({
              amountStr,
              paymentId: safeString(data.paymentId, 'Verified'),
              doctorName,
              dateStr,
              timeStr,
              statusBadge: 'VERIFIED',
            })}
            <p style="margin: 16px 0 0 0;">Your clinical slot is now fully confirmed. An official receipt is logged in your patient account.</p>
          `,
          ctaLabel: 'View Payment History',
          ctaUrl: `${appBaseUrl}/patient/payments`,
          noticeText: 'Please keep this transaction receipt for your health insurance or medical reimbursement claims.',
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nPAYMENT CONFIRMED\n\nDear ${patientName},\n\nPayment of *${amountStr}* for consultation with *Dr. ${doctorName}* has been verified.\n\n• Payment ID: ${safeString(data.paymentId, refId)}\n• Date & Time: ${dateStr} at ${timeStr}\n\nYour slot is fully confirmed.\n\nView Receipt:\n${appBaseUrl}/patient/payments\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Received payment of ${amountStr} for Dr. ${doctorName}. Slot is confirmed for ${dateStr}. Ref: ${safeString(data.paymentId, refId).slice(0, 10)}.`,
        note: `Paid ${amountStr}`,
      };
    }

    // ─── PAYMENT FAILED ──────────────────────────────────────────────────────
    case NotificationEventType.PAYMENT_FAILED: {
      const title = 'Payment Unsuccessful';
      const msg = `Your payment attempt of ${amountStr} could not be completed. You may retry.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Payment Failed: Consultation with Dr. ${doctorName}`,
        emailHtml: buildBaseEmail({
          badgeText: 'PAYMENT FAILED',
          badgeTheme: 'danger',
          title: 'Payment Unsuccessful',
          subtitle: `The transaction of ${amountStr} was declined or interrupted.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">Your payment attempt of <strong>${amountStr}</strong> for consultation with <strong>Dr. ${doctorName}</strong> was unsuccessful.</p>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
              <p style="margin: 0; font-size: 13px; color: #991b1b;">No funds were deducted. If debited, your bank will release them within 24-48 hours.</p>
            </div>
            <p style="margin: 16px 0 0 0;">You can retry the transaction safely before your reserved slot expires.</p>
          `,
          ctaLabel: 'Retry Payment Now',
          ctaUrl: `${appBaseUrl}/patient/appointments`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nPAYMENT FAILED\n\nDear ${patientName},\n\nPayment of *${amountStr}* for Dr. ${doctorName} was unsuccessful.\n\nNo funds were charged. You can retry safely from your portal before the slot reservation elapses.\n\nRetry Payment:\n${appBaseUrl}/patient/appointments\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Payment of ${amountStr} failed. Please retry on ${appBaseUrl}/patient/appointments before reservation expires.`,
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
        emailHtml: buildBaseEmail({
          badgeText: isReconciled ? 'RECONCILED' : 'PAYMENT NOTICE',
          badgeTheme: isReconciled ? 'success' : 'neutral',
          title,
          bodyHtml: `<p style="margin: 0 0 16px 0;">Dear ${patientName},</p><p style="margin: 0 0 16px 0;">${msg}</p>`,
          ctaLabel: 'View Account',
          ctaUrl: `${appBaseUrl}/patient/payments`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nPAYMENT UPDATE\n\nDear ${patientName},\n\n${msg}\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: ${msg}`,
      };
    }

    // ─── REFUND INITIATED / REQUESTED / PROCESSING ───────────────────────────
    case NotificationEventType.REFUND_REQUESTED:
    case NotificationEventType.REFUND_INITIATED:
    case NotificationEventType.REFUND_PENDING:
    case NotificationEventType.REFUND_PROCESSING: {
      const title = 'Refund Initiated';
      const msg = `Refund of ${amountStr} has been initiated for your consultation with Dr. ${doctorName}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Refund Initiated: ${amountStr}`,
        emailHtml: buildBaseEmail({
          badgeText: 'REFUND INITIATED',
          badgeTheme: 'primary',
          title: 'Refund Process Initiated',
          subtitle: `A credit of ${amountStr} has been queued for your account.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">A refund has been initiated for your consultation with <strong>Dr. ${doctorName}</strong>.</p>
            ${buildRefundCard({ amountStr, refundId: safeString(data.refundId, refId), doctorName, reason: data.reason })}
          `,
          ctaLabel: 'View Refund Status',
          ctaUrl: `${appBaseUrl}/patient/payments`,
          noticeText: 'Refund settlements are handled directly by payment networks and take 5-7 business days to reflect.',
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nREFUND INITIATED\n\nDear ${patientName},\n\nA refund of *${amountStr}* for Dr. ${doctorName} has been initiated.\n\n• Refund ID: ${safeString(data.refundId, refId)}\n• Processing Window: 5 to 7 business days\n\nTrack Status:\n${appBaseUrl}/patient/payments\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Refund of ${amountStr} initiated for Dr. ${doctorName}. Ref: ${safeString(data.refundId, refId).slice(0, 8)}. Reflects in 5-7 business days.`,
        note: `Refund: ${amountStr}`,
      };
    }

    // ─── REFUND SUCCESSFUL ───────────────────────────────────────────────────
    case NotificationEventType.REFUND_SUCCESSFUL: {
      const title = 'Refund Completed';
      const msg = `Your refund of ${amountStr} has been successfully processed by your bank.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Refund Completed: ${amountStr}`,
        emailHtml: buildBaseEmail({
          badgeText: 'REFUND CREDITED',
          badgeTheme: 'success',
          title: 'Refund Completed',
          subtitle: `The refund of ${amountStr} has been settled by the payment processor.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">Your refund of <strong>${amountStr}</strong> for consultation with <strong>Dr. ${doctorName}</strong> has been successfully credited.</p>
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
              <p style="margin: 4px 0; font-size: 13px;"><strong>Amount Credited:</strong> <span style="font-weight: 700; color: #16a34a;">${amountStr}</span></p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Refund ID:</strong> <span style="font-family: monospace;">${safeString(data.refundId, refId)}</span></p>
            </div>
          `,
          ctaLabel: 'View Account Details',
          ctaUrl: `${appBaseUrl}/patient/payments`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nREFUND CREDITED\n\nDear ${patientName},\n\nYour refund of *${amountStr}* has been processed successfully by your bank.\n\n• Refund ID: ${safeString(data.refundId, refId)}\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
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
        emailHtml: buildBaseEmail({
          badgeText: 'REFUND NOTICE',
          badgeTheme: 'danger',
          title,
          subtitle: `There was an unexpected gateway delay processing your refund.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">There was a processing delay with your refund of <strong>${amountStr}</strong>.</p>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
              <p style="margin: 0; font-size: 13px; color: #991b1b;">Our clinical finance team has been alerted and is manually reconciling your refund with the banking gateway.</p>
            </div>
          `,
          ctaLabel: 'Contact Clinical Support',
          ctaUrl: `${appBaseUrl}/support`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nREFUND NOTICE\n\nDear ${patientName},\n\nAn unexpected delay occurred processing your refund of *${amountStr}*. Our finance team is manually reconciling the transaction.\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Update on refund of ${amountStr}: Under manual review. Our team will resolve it shortly.`,
      };
    }

    // ─── CHECK IN REQUEST ────────────────────────────────────────────────────
    case NotificationEventType.CHECK_IN_REQUEST: {
      const code = safeString(data.kioskCode, '');
      const title = 'Clinic Check-In Request';
      const msg = `Kiosk check-in scan detected for appointment with Dr. ${doctorName}. Code: ${code}.`;
      return {
        title,
        inAppMessage: msg,
        emailSubject: `Clinic Check-In Request: Dr. ${doctorName}`,
        emailHtml: buildBaseEmail({
          badgeText: 'CHECK-IN SCAN',
          badgeTheme: 'primary',
          title: 'Clinic Check-In Verification',
          subtitle: `A reception kiosk scanner has detected your arrival at the clinic.`,
          bodyHtml: `
            <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
            <p style="margin: 0 0 16px 0;">A kiosk scan has been initiated for your consultation with <strong>Dr. ${doctorName}</strong>.</p>
            ${code ? `<p style="margin: 0 0 16px 0;">Verification Code: <strong>${code}</strong></p>` : ''}
            <p style="margin: 0 0 16px 0;">Please authorize the check-in on your device to confirm your presence in the waiting room.</p>
          `,
          ctaLabel: 'Authorize Check-In',
          ctaUrl: `${appBaseUrl}/patient/appointments`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\nCLINIC CHECK-IN SCAN\n\nDear ${patientName},\n\nA check-in scan was detected for your consultation with Dr. ${doctorName}.\n\nApprove Check-In:\n${appBaseUrl}/patient/appointments\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
        smsText: `CareUp: Check-in scan detected for Dr. ${doctorName}. Open ${appBaseUrl}/patient/appointments to approve.`,
      };
    }

    default: {
      const title = 'CareUp Clinical Notification';
      const msg = safeString(data.message, 'You have a new update.');
      return {
        title,
        inAppMessage: msg,
        emailSubject: title,
        emailHtml: buildBaseEmail({
          badgeText: 'CLINICAL NOTICE',
          badgeTheme: 'primary',
          title,
          bodyHtml: `<p style="margin: 0 0 16px 0;">${msg}</p>`,
          appBaseUrl,
        }),
        whatsAppText: `CAREUP CLINICAL APPOINTMENTS\n───────────────────────────────\n${msg}\n\n───────────────────────────────\nCareUp Healthcare | Clinical Service Notice`,
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
