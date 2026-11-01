import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotificationDispatcher } from './notification.dispatcher';
import { EmailProvider } from './providers/email.provider';
import { InAppProvider } from './providers/in-app.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { SmsProvider } from './providers/sms.provider';
import { NotificationWebhookController } from './notification-webhook.controller';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationEventType } from './enums/notification-event-type.enum';
import { NotificationChannel } from './enums/notification-channel.enum';
import { DeliveryStatus } from './enums/delivery-status.enum';
import { renderNotificationTemplate } from './templates/notification.templates';
import {
  normalizePhoneNumber,
  isValidE164,
  toVonageRecipient,
  toIndian10Digit,
} from './utils/phone.utils';

describe('Vonage (Nexmo) Multi-Channel Notification System', () => {
  // ─── 1. PHONE NUMBER UTILITIES ───────────────────────────────────────────
  describe('1. Phone Number Normalization & Validation', () => {
    it('normalizes 10-digit Indian numbers with default +91', () => {
      const normalized = normalizePhoneNumber('7987087000');
      expect(normalized).toBe('+917987087000');
      expect(isValidE164(normalized!)).toBe(true);
    });

    it('formats recipient number for Vonage SMS & WhatsApp (digits without +)', () => {
      expect(toVonageRecipient('+917987087000')).toBe('917987087000');
      expect(toVonageRecipient('7987087000')).toBe('917987087000');
      expect(toVonageRecipient('+14155552671')).toBe('14155552671');
      expect(toVonageRecipient('invalid')).toBeNull();
    });

    it('extracts standard 10-digit Indian mobile number', () => {
      expect(toIndian10Digit('+917987087000')).toBe('7987087000');
      expect(toIndian10Digit('07987087000')).toBe('7987087000');
      expect(toIndian10Digit('12345')).toBeNull();
    });
  });

  // ─── 2. TEMPLATES & DYNAMIC VARIABLES ──────────────────────────────────
  describe('2. Notification Templates & Dynamic Variables', () => {
    it('renders APPOINTMENT_CONFIRMED with dynamic patient, doctor, date, time and templateParams', () => {
      const template = renderNotificationTemplate(
        NotificationEventType.APPOINTMENT_CONFIRMED,
        {
          patientName: 'John Doe',
          doctorName: 'Sarah Smith',
          specialization: 'Cardiology',
          appointmentDate: '2026-10-31',
          startTime: '10:30',
          tokenNumber: 5,
          appointmentId: 'appt_123',
        },
        'PATIENT',
      );

      expect(template.title).toContain('Confirmed');
      expect(template.smsText).toContain('Dr. Sarah Smith');
      expect(template.smsText).toContain('10:30');
      expect(template.whatsAppText).toContain('*CareUp Appointment Confirmed*');
      expect(template.templateParams?.patientName).toBe('John Doe');
      expect(template.templateParams?.doctorName).toBe('Sarah Smith');
      expect(template.templateParams?.appointmentTime).toBe('10:30 AM');
    });

    it('renders APPOINTMENT_CANCELLED with refund and reason details', () => {
      const template = renderNotificationTemplate(
        NotificationEventType.APPOINTMENT_CANCELLED_BY_PATIENT,
        {
          patientName: 'John Doe',
          doctorName: 'Sarah Smith',
          appointmentDate: '2026-10-31',
          startTime: '10:30',
          cancellationReason: 'Emergency travel',
        },
        'PATIENT',
      );

      expect(template.title).toContain('Cancelled');
      expect(template.smsText.toLowerCase()).toContain('cancelled');
      expect(template.whatsAppText.toLowerCase()).toContain('cancellation');
      expect(template.templateParams?.reason).toBe('Emergency travel');
    });

    it('renders APPOINTMENT_RESCHEDULED with both previous and new slots', () => {
      const template = renderNotificationTemplate(
        NotificationEventType.APPOINTMENT_RESCHEDULED,
        {
          patientName: 'John Doe',
          doctorName: 'Sarah Smith',
          appointmentDate: '2026-11-02',
          startTime: '14:00',
          previousDate: '2026-10-31',
          previousStartTime: '10:30',
        },
        'PATIENT',
      );

      expect(template.title).toContain('Rescheduled');
      expect(template.smsText).toContain('Prev:');
      expect(template.whatsAppText).toContain('Previous:');
    });

    it('renders PAYMENT_SUCCESSFUL with amount and transaction reference', () => {
      const template = renderNotificationTemplate(
        NotificationEventType.PAYMENT_SUCCESSFUL,
        {
          patientName: 'John Doe',
          doctorName: 'Sarah Smith',
          amountInPaise: 75000,
          paymentId: 'pay_xyz789',
        },
        'PATIENT',
      );

      expect(template.title).toContain('Payment Received');
      expect(template.smsText).toContain('₹750.00');
      expect(template.whatsAppText).toContain('₹750.00');
      expect(template.templateParams?.amount).toBe('₹750.00');
    });
  });

  // ─── 3. VONAGE SMS PROVIDER ─────────────────────────────────────────────
  describe('3. Vonage SMS Provider Unit Tests', () => {
    let originalFetch: any;

    beforeAll(() => {
      originalFetch = global.fetch;
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    it('successfully sends SMS and extracts message-id when status is 0', async () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'VONAGE_API_KEY') return 'vng_api_key_123';
          if (key === 'VONAGE_API_SECRET') return 'vng_secret_abc';
          if (key === 'VONAGE_SMS_FROM') return 'CareUp';
          return null;
        }),
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          'message-count': '1',
          messages: [
            {
              to: '917987087000',
              'message-id': '02000000E6C3B1A1',
              status: '0',
              'remaining-balance': '10.50',
            },
          ],
        }),
      });

      const provider = new SmsProvider(mockConfig as any);
      expect(provider.isAvailable()).toBe(true);

      const result = await provider.send({
        recipientId: 'user_1',
        recipientRole: 'PATIENT',
        destination: '+917987087000',
        template: {
          smsText: 'Your appointment is confirmed with Dr. Sarah Smith on 31 Oct at 10:30 AM.',
        } as any,
      });

      expect(result.status).toBe(DeliveryStatus.SENT);
      expect(result.providerMessageId).toBe('02000000E6C3B1A1');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://rest.nexmo.com/sms/json',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('allows outbound SMS to verified test phone and skips unverified test phone when test mode is enabled', async () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'VONAGE_API_KEY') return 'vng_api_key_123';
          if (key === 'VONAGE_API_SECRET') return 'vng_secret_abc';
          if (key === 'VONAGE_TEST_PHONE') return '917987087000'; // Whitelisted number
          return null;
        }),
      };

      let sentBody: any;
      global.fetch = jest.fn().mockImplementation((url, opts) => {
        sentBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            'message-count': '1',
            messages: [{ status: '0', 'message-id': 'msg_test_override' }],
          }),
        });
      });

      const provider = new SmsProvider(mockConfig as any);

      // 1. Whitelisted number should be sent
      const whitelistedResult = await provider.send({
        recipientId: 'patient_99',
        recipientRole: 'PATIENT',
        destination: '+91 7987087000',
        template: { smsText: 'Test notification' } as any,
      });

      expect(whitelistedResult.status).toBe(DeliveryStatus.SENT);
      expect(sentBody.to).toBe('917987087000');

      // 2. Unverified demo number should be skipped with CANCELLED
      const unverifiedResult = await provider.send({
        recipientId: 'patient_100',
        recipientRole: 'PATIENT',
        destination: '1234567890',
        template: { smsText: 'Test notification' } as any,
      });

      expect(unverifiedResult.status).toBe(DeliveryStatus.CANCELLED);
      expect(unverifiedResult.errorCode).toBe('UNVERIFIED_DEMO_RECIPIENT_SKIPPED');
    });

    it('handles Vonage invalid credentials (Status 3) as non-transient failure', async () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'VONAGE_API_KEY') return 'wrong_api_key';
          if (key === 'VONAGE_API_SECRET') return 'wrong_secret';
          return null;
        }),
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          'message-count': '1',
          messages: [{ status: '3', 'error-text': 'Invalid credentials' }],
        }),
      });

      const provider = new SmsProvider(mockConfig as any);
      const result = await provider.send({
        recipientId: 'user_1',
        recipientRole: 'PATIENT',
        destination: '+917987087000',
        template: { smsText: 'Test' } as any,
      });

      expect(result.status).toBe(DeliveryStatus.FAILED);
      expect(result.isTransient).toBe(false);
      expect(result.errorCode).toBe('VONAGE_INVALID_CREDENTIALS');
    });

    it('handles Vonage throttled (Status 1) as transient retry', async () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'VONAGE_API_KEY') return 'vng_api_key_123';
          if (key === 'VONAGE_API_SECRET') return 'vng_secret_abc';
          return null;
        }),
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          'message-count': '1',
          messages: [{ status: '1', 'error-text': 'Throttled' }],
        }),
      });

      const provider = new SmsProvider(mockConfig as any);
      const result = await provider.send({
        recipientId: 'user_1',
        recipientRole: 'PATIENT',
        destination: '+917987087000',
        template: { smsText: 'Test' } as any,
      });

      expect(result.status).toBe(DeliveryStatus.FAILED);
      expect(result.isTransient).toBe(true);
      expect(result.errorCode).toBe('VONAGE_THROTTLED');
    });
  });

  // ─── 4. VONAGE WHATSAPP MESSAGES API PROVIDER ───────────────────────────
  describe('4. Vonage WhatsApp Messages API Provider Unit Tests', () => {
    let originalFetch: any;

    beforeAll(() => {
      originalFetch = global.fetch;
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    it('successfully sends WhatsApp message via Vonage Messages Sandbox', async () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'VONAGE_API_KEY') return 'vng_api_key_123';
          if (key === 'VONAGE_API_SECRET') return 'vng_secret_abc';
          if (key === 'VONAGE_USE_SANDBOX') return 'true';
          if (key === 'VONAGE_WHATSAPP_FROM') return '14157386170';
          return null;
        }),
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 202,
        json: async () => ({
          message_uuid: 'aaaaaaaa-bbbb-cccc-dddd-0123456789ab',
        }),
      });

      const provider = new WhatsAppProvider(mockConfig as any);
      expect(provider.isAvailable()).toBe(true);

      const result = await provider.send({
        recipientId: 'user_1',
        recipientRole: 'PATIENT',
        destination: '+917987087000',
        template: {
          whatsAppText: 'Your appointment is confirmed with Dr. Sarah Smith on 31 Oct at 10:30 AM.',
        } as any,
      });

      expect(result.status).toBe(DeliveryStatus.ACCEPTED);
      expect(result.providerMessageId).toBe('aaaaaaaa-bbbb-cccc-dddd-0123456789ab');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://messages-sandbox.nexmo.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        }),
      );
    });

    it('allows outbound WhatsApp to verified test phone and skips unverified test phone when test mode is enabled', async () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'VONAGE_API_KEY') return 'vng_api_key_123';
          if (key === 'VONAGE_API_SECRET') return 'vng_secret_abc';
          if (key === 'VONAGE_TEST_PHONE') return '917987087000';
          return null;
        }),
      };

      let sentBody: any;
      global.fetch = jest.fn().mockImplementation((url, opts) => {
        sentBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 202,
          json: async () => ({ message_uuid: 'wa_uuid_test_1' }),
        });
      });

      const provider = new WhatsAppProvider(mockConfig as any);

      // 1. Whitelisted number should be sent
      const whitelistedResult = await provider.send({
        recipientId: 'patient_55',
        recipientRole: 'PATIENT',
        destination: '+91 7987087000',
        template: { whatsAppText: 'Hello' } as any,
      });

      expect(whitelistedResult.status).toBe(DeliveryStatus.ACCEPTED);
      expect(sentBody.to).toBe('917987087000');
      expect(sentBody.channel).toBe('whatsapp');

      // 2. Unverified demo number should be skipped with CANCELLED
      const unverifiedResult = await provider.send({
        recipientId: 'patient_56',
        recipientRole: 'PATIENT',
        destination: '1234567890',
        template: { whatsAppText: 'Hello' } as any,
      });

      expect(unverifiedResult.status).toBe(DeliveryStatus.CANCELLED);
      expect(unverifiedResult.errorCode).toBe('UNVERIFIED_DEMO_RECIPIENT_SKIPPED');
    });

    it('handles Vonage 401 Unauthorized as non-transient error', async () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'VONAGE_API_KEY') return 'bad_key';
          if (key === 'VONAGE_API_SECRET') return 'bad_secret';
          return null;
        }),
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          type: 'https://developer.nexmo.com/api-errors/#unauthorized',
          title: 'Unauthorized',
          detail: 'Invalid credentials',
        }),
      });

      const provider = new WhatsAppProvider(mockConfig as any);
      const result = await provider.send({
        recipientId: 'user_1',
        recipientRole: 'PATIENT',
        destination: '+917987087000',
        template: { whatsAppText: 'Test' } as any,
      });

      expect(result.status).toBe(DeliveryStatus.FAILED);
      expect(result.isTransient).toBe(false);
      expect(result.errorCode).toBe('VONAGE_INVALID_CREDENTIALS');
    });

    it('generates RS256 JWT when VONAGE_APPLICATION_ID and private key are configured', async () => {
      const crypto = require('crypto');
      const { generateKeyPairSync } = crypto;
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'VONAGE_APPLICATION_ID') return 'c1f7a6b9-3e5d-4f27-9846-dc02d76a8a42';
          if (key === 'VONAGE_PRIVATE_KEY') return privateKey;
          if (key === 'VONAGE_USE_SANDBOX') return 'true';
          if (key === 'VONAGE_WHATSAPP_FROM') return '14157386170';
          return null;
        }),
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 202,
        json: async () => ({
          message_uuid: 'jwt-uuid-123',
        }),
      });

      const provider = new WhatsAppProvider(mockConfig as any);
      expect(provider.isAvailable()).toBe(true);

      const result = await provider.send({
        recipientId: 'user_1',
        recipientRole: 'PATIENT',
        destination: '+917987087000',
        template: { whatsAppText: 'Test appointment message' } as any,
      });

      expect(result.status).toBe(DeliveryStatus.ACCEPTED);
      expect(result.providerMessageId).toBe('jwt-uuid-123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://messages-sandbox.nexmo.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer eyJ/),
          }),
        }),
      );
    });
  });

  // ─── 5. NOTIFICATION DISPATCHER INTEGRATION ────────────────────────────
  describe('5. Centralized Dispatcher & Fault Isolation', () => {
    let dispatcher: NotificationDispatcher;
    let mockDeliveryRepo: any;
    let mockPreferenceRepo: any;
    let mockEmailProvider: any;
    let mockInAppProvider: any;
    let mockWhatsAppProvider: any;
    let mockSmsProvider: any;

    beforeEach(async () => {
      mockDeliveryRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((dto) => ({ id: `del_${Date.now()}`, ...dto })),
        save: jest.fn((d) => Promise.resolve(d)),
      };

      mockPreferenceRepo = {
        findOne: jest.fn().mockResolvedValue({
          userId: 'user_1',
          emailEnabled: true,
          inAppEnabled: true,
          whatsappEnabled: true,
          smsEnabled: true,
        }),
      };

      mockEmailProvider = {
        send: jest.fn().mockResolvedValue({
          channel: NotificationChannel.EMAIL,
          destination: 'patient@example.com',
          status: DeliveryStatus.SENT,
          providerMessageId: 'brevo_msg_1',
        }),
      };

      mockInAppProvider = {
        send: jest.fn().mockResolvedValue({
          channel: NotificationChannel.IN_APP,
          destination: 'patient_profile_1',
          status: DeliveryStatus.DELIVERED,
          providerMessageId: 'notif_1',
        }),
      };

      // Vonage WhatsApp fails transiently
      mockWhatsAppProvider = {
        send: jest.fn().mockResolvedValue({
          channel: NotificationChannel.WHATSAPP,
          destination: '917987087000',
          status: DeliveryStatus.FAILED,
          errorCode: 'VONAGE_RATE_LIMIT',
          errorMessage: 'Too many requests',
          isTransient: true,
        }),
      };

      // Vonage SMS succeeds
      mockSmsProvider = {
        send: jest.fn().mockResolvedValue({
          channel: NotificationChannel.SMS,
          destination: '917987087000',
          status: DeliveryStatus.SENT,
          providerMessageId: '02000000E6C3B1A1',
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationDispatcher,
          { provide: getRepositoryToken(NotificationDelivery), useValue: mockDeliveryRepo },
          { provide: getRepositoryToken(NotificationPreference), useValue: mockPreferenceRepo },
          { provide: EmailProvider, useValue: mockEmailProvider },
          { provide: InAppProvider, useValue: mockInAppProvider },
          { provide: WhatsAppProvider, useValue: mockWhatsAppProvider },
          { provide: SmsProvider, useValue: mockSmsProvider },
          {
            provide: ConfigService,
            useValue: { get: jest.fn((key: string) => (key === 'APP_BASE_URL' ? 'https://careup.app' : null)) },
          },
        ],
      }).compile();

      dispatcher = module.get<NotificationDispatcher>(NotificationDispatcher);
    });

    it('processes all 4 channels independently with complete fault isolation', async () => {
      const result = await dispatcher.dispatch({
        eventType: NotificationEventType.APPOINTMENT_CONFIRMED,
        recipients: [
          {
            id: 'patient_profile_1',
            userId: 'user_1',
            name: 'John Doe',
            email: 'patient@example.com',
            phone: '7987087000',
            role: 'PATIENT',
          },
        ],
        appointmentId: 'appt_1',
        data: {
          patientName: 'John Doe',
          doctorName: 'Dr. Sarah Smith',
          appointmentDate: '2026-10-31',
          startTime: '10:30',
        },
      });

      const recipientResults = result.results['patient_profile_1'];
      expect(recipientResults).toBeDefined();
      expect(recipientResults.length).toBe(4);

      const emailRes = recipientResults.find((r) => r.channel === NotificationChannel.EMAIL);
      const inAppRes = recipientResults.find((r) => r.channel === NotificationChannel.IN_APP);
      const waRes = recipientResults.find((r) => r.channel === NotificationChannel.WHATSAPP);
      const smsRes = recipientResults.find((r) => r.channel === NotificationChannel.SMS);

      expect(emailRes?.status).toBe(DeliveryStatus.SENT);
      expect(inAppRes?.status).toBe(DeliveryStatus.DELIVERED);
      expect(waRes?.status).toBe(DeliveryStatus.FAILED);
      expect(smsRes?.status).toBe(DeliveryStatus.SENT);
      expect(smsRes?.providerMessageId).toBe('02000000E6C3B1A1');
    });

    it('enforces idempotency and skips already sent channels', async () => {
      mockDeliveryRepo.findOne = jest.fn().mockImplementation(({ where }) => {
        if (where.idempotencyKey.includes('SMS')) {
          return Promise.resolve({
            id: 'del_prev',
            status: DeliveryStatus.SENT,
            providerMessageId: 'vng_prev_1',
          });
        }
        return Promise.resolve(null);
      });

      await dispatcher.dispatch({
        eventType: NotificationEventType.APPOINTMENT_CONFIRMED,
        recipients: [
          {
            id: 'patient_profile_1',
            userId: 'user_1',
            name: 'John Doe',
            email: 'patient@example.com',
            phone: '7987087000',
            role: 'PATIENT',
          },
        ],
        appointmentId: 'appt_1',
        data: { patientName: 'John Doe', doctorName: 'Sarah Smith' },
      });

      // SMS was already sent, so provider must not be called again
      expect(mockSmsProvider.send).not.toHaveBeenCalled();
      // Other channels proceed
      expect(mockEmailProvider.send).toHaveBeenCalled();
      expect(mockInAppProvider.send).toHaveBeenCalled();
      expect(mockWhatsAppProvider.send).toHaveBeenCalled();
    });
  });

  // ─── 6. VONAGE WEBHOOKS CONTROLLER ──────────────────────────────────────
  describe('6. Vonage Webhooks Controller (/webhooks/status & /webhooks/inbound)', () => {
    let controller: NotificationWebhookController;
    let mockRepo: any;

    beforeEach(async () => {
      mockRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'del_123',
          providerMessageId: 'msg_uuid_abc',
          status: DeliveryStatus.SENT,
        }),
        save: jest.fn((d) => Promise.resolve(d)),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [NotificationWebhookController],
        providers: [
          { provide: getRepositoryToken(NotificationDelivery), useValue: mockRepo },
          { provide: ConfigService, useValue: { get: jest.fn() } },
        ],
      }).compile();

      controller = module.get<NotificationWebhookController>(NotificationWebhookController);
    });

    it('updates delivery status to DELIVERED on POST /webhooks/status', async () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handleStatusWebhook(
        {
          message_uuid: 'msg_uuid_abc',
          to: '917987087000',
          from: '14157386170',
          status: 'delivered',
          timestamp: '2026-11-01T06:30:00Z',
        },
        {},
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'del_123',
          status: DeliveryStatus.DELIVERED,
        }),
      );
    });

    it('logs inbound reply and returns 200 OK on POST /webhooks/inbound', async () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      await controller.handleInboundWebhook(
        {
          from: '917987087000',
          to: '14157386170',
          message_type: 'text',
          text: 'Confirm',
          channel: 'whatsapp',
        },
        {},
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'ok' });
    });
  });
});
