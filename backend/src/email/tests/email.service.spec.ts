import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email.service';

describe('EmailService (Phase 9)', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'BREVO_API_KEY') return 'your_brevo_api_key_here'; // Mock mode
              if (key === 'BREVO_FROM_EMAIL') return 'support@careup.test';
              if (key === 'BREVO_FROM_NAME') return 'CareUp';
              if (key === 'APP_BASE_URL') return 'https://careup.test';
              return null;
            },
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined and initialize in mock mode when key is placeholder', () => {
    expect(service).toBeDefined();
  });

  describe('Payment and Refund Emails', () => {
    it('should successfully dispatch payment success email in mock mode', async () => {
      const result = await service.sendPaymentSuccess(
        'patient@example.com',
        'John Doe',
        'Dr. Smith',
        50000, // ₹500.00
        'order_123',
        'pay_123',
        '2026-11-15',
        '10:30',
      );
      expect(result).toBe(true);
    });

    it('should successfully dispatch refund initiated email', async () => {
      const result = await service.sendRefundInitiated(
        'patient@example.com',
        'John Doe',
        'Dr. Smith',
        50000,
        'rfnd_123',
        'Patient requested cancellation',
      );
      expect(result).toBe(true);
    });

    it('should successfully dispatch refund completed email', async () => {
      const result = await service.sendRefundCompleted(
        'patient@example.com',
        'John Doe',
        'Dr. Smith',
        50000,
        'rfnd_123',
      );
      expect(result).toBe(true);
    });

    it('should successfully dispatch refund failed notice email', async () => {
      const result = await service.sendRefundFailed(
        'patient@example.com',
        'John Doe',
        'Dr. Smith',
        50000,
        'Bank processing failure',
      );
      expect(result).toBe(true);
    });
  });

  describe('Appointment Reminders', () => {
    it('should send appointment reminder with lead time label', async () => {
      const result = await service.sendAppointmentReminder(
        'patient@example.com',
        'John Doe',
        'Dr. Smith',
        '2026-11-15',
        '10:30',
        42,
        'tomorrow',
      );
      expect(result).toBe(true);
    });
  });
});

