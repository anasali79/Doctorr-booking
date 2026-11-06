import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { formatTime, formatDate } from '../common/utils/appointment.utils';

// ─── Inline SVG Icons for HTML Email Clients ─────────────────────────────────
const SVG_ICONS = {
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
  creditCard: `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0066cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>`,
  shieldCheck: `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
    </svg>`,
};

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildBaseEmailWrapper(
  badgeText: string,
  badgeBg: string,
  badgeColor: string,
  badgeBorder: string,
  title: string,
  bodyHtml: string,
  ctaLabel?: string,
  ctaUrl?: string,
  appBaseUrl: string = 'https://doctorbook-five.vercel.app',
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f6f8fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f6f8fb; padding: 24px 12px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.04);">
              
              <!-- Header -->
              <tr>
                <td style="background-color: #0055b3; background: linear-gradient(135deg, #004494 0%, #0066cc 100%); padding: 24px 32px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: rgba(255, 255, 255, 0.18); border-radius: 8px; width: 36px; height: 36px; text-align: center; vertical-align: middle;">
                        ${SVG_ICONS.medicalCross}
                      </td>
                      <td style="padding-left: 14px; vertical-align: middle;">
                        <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px; display: block; line-height: 1.2;">CareUp</span>
                        <span style="font-size: 11px; color: #bae0fd; letter-spacing: 0.6px; text-transform: uppercase; display: block; font-weight: 600;">Clinical Healthcare Appointments</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Badge & Title -->
              <tr>
                <td style="padding: 28px 32px 0 32px;">
                  <div style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 12px; border-radius: 20px;">
                    ${badgeText}
                  </div>
                  <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 14px 0 16px 0; line-height: 1.3;">
                    ${title}
                  </h1>
                </td>
              </tr>

              <!-- Content Body -->
              <tr>
                <td style="padding: 0 32px 28px 32px; color: #334155; font-size: 14px; line-height: 1.6;">
                  ${bodyHtml}

                  ${
                    ctaLabel && ctaUrl
                      ? `
                    <div style="margin: 28px 0 8px 0; text-align: left;">
                      <a href="${ctaUrl}" target="_blank" style="display: inline-block; background-color: #0066cc; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; letter-spacing: 0.2px;">
                        ${ctaLabel} &rarr;
                      </a>
                    </div>
                  `
                      : ''
                  }
                </td>
              </tr>

              <!-- Clinical Compliance Footer -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: left;">
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                    <strong>Confidential Medical Notice:</strong> This communication is generated by CareUp Healthcare Platform and contains confidential clinical records intended solely for the recipient.
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
                    CareUp Clinical Systems &bull; <a href="${appBaseUrl}/support" style="color: #0066cc; text-decoration: none;">Support Desk</a>
                  </p>
                  <p style="margin: 6px 0 0 0; font-size: 11px; color: #94a3b8;">
                    &copy; ${new Date().getFullYear()} CareUp. All rights reserved.
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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private apiKey: string | null = null;
  private fromEmail: string;
  private fromName: string;
  private appBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('BREVO_API_KEY') || null;
    this.fromEmail =
      this.configService.get<string>('BREVO_FROM_EMAIL') ||
      'schedula.sh@gmail.com';
    this.fromName =
      this.configService.get<string>('BREVO_FROM_NAME') || 'CareUp';
    const configuredFrontend =
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('CLIENT_BASE_URL');
    const rawAppBase = (
      this.configService.get<string>('APP_BASE_URL') || ''
    ).trim().replace(/\/+$/, '');
    const clientUrls = (
      this.configService.get<string>('CLIENT_URL') || ''
    )
      .split(',')
      .map((u) => u.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const vercelUrl = clientUrls.find((u) => u.includes('vercel.app'));
    const localUrl =
      clientUrls.find((u) => u.includes('3000')) || 'http://localhost:3000';

    if (configuredFrontend) {
      this.appBaseUrl = configuredFrontend.trim().replace(/\/+$/, '');
    } else if (rawAppBase && !rawAppBase.includes('onrender.com') && !rawAppBase.includes(':3001')) {
      this.appBaseUrl = rawAppBase;
    } else if (isProd && vercelUrl) {
      this.appBaseUrl = vercelUrl;
    } else {
      this.appBaseUrl = localUrl || vercelUrl || 'https://doctorbook-five.vercel.app';
    }

    if (this.apiKey && this.apiKey !== 'your_brevo_api_key_here') {
      this.logger.log('Brevo Email Service initialized.');
    } else {
      this.logger.warn(
        'BREVO_API_KEY is not configured. Email service will run in mock mode (log only).',
      );
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
  ): Promise<boolean> {
    const textContent = htmlToPlainText(htmlContent);

    if (!this.apiKey || this.apiKey === 'your_brevo_api_key_here') {
      this.logger.log(
        `[Mock Email Send]\nTo: ${to}\nSubject: ${subject}\nContent: ${textContent}`,
      );
      return true;
    }

    try {
      this.logger.log(
        `Sending email to ${to} with subject "${subject}" via Brevo...`,
      );

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.fromName, email: this.fromEmail },
          to: [{ email: to }],
          subject,
          htmlContent,
          textContent,
        }),
      });

      const result = (await response.json()) as {
        messageId?: string;
        message?: string;
        code?: string;
      };

      if (!response.ok) {
        this.logger.error(
          `Brevo API returned error status ${response.status}: ${result?.message ?? JSON.stringify(result)}`,
        );
        return false;
      }

      if (result?.code && result.code !== 'success') {
        this.logger.error(`Brevo API soft error: ${result.message}`);
        return false;
      }

      this.logger.log(
        `Email sent successfully to ${to} via Brevo. Message ID: ${result?.messageId}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      return false;
    }
  }

  async sendBookingConfirmation(
    to: string,
    patientName: string,
    doctorName: string,
    specialization: string,
    date: string,
    startTime: string,
    tokenNumber: number | null,
    contactnumber: string | null,
    appointmentId: string,
  ): Promise<boolean> {
    const formattedDate = formatDate(date);
    const formattedTime = formatTime(startTime);

    let qrImageTag = '';
    try {
      const checkInUrl = `${this.appBaseUrl}/checkin/${appointmentId}`;
      const encodedPayload = encodeURIComponent(checkInUrl);
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=0066cc&bgcolor=ffffff&data=${encodedPayload}`;
      qrImageTag = `
        <div style="text-align: center; margin: 24px 0; background-color: #f8fafc; padding: 20px; border: 1px dashed #0066cc; border-radius: 8px;">
          <p style="margin: 0 0 8px 0; color: #0f172a; font-weight: 700; font-size: 14px;">Clinic Check-In QR Code</p>
          <a href="${checkInUrl}" target="_blank" style="display: inline-block;">
            <img src="${qrImageUrl}" alt="Appointment QR Code"
                 width="160" height="160"
                 style="border: 2px solid #0066cc; border-radius: 8px; display: block; margin: 0 auto;" />
          </a>
          <p style="margin: 10px 0 14px 0; font-size: 12px; color: #64748b;">
            Scan with your smartphone at the clinic reception to enter the queue.
          </p>
          <a href="${checkInUrl}" target="_blank"
             style="display: inline-block; background-color: #0066cc; color: #ffffff; padding: 8px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; text-decoration: none;">
            Open Check-In Page &rarr;
          </a>
        </div>`;
    } catch (err) {
      this.logger.warn('Failed to generate QR code for booking email:', err);
    }

    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
      <p style="margin: 0 0 16px 0;">Your clinical appointment has been confirmed with <strong>Dr. ${doctorName}</strong>.</p>
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 18px 0;">
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.6px;">Consultation Summary</td>
                ${tokenNumber ? `<td align="right"><span style="background-color: #0066cc; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px;">TOKEN #${tokenNumber}</span></td>` : ''}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b; width: 34%;">Doctor:</td>
                <td style="padding: 5px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${SVG_ICONS.doctor} Dr. ${doctorName} <span style="font-weight: 400; color: #64748b; font-size: 12px;">(${specialization})</span></td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">Date:</td>
                <td style="padding: 5px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${SVG_ICONS.calendar} ${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">Time:</td>
                <td style="padding: 5px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${SVG_ICONS.clock} ${formattedTime}</td>
              </tr>
              ${
                contactnumber
                  ? `
                <tr>
                  <td style="padding: 5px 0; font-size: 13px; color: #64748b;">Clinic Contact:</td>
                  <td style="padding: 5px 0; font-size: 13px; color: #334155;">${contactnumber}</td>
                </tr>
              `
                  : ''
              }
            </table>
          </td>
        </tr>
      </table>

      <p style="margin: 16px 0 0 0;">Please arrive <strong>10 minutes prior</strong> to your scheduled slot for registration.</p>
      ${qrImageTag}
    `;

    const htmlContent = buildBaseEmailWrapper(
      'CONFIRMED',
      '#f0fdf4',
      '#16a34a',
      '#bbf7d0',
      'Appointment Confirmed',
      bodyHtml,
      'View My Appointments',
      `${this.appBaseUrl}/patient/appointments`,
      this.appBaseUrl,
    );

    return this.sendEmail(
      to,
      `Appointment Confirmed: Dr. ${doctorName}`,
      htmlContent,
    );
  }

  async sendCancellationNotification(
    to: string,
    patientName: string,
    doctorName: string,
    date: string,
    startTime: string,
  ): Promise<boolean> {
    const formattedDate = formatDate(date);
    const formattedTime = formatTime(startTime);

    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
      <p style="margin: 0 0 16px 0;">Your appointment with <strong>Dr. ${doctorName}</strong> on <strong>${formattedDate}</strong> at <strong>${formattedTime}</strong> has been cancelled.</p>
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
        <p style="margin: 0; font-size: 13px; color: #991b1b;">If a consultation fee was paid, a full refund has been initiated to your original payment method.</p>
      </div>
      <p style="margin: 16px 0 0 0;">If you wish to reschedule or select another specialist, please visit the portal.</p>
    `;

    const htmlContent = buildBaseEmailWrapper(
      'CANCELLED',
      '#fef2f2',
      '#dc2626',
      '#fecaca',
      'Appointment Cancelled',
      bodyHtml,
      'Book a New Appointment',
      `${this.appBaseUrl}/doctors`,
      this.appBaseUrl,
    );

    return this.sendEmail(
      to,
      `Appointment Cancelled: Dr. ${doctorName}`,
      htmlContent,
    );
  }

  async sendRescheduleNotification(
    to: string,
    patientName: string,
    doctorName: string,
    specialization: string,
    date: string,
    startTime: string,
    tokenNumber: number | null,
    previousDate?: string,
    previousTime?: string,
  ): Promise<boolean> {
    const formattedDate = formatDate(date);
    const formattedTime = formatTime(startTime);
    const formattedPreviousDate = previousDate
      ? formatDate(previousDate)
      : null;
    const formattedPreviousTime = previousTime
      ? formatTime(previousTime)
      : null;

    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
      <p style="margin: 0 0 16px 0;">Your appointment has been successfully rescheduled. Please find your updated schedule details below:</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 18px 0;">
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.6px;">Updated Consultation Slot</td>
                ${tokenNumber ? `<td align="right"><span style="background-color: #0066cc; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px;">TOKEN #${tokenNumber}</span></td>` : ''}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b; width: 34%;">Doctor:</td>
                <td style="padding: 5px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${SVG_ICONS.doctor} Dr. ${doctorName} (${specialization})</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">New Date:</td>
                <td style="padding: 5px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${SVG_ICONS.calendar} ${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">New Time:</td>
                <td style="padding: 5px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${SVG_ICONS.clock} ${formattedTime}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${
        formattedPreviousDate
          ? `
        <div style="background-color: #f1f5f9; border-left: 3px solid #64748b; padding: 10px 14px; border-radius: 4px; margin-bottom: 16px;">
          <span style="font-size: 12px; color: #475569;"><strong>Previous Slot:</strong> <del>${formattedPreviousDate} at ${formattedPreviousTime}</del></span>
        </div>
      `
          : ''
      }

      <p style="margin: 16px 0 0 0;">Please arrive <strong>10 minutes prior</strong> to your rescheduled slot for check-in.</p>
    `;

    const htmlContent = buildBaseEmailWrapper(
      'RESCHEDULED',
      '#eff6ff',
      '#0066cc',
      '#bae0fd',
      'Appointment Rescheduled',
      bodyHtml,
      'View Updated Appointment',
      `${this.appBaseUrl}/patient/appointments`,
      this.appBaseUrl,
    );

    return this.sendEmail(
      to,
      `Appointment Rescheduled: Dr. ${doctorName}`,
      htmlContent,
    );
  }

  async sendAppointmentReminder(
    to: string,
    patientName: string,
    doctorName: string,
    date: string,
    startTime: string,
    tokenNumber: number | null,
    leadTimeLabel: string = 'today',
  ): Promise<boolean> {
    const formattedDate = formatDate(date);
    const formattedTime = formatTime(startTime);

    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
      <p style="margin: 0 0 16px 0;">This is a scheduled reminder for your clinical consultation with <strong>Dr. ${doctorName}</strong> scheduled <strong>${leadTimeLabel}</strong>.</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 18px 0;">
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.6px;">Appointment Particulars</td>
                ${tokenNumber ? `<td align="right"><span style="background-color: #0066cc; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px;">TOKEN #${tokenNumber}</span></td>` : ''}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b; width: 34%;">Doctor:</td>
                <td style="padding: 5px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${SVG_ICONS.doctor} Dr. ${doctorName}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">Date:</td>
                <td style="padding: 5px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${SVG_ICONS.calendar} ${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">Time:</td>
                <td style="padding: 5px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${SVG_ICONS.clock} ${formattedTime}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin: 16px 0 0 0;">Please arrive 10 minutes prior to your time. Scan your QR code at the clinic reception to enter the queue.</p>
    `;

    const htmlContent = buildBaseEmailWrapper(
      `REMINDER: ${leadTimeLabel.toUpperCase()}`,
      '#eff6ff',
      '#0066cc',
      '#bae0fd',
      'Appointment Reminder',
      bodyHtml,
      'View Appointment Details',
      `${this.appBaseUrl}/patient/appointments`,
      this.appBaseUrl,
    );

    return this.sendEmail(
      to,
      `Reminder: Appointment ${leadTimeLabel} with Dr. ${doctorName}`,
      htmlContent,
    );
  }

  async sendPaymentSuccess(
    to: string,
    patientName: string,
    doctorName: string,
    amountInPaise: number,
    orderId: string,
    paymentId: string,
    date: string,
    startTime: string,
  ): Promise<boolean> {
    const amountFormatted = `₹${(amountInPaise / 100).toFixed(2)}`;
    const formattedDate = formatDate(date);
    const formattedTime = formatTime(startTime);

    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
      <p style="margin: 0 0 16px 0;">We have successfully verified your payment of <strong>${amountFormatted}</strong> for your consultation with <strong>Dr. ${doctorName}</strong>.</p>
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 18px 0;">
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.6px;">Payment Breakdown</td>
                <td align="right"><span style="background-color: #16a34a; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px;">VERIFIED</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b; width: 34%;">Amount Paid:</td>
                <td style="padding: 5px 0; font-size: 16px; font-weight: 700; color: #16a34a;">${amountFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">Payment ID:</td>
                <td style="padding: 5px 0; font-size: 13px; font-family: monospace; color: #334155;">${paymentId}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">Order ID:</td>
                <td style="padding: 5px 0; font-size: 13px; font-family: monospace; color: #334155;">${orderId}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">Scheduled Slot:</td>
                <td style="padding: 5px 0; font-size: 13px; color: #334155;">${formattedDate} at ${formattedTime}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin: 16px 0 0 0;">An official invoice is archived in your Patient Portal for reimbursement claims.</p>
    `;

    const htmlContent = buildBaseEmailWrapper(
      'PAYMENT VERIFIED',
      '#f0fdf4',
      '#16a34a',
      '#bbf7d0',
      'Payment Receipt Verified',
      bodyHtml,
      'View Payment History',
      `${this.appBaseUrl}/patient/payments`,
      this.appBaseUrl,
    );

    return this.sendEmail(
      to,
      `Payment Successful: Consultation with Dr. ${doctorName}`,
      htmlContent,
    );
  }

  async sendRefundInitiated(
    to: string,
    patientName: string,
    doctorName: string,
    amountInPaise: number,
    refundId: string,
    reason?: string,
  ): Promise<boolean> {
    const amountFormatted = `₹${(amountInPaise / 100).toFixed(2)}`;

    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
      <p style="margin: 0 0 16px 0;">A refund of <strong>${amountFormatted}</strong> for your consultation with <strong>Dr. ${doctorName}</strong> has been initiated.</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 18px 0;">
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.6px;">Refund Statement</td>
                <td align="right"><span style="background-color: #0066cc; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px;">INITIATED</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b; width: 34%;">Refund Amount:</td>
                <td style="padding: 5px 0; font-size: 16px; font-weight: 700; color: #0066cc;">${amountFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">Refund ID:</td>
                <td style="padding: 5px 0; font-size: 13px; font-family: monospace; color: #334155;">${refundId}</td>
              </tr>
              ${
                reason
                  ? `
                <tr>
                  <td style="padding: 5px 0; font-size: 13px; color: #64748b;">Reason:</td>
                  <td style="padding: 5px 0; font-size: 13px; color: #334155;">${reason}</td>
                </tr>
              `
                  : ''
              }
              <tr>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">Processing Window:</td>
                <td style="padding: 5px 0; font-size: 13px; color: #64748b;">5 to 7 business days to original payment method</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;

    const htmlContent = buildBaseEmailWrapper(
      'REFUND INITIATED',
      '#eff6ff',
      '#0066cc',
      '#bae0fd',
      'Refund Process Initiated',
      bodyHtml,
      'View Refund Status',
      `${this.appBaseUrl}/patient/payments`,
      this.appBaseUrl,
    );

    return this.sendEmail(
      to,
      `Refund Initiated: Consultation with Dr. ${doctorName}`,
      htmlContent,
    );
  }

  async sendRefundCompleted(
    to: string,
    patientName: string,
    doctorName: string,
    amountInPaise: number,
    refundId: string,
  ): Promise<boolean> {
    const amountFormatted = `₹${(amountInPaise / 100).toFixed(2)}`;

    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
      <p style="margin: 0 0 16px 0;">Your refund of <strong>${amountFormatted}</strong> for appointment with <strong>Dr. ${doctorName}</strong> has been successfully processed by your bank.</p>

      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 18px 0;">
        <p style="margin: 4px 0; font-size: 14px;"><strong>Amount Credited:</strong> <span style="font-weight: 700; color: #16a34a;">${amountFormatted}</span></p>
        <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Refund ID:</strong> <span style="font-family: monospace;">${refundId}</span></p>
      </div>
    `;

    const htmlContent = buildBaseEmailWrapper(
      'REFUND CREDITED',
      '#f0fdf4',
      '#16a34a',
      '#bbf7d0',
      'Refund Completed',
      bodyHtml,
      'View Account',
      `${this.appBaseUrl}/patient/payments`,
      this.appBaseUrl,
    );

    return this.sendEmail(
      to,
      `Refund Completed: Consultation with Dr. ${doctorName}`,
      htmlContent,
    );
  }

  async sendRefundFailed(
    to: string,
    patientName: string,
    doctorName: string,
    amountInPaise: number,
    reason?: string,
  ): Promise<boolean> {
    const amountFormatted = `₹${(amountInPaise / 100).toFixed(2)}`;

    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Dear ${patientName},</p>
      <p style="margin: 0 0 16px 0;">An unexpected issue occurred while processing your refund of <strong>${amountFormatted}</strong> for consultation with <strong>Dr. ${doctorName}</strong>.</p>
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
        <p style="margin: 0; font-size: 13px; color: #991b1b;">Our finance team has been notified and is manually resolving your transaction with the banking provider.</p>
      </div>
    `;

    const htmlContent = buildBaseEmailWrapper(
      'REFUND NOTICE',
      '#fef2f2',
      '#dc2626',
      '#fecaca',
      'Refund Notice: Action Required',
      bodyHtml,
      'Contact Support',
      `${this.appBaseUrl}/support`,
      this.appBaseUrl,
    );

    return this.sendEmail(
      to,
      `Refund Notice for Consultation with Dr. ${doctorName}`,
      htmlContent,
    );
  }

  async sendWelcomeEmail(
    to: string,
    name: string,
    role: string,
  ): Promise<void> {
    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Dear ${name},</p>
      <p style="margin: 0 0 16px 0;">
        Welcome to CareUp. Your account has been registered with the role of <strong>${role.toLowerCase()}</strong>.
      </p>
      <p style="margin: 0 0 16px 0;">
        With CareUp, you can manage appointments, view clinical updates, and streamline medical appointments with ease.
      </p>
    `;

    const htmlContent = buildBaseEmailWrapper(
      'ACCOUNT VERIFIED',
      '#eff6ff',
      '#0066cc',
      '#bae0fd',
      'Welcome to CareUp',
      bodyHtml,
      'Get Started',
      `${this.appBaseUrl}`,
      this.appBaseUrl,
    );

    await this.sendEmail(to, 'Welcome to CareUp Healthcare', htmlContent);
  }

  async sendDoctorVerificationStatusEmail(
    to: string,
    doctorName: string,
    status: 'approved' | 'rejected' | 'suspended' | 'resubmission_required',
    reason?: string,
  ): Promise<void> {
    let badge: string;
    let badgeBg: string;
    let badgeColor: string;
    let badgeBorder: string;
    let title: string;
    let ctaLabel: string;
    let bodyHtml: string;

    switch (status) {
      case 'approved':
        badge = 'APPROVED';
        badgeBg = '#f0fdf4';
        badgeColor = '#16a34a';
        badgeBorder = '#86efac';
        title = 'Your CareUp Doctor Account Has Been Approved';
        ctaLabel = 'Go to Dashboard';
        bodyHtml = `
          <p style="margin: 0 0 16px 0;">Dear Dr. ${doctorName},</p>
          <p style="margin: 0 0 16px 0;">
            Congratulations! Your professional credentials have been reviewed and your CareUp doctor account has been <strong style="color: #16a34a;">approved</strong>.
          </p>
          <p style="margin: 0 0 16px 0;">
            You can now access all doctor features including appointment management, patient records, and prescription tools.
          </p>
        `;
        break;

      case 'rejected':
        badge = 'NOT APPROVED';
        badgeBg = '#fff1f2';
        badgeColor = '#be123c';
        badgeBorder = '#fca5a5';
        title = 'Your Verification Application Was Not Approved';
        ctaLabel = 'Resubmit Application';
        bodyHtml = `
          <p style="margin: 0 0 16px 0;">Dear Dr. ${doctorName},</p>
          <p style="margin: 0 0 16px 0;">
            After reviewing your submitted credentials, we were unable to approve your doctor account at this time.
          </p>
          ${
            reason
              ? `
          <div style="background-color: #fff1f2; border-left: 4px solid #be123c; padding: 14px 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; font-size: 13px; color: #9f1239; font-weight: 600;">Reason for rejection:</p>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #1e293b;">${reason}</p>
          </div>
          `
              : ''
          }
          <p style="margin: 0 0 16px 0;">
            Please correct the issues mentioned above and resubmit your application from the CareUp portal.
          </p>
        `;
        break;

      case 'suspended':
        badge = 'SUSPENDED';
        badgeBg = '#fff7ed';
        badgeColor = '#c2410c';
        badgeBorder = '#fed7aa';
        title = 'Your CareUp Doctor Account Has Been Suspended';
        ctaLabel = 'Contact Support';
        bodyHtml = `
          <p style="margin: 0 0 16px 0;">Dear Dr. ${doctorName},</p>
          <p style="margin: 0 0 16px 0;">
            Your CareUp doctor account has been <strong style="color: #c2410c;">suspended</strong> pending a review.
          </p>
          ${
            reason
              ? `
          <div style="background-color: #fff7ed; border-left: 4px solid #c2410c; padding: 14px 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; font-size: 13px; color: #9a3412; font-weight: 600;">Reason:</p>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #1e293b;">${reason}</p>
          </div>
          `
              : ''
          }
          <p style="margin: 0 0 16px 0;">
            If you believe this is an error, please contact our support team. Your appointment history remains preserved.
          </p>
        `;
        break;

      case 'resubmission_required':
        badge = 'ACTION REQUIRED';
        badgeBg = '#fffbeb';
        badgeColor = '#d97706';
        badgeBorder = '#fcd34d';
        title = 'Additional Documents Required for Verification';
        ctaLabel = 'Resubmit Documents';
        bodyHtml = `
          <p style="margin: 0 0 16px 0;">Dear Dr. ${doctorName},</p>
          <p style="margin: 0 0 16px 0;">
            Our team has reviewed your verification submission and requires additional information or documents before we can proceed.
          </p>
          ${
            reason
              ? `
          <div style="background-color: #fffbeb; border-left: 4px solid #d97706; padding: 14px 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600;">What is needed:</p>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #1e293b;">${reason}</p>
          </div>
          `
              : ''
          }
          <p style="margin: 0 0 16px 0;">
            Please log in to the CareUp portal, correct the requested items and resubmit your application.
          </p>
        `;
        break;

      default:
        return;
    }

    const htmlContent = buildBaseEmailWrapper(
      badge,
      badgeBg,
      badgeColor,
      badgeBorder,
      title,
      bodyHtml,
      ctaLabel,
      `${this.appBaseUrl}/doctor/verification`,
      this.appBaseUrl,
    );

    const subjects: Record<string, string> = {
      approved: 'Your CareUp Doctor Account is Approved!',
      rejected: 'CareUp Verification Update — Action Required',
      suspended: 'Important: Your CareUp Account Has Been Suspended',
      resubmission_required: 'CareUp: Additional Documents Required',
    };

    await this.sendEmail(to, subjects[status], htmlContent);
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    token: string,
    clientOrigin?: string,
  ): Promise<void> {
    const baseUrl =
      clientOrigin && !clientOrigin.includes('onrender.com') && !clientOrigin.includes(':3001')
        ? clientOrigin.trim().replace(/\/+$/, '')
        : this.appBaseUrl;
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Hello ${name},</p>
      <p style="margin: 0 0 16px 0;">
        Thank you for registering with CareUp. To activate your account and start booking appointments or managing your clinical practice, please verify your email address.
      </p>
      <div style="background-color: #f8fafc; border-left: 4px solid #0066cc; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 13px; color: #475569;">
          <strong>Security Note:</strong> This verification link is valid for <strong>24 hours</strong>. If you did not create a CareUp account, you can safely ignore this email.
        </p>
      </div>
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
        Or paste this link into your browser:
      </p>
      <p style="margin: 0; font-size: 12px; word-break: break-all; color: #0066cc;">
        ${verificationUrl}
      </p>
    `;

    const htmlContent = buildBaseEmailWrapper(
      'EMAIL VERIFICATION',
      '#eff6ff',
      '#0066cc',
      '#bae0fd',
      'Verify your CareUp account',
      bodyHtml,
      'Verify Email Address',
      verificationUrl,
      baseUrl,
    );

    await this.sendEmail(to, 'Verify your email address - CareUp', htmlContent);
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
    clientOrigin?: string,
  ): Promise<void> {
    const baseUrl =
      clientOrigin && !clientOrigin.includes('onrender.com') && !clientOrigin.includes(':3001')
        ? clientOrigin.trim().replace(/\/+$/, '')
        : this.appBaseUrl;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Hello ${name},</p>
      <p style="margin: 0 0 16px 0;">
        We received a request to reset the password for your CareUp account. Click the button below to choose a new password.
      </p>
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 13px; color: #991b1b;">
          <strong>Security Notice:</strong> This password reset link is valid for <strong>1 hour</strong> only. If you did not request this, please disregard this email — your password will remain secure and unchanged.
        </p>
      </div>
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
        Or paste this link into your browser:
      </p>
      <p style="margin: 0; font-size: 12px; word-break: break-all; color: #0066cc;">
        ${resetUrl}
      </p>
    `;

    const htmlContent = buildBaseEmailWrapper(
      'PASSWORD RESET',
      '#fef2f2',
      '#dc2626',
      '#fecaca',
      'Reset your CareUp password',
      bodyHtml,
      'Reset Password',
      resetUrl,
      baseUrl,
    );

    await this.sendEmail(to, 'Reset your password - CareUp', htmlContent);
  }

  async sendPasswordResetSuccessEmail(
    to: string,
    name: string,
    clientOrigin?: string,
  ): Promise<void> {
    const baseUrl =
      clientOrigin && !clientOrigin.includes('onrender.com') && !clientOrigin.includes(':3001')
        ? clientOrigin.trim().replace(/\/+$/, '')
        : this.appBaseUrl;
    const loginUrl = `${baseUrl}/login`;
    const bodyHtml = `
      <p style="margin: 0 0 16px 0;">Hello ${name},</p>
      <p style="margin: 0 0 16px 0;">
        Your CareUp account password has been successfully updated. You can now log in using your new credentials.
      </p>
      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 13px; color: #166534;">
          <strong>Security Notice:</strong> If you did not perform this password change, please contact our support team immediately.
        </p>
      </div>
    `;

    const htmlContent = buildBaseEmailWrapper(
      'SECURITY NOTICE',
      '#f0fdf4',
      '#16a34a',
      '#bbf7d0',
      'Your password was changed',
      bodyHtml,
      'Sign In',
      loginUrl,
      baseUrl,
    );

    await this.sendEmail(to, 'Your CareUp password was updated', htmlContent);
  }
}
