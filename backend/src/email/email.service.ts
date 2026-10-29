import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { formatTime, formatDate } from '../common/utils/appointment.utils';

function buildTokenMsg(tokenNumber: number | null): string {
  if (!tokenNumber) return '';
  return `<p style="margin: 5px 0; color: #333333;"><strong>Token Number:</strong> ${tokenNumber}</p>`;
}

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

function buildHeader(title: string, titleColor: string): string {
  return `
    <div style="background-color: #0066cc; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <p style="margin: 0; font-size: 22px; font-weight: bold; color: #ffffff; letter-spacing: 1px;"> CareUp</p>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #bae0fd; letter-spacing: 0.5px; text-transform: uppercase;">Healthcare Appointment Companion</p>
    </div>
    <div style="text-align: center; padding: 24px 20px 0 20px;">
      <h2 style="color: ${titleColor}; margin: 0; font-size: 22px;">${title}</h2>
    </div>
  `;
}

function buildFooter(): string {
  return `
    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 24px 0 16px 0;" />
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="text-align: center; padding-bottom: 8px;">
          <p style="margin: 0; font-size: 12px; color: #9e9e9e;">
            This is an automated email from <strong>CareUp</strong>. Please do not reply directly.
          </p>
          <p style="margin: 6px 0 0 0; font-size: 11px; color: #bdbdbd;">
            © ${new Date().getFullYear()} CareUp &nbsp;|&nbsp;
            <a href="https://schedula.app/support" style="color: #bdbdbd; text-decoration: underline;">Support</a> &nbsp;|&nbsp;
            <a href="https://schedula.app/unsubscribe" style="color: #bdbdbd; text-decoration: underline;">Unsubscribe</a>
          </p>
        </td>
      </tr>
    </table>
  `;
}

function buildCtaButton(label: string, url: string, color: string): string {
  return `
    <div style="text-align: center; margin: 20px 0;">
      <a href="${url}"
         style="display: inline-block; padding: 12px 28px; background-color: ${color}; color: #ffffff;
                text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: bold;">
        ${label}
      </a>
    </div>
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
      this.configService.get<string>('BREVO_FROM_EMAIL') || 'schedula.sh@gmail.com';
    this.fromName = this.configService.get<string>('BREVO_FROM_NAME') || 'CareUp';
    this.appBaseUrl = this.configService.get<string>('APP_BASE_URL') || 'https://schedula.app';

    if (this.apiKey && this.apiKey !== 'your_brevo_api_key_here') {
      this.logger.log('Brevo Email Service initialized.');
    } else {
      this.logger.warn(
        'BREVO_API_KEY is not configured. Email service will run in mock mode (log only).',
      );
    }
  }

  async sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
    const textContent = htmlToPlainText(htmlContent);

    if (!this.apiKey || this.apiKey === 'your_brevo_api_key_here') {
      this.logger.log(`[Mock Email Send]\nTo: ${to}\nSubject: ${subject}\nContent: ${textContent}`);
      return true;
    }

    try {
      this.logger.log(`Sending email to ${to} with subject "${subject}" via Brevo...`);

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
    const tokenMsg = buildTokenMsg(tokenNumber);

    const contactMsg = contactnumber
      ? `<p style="margin: 5px 0; color: #333333;"><strong>Contact:</strong> ${contactnumber}</p>`
      : '';

    let qrImageTag = '';
    try {
      const qrPayload = JSON.stringify({ appointmentId });
      const encodedPayload = encodeURIComponent(qrPayload);
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=1a6b3c&bgcolor=ffffff&data=${encodedPayload}`;
      qrImageTag = `
        <div style="text-align: center; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; color: #333333; font-weight: bold;">Your Check-In QR Code</p>
          <img src="${qrImageUrl}" alt="Appointment QR Code"
               width="180" height="180"
               style="border: 2px solid #0066cc; border-radius: 8px; display: block; margin: 0 auto;" />
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #9e9e9e;">
            Scan this QR at the hospital kiosk. You will receive a notification on your phone — tap Approve to check in.
          </p>
        </div>`;
    } catch (err) {
      this.logger.warn('Failed to generate QR code for booking email:', err);
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        ${buildHeader('Appointment Confirmed! ✅', '#2e7d32')}
        <div style="padding: 20px;">
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 4px;">
            <p style="color: #333333; font-size: 16px; margin-top: 0;">Hello <strong>${patientName}</strong>,</p>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              Your appointment has been successfully booked with <strong>${doctorName}</strong>.
            </p>
            <div style="background-color: #ffffff; padding: 15px; border-radius: 4px; border-left: 4px solid #2e7d32; margin: 15px 0;">
              <p style="margin: 5px 0; color: #333333;"><strong>Doctor:</strong> ${doctorName} (${specialization})</p>
              <p style="margin: 5px 0; color: #333333;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 5px 0; color: #333333;"><strong>Time:</strong> ${formattedTime}</p>
              ${tokenMsg}
              ${contactMsg}
            </div>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              Please arrive <strong>5 minutes</strong> before your scheduled time.
            </p>
            ${qrImageTag}
          </div>
          ${buildCtaButton('View My Appointments', `${this.appBaseUrl}/appointments`, '#2e7d32')}
        </div>
        ${buildFooter()}
      </div>
    `;

    return this.sendEmail(to, `Appointment Booked: ${doctorName}`, htmlContent);
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

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        ${buildHeader('Appointment Cancelled ', '#c62828')}
        <div style="padding: 20px;">
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 4px;">
            <p style="color: #333333; font-size: 16px; margin-top: 0;">Hello <strong>${patientName}</strong>,</p>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              Your appointment with <strong>${doctorName}</strong> on <strong>${formattedDate}</strong> at <strong>${formattedTime}</strong> has been cancelled.
            </p>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              If you'd like to book a new appointment, you can do so from the app.
            </p>
          </div>
          ${buildCtaButton('Book a New Appointment', `${this.appBaseUrl}/book`, '#c62828')}
        </div>
        ${buildFooter()}
      </div>
    `;

    return this.sendEmail(to, `Appointment Cancelled: ${doctorName}`, htmlContent);
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
    const formattedPreviousDate = previousDate ? formatDate(previousDate) : null;
    const formattedPreviousTime = previousTime ? formatTime(previousTime) : null;
    const tokenMsg = buildTokenMsg(tokenNumber);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        ${buildHeader('Appointment Rescheduled ', '#1976d2')}
        <div style="padding: 20px;">
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 4px;">
            <p style="color: #333333; font-size: 16px; margin-top: 0;">Hello <strong>${patientName}</strong>,</p>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              Your appointment has been successfully rescheduled. Here are your updated details:
            </p>

            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 4px; border-left: 4px solid #4caf50; margin-bottom: 12px;">
              <p style="margin: 0 0 5px 0; color: #2e7d32; font-weight: bold; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">New Schedule</p>
              <p style="margin: 5px 0; color: #333333;"><strong>Doctor:</strong> ${doctorName} (${specialization})</p>
              <p style="margin: 5px 0; color: #333333;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 5px 0; color: #333333;"><strong>Time:</strong> ${formattedTime}</p>
              ${tokenMsg}
            </div>

            ${formattedPreviousDate ? `
            <div style="background-color: #ffebee; padding: 15px; border-radius: 4px; border-left: 4px solid #ef5350; margin-bottom: 12px;">
              <p style="margin: 0 0 5px 0; color: #c62828; font-weight: bold; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">Previous Schedule (Cancelled)</p>
              <p style="margin: 5px 0; color: #757575;"><strong>Date:</strong> <span style="text-decoration: line-through;">${formattedPreviousDate}</span></p>
              <p style="margin: 5px 0; color: #757575;"><strong>Time:</strong> <span style="text-decoration: line-through;">${formattedPreviousTime}</span></p>
            </div>
            ` : ''}

            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              Please arrive <strong>5 minutes</strong> before your rescheduled time. For any questions, contact our support team.
            </p>
          </div>
          ${buildCtaButton('View My Appointments', `${this.appBaseUrl}/appointments`, '#1976d2')}
        </div>
        ${buildFooter()}
      </div>
    `;

    return this.sendEmail(
      to,
      `Your Appointment with ${doctorName} Has Been Rescheduled`,
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
    const tokenMsg = buildTokenMsg(tokenNumber);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        ${buildHeader('Appointment Reminder ⏰', '#d32f2f')}
        <div style="padding: 20px;">
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 4px;">
            <p style="color: #333333; font-size: 16px; margin-top: 0;">Hello <strong>${patientName}</strong>,</p>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              Friendly reminder — your appointment with <strong>${doctorName}</strong> is coming up <strong>${leadTimeLabel}</strong>!
            </p>
            <div style="background-color: #ffffff; padding: 15px; border-radius: 4px; border-left: 4px solid #d32f2f; margin: 15px 0;">
              <p style="margin: 5px 0; color: #333333;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 5px 0; color: #333333;"><strong>Time:</strong> ${formattedTime}</p>
              ${tokenMsg}
            </div>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              Please arrive <strong>5 minutes</strong> before your scheduled slot.
            </p>
          </div>
          ${buildCtaButton('View Appointment Details', `${this.appBaseUrl}/appointments`, '#d32f2f')}
        </div>
        ${buildFooter()}
      </div>
    `;

    return this.sendEmail(to, `Reminder: Appointment ${leadTimeLabel} with ${doctorName}`, htmlContent);
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

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        ${buildHeader('Payment Received! 💳', '#2e7d32')}
        <div style="padding: 20px;">
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 4px;">
            <p style="color: #333333; font-size: 16px; margin-top: 0;">Hello <strong>${patientName}</strong>,</p>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              We have successfully received your payment of <strong>${amountFormatted}</strong> for your consultation with <strong>${doctorName}</strong>.
            </p>
            <div style="background-color: #ffffff; padding: 15px; border-radius: 4px; border-left: 4px solid #2e7d32; margin: 15px 0;">
              <p style="margin: 5px 0; color: #333333;"><strong>Amount Paid:</strong> ${amountFormatted}</p>
              <p style="margin: 5px 0; color: #333333;"><strong>Payment ID:</strong> ${paymentId}</p>
              <p style="margin: 5px 0; color: #333333;"><strong>Order ID:</strong> ${orderId}</p>
              <p style="margin: 5px 0; color: #333333;"><strong>Appointment Date:</strong> ${formattedDate} at ${formattedTime}</p>
            </div>
            <p style="color: #555555; line-height: 1.5; font-size: 13px;">
              A formal receipt is available in your Patient Portal under Payment History.
            </p>
          </div>
          ${buildCtaButton('View Payment History', `${this.appBaseUrl}/patient/dashboard`, '#2e7d32')}
        </div>
        ${buildFooter()}
      </div>
    `;

    return this.sendEmail(to, `Payment Successful: Consultation with ${doctorName}`, htmlContent);
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

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        ${buildHeader('Refund Initiated ↩️', '#0066cc')}
        <div style="padding: 20px;">
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 4px;">
            <p style="color: #333333; font-size: 16px; margin-top: 0;">Hello <strong>${patientName}</strong>,</p>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              A refund of <strong>${amountFormatted}</strong> for your consultation with <strong>${doctorName}</strong> has been initiated.
            </p>
            <div style="background-color: #ffffff; padding: 15px; border-radius: 4px; border-left: 4px solid #0066cc; margin: 15px 0;">
              <p style="margin: 5px 0; color: #333333;"><strong>Refund Amount:</strong> ${amountFormatted}</p>
              <p style="margin: 5px 0; color: #333333;"><strong>Refund Reference:</strong> ${refundId}</p>
              ${reason ? `<p style="margin: 5px 0; color: #333333;"><strong>Reason:</strong> ${reason}</p>` : ''}
              <p style="margin: 5px 0; color: #757575; font-size: 13px;">Refunds typically appear in your original payment method in 5-7 business days.</p>
            </div>
          </div>
          ${buildCtaButton('View Refund Status', `${this.appBaseUrl}/patient/dashboard`, '#0066cc')}
        </div>
        ${buildFooter()}
      </div>
    `;

    return this.sendEmail(to, `Refund Initiated for Consultation with ${doctorName}`, htmlContent);
  }

  async sendRefundCompleted(
    to: string,
    patientName: string,
    doctorName: string,
    amountInPaise: number,
    refundId: string,
  ): Promise<boolean> {
    const amountFormatted = `₹${(amountInPaise / 100).toFixed(2)}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        ${buildHeader('Refund Completed ✅', '#2e7d32')}
        <div style="padding: 20px;">
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 4px;">
            <p style="color: #333333; font-size: 16px; margin-top: 0;">Hello <strong>${patientName}</strong>,</p>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              Your refund of <strong>${amountFormatted}</strong> for your appointment with <strong>${doctorName}</strong> has been successfully processed by your bank.
            </p>
            <div style="background-color: #ffffff; padding: 15px; border-radius: 4px; border-left: 4px solid #2e7d32; margin: 15px 0;">
              <p style="margin: 5px 0; color: #333333;"><strong>Amount Credited:</strong> ${amountFormatted}</p>
              <p style="margin: 5px 0; color: #333333;"><strong>Refund ID:</strong> ${refundId}</p>
            </div>
          </div>
          ${buildCtaButton('View Account', `${this.appBaseUrl}/patient/dashboard`, '#2e7d32')}
        </div>
        ${buildFooter()}
      </div>
    `;

    return this.sendEmail(to, `Refund Completed: Consultation with ${doctorName}`, htmlContent);
  }

  async sendRefundFailed(
    to: string,
    patientName: string,
    doctorName: string,
    amountInPaise: number,
    reason?: string,
  ): Promise<boolean> {
    const amountFormatted = `₹${(amountInPaise / 100).toFixed(2)}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        ${buildHeader('Refund Notice ⚠️', '#c62828')}
        <div style="padding: 20px;">
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 4px;">
            <p style="color: #333333; font-size: 16px; margin-top: 0;">Hello <strong>${patientName}</strong>,</p>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              An issue occurred while processing your refund of <strong>${amountFormatted}</strong> for your appointment with <strong>${doctorName}</strong>.
            </p>
            <div style="background-color: #ffebee; padding: 15px; border-radius: 4px; border-left: 4px solid #c62828; margin: 15px 0;">
              <p style="margin: 5px 0; color: #c62828;"><strong>Status:</strong> Processing Issue</p>
              ${reason ? `<p style="margin: 5px 0; color: #333333;"><strong>Details:</strong> ${reason}</p>` : ''}
              <p style="margin: 5px 0; color: #555555; font-size: 13px;">Our finance team has been notified and is manually resolving your transaction.</p>
            </div>
          </div>
          ${buildCtaButton('Contact Support', `${this.appBaseUrl}/support`, '#c62828')}
        </div>
        ${buildFooter()}
      </div>
    `;

    return this.sendEmail(to, `Update on your Refund for Consultation with ${doctorName}`, htmlContent);
  }

  async sendWelcomeEmail(to: string, name: string, role: string): Promise<void> {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        ${buildHeader('Welcome to CareUp! 🎉', '#0066cc')}
        <div style="padding: 20px;">
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 4px;">
            <p style="color: #333333; font-size: 16px; margin-top: 0;">Hello <strong>${name}</strong>,</p>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              Thank you for signing up on CareUp! Your account has been successfully created
              with the role of <strong>${role.toLowerCase()}</strong>.
            </p>
            <p style="color: #555555; line-height: 1.5; font-size: 15px;">
              With CareUp, you can manage appointments, connect with healthcare providers,
              and track health details seamlessly.
            </p>
          </div>
          ${buildCtaButton('Get Started', `${this.appBaseUrl}`, '#0066cc')}
        </div>
        ${buildFooter()}
      </div>
    `;
    await this.sendEmail(to, 'Welcome to CareUp!', htmlContent);
  }
}
