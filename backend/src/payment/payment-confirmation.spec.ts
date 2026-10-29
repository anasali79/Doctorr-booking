import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { Refund } from './entities/refund.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { RazorpayService } from './providers/razorpay.service';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notification/notification.service';
import { QueueService } from '../appointment/queue.service';
import { AvailabilityService } from '../doctor/availability.service';
import { ReminderService } from '../reminder/reminder.service';
import { AppointmentGateway } from '../sockets/appointment.gateway';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { RefundStatus } from './enums/refund-status.enum';

describe('PaymentConfirmation & Expiry Handling (P1 Fixes)', () => {
  let service: PaymentService;
  let mockPaymentRepo: any;
  let mockRefundRepo: any;
  let mockAppointmentRepo: any;
  let mockRazorpayService: any;
  let mockEmailService: any;
  let mockNotificationService: any;
  let mockQueueService: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockPaymentRepo = {
      findOne: jest.fn(),
      save: jest.fn((p) => Promise.resolve(p)),
      create: jest.fn((dto) => ({ ...dto })),
    };

    mockRefundRepo = {
      findOne: jest.fn(),
      save: jest.fn((r) => Promise.resolve({ id: 'ref_123', ...r })),
      create: jest.fn((dto) => ({ ...dto })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockAppointmentRepo = {
      findOne: jest.fn(),
      save: jest.fn((a) => Promise.resolve(a)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((dto) => ({ ...dto })),
    };

    mockRazorpayService = {
      createRefund: jest.fn().mockResolvedValue({ id: 'rfnd_provider_123', status: 'processed' }),
      verifyPaymentSignature: jest.fn().mockReturnValue(true),
      getPublicKey: jest.fn().mockReturnValue('rzp_test_key'),
    };

    mockEmailService = {
      sendBookingConfirmation: jest.fn().mockResolvedValue(true),
      sendPaymentSuccess: jest.fn().mockResolvedValue(true),
      sendRefundInitiated: jest.fn().mockResolvedValue(true),
    };

    mockNotificationService = {
      createNotification: jest.fn().mockResolvedValue(true),
    };

    mockQueueService = {
      recalculateQueue: jest.fn().mockResolvedValue(true),
      broadcastQueueStatus: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Refund), useValue: mockRefundRepo },
        { provide: getRepositoryToken(WebhookEvent), useValue: {} },
        { provide: getRepositoryToken(Appointment), useValue: mockAppointmentRepo },
        { provide: getRepositoryToken(Doctor), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Patient), useValue: { findOne: jest.fn() } },
        { provide: RazorpayService, useValue: mockRazorpayService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: AvailabilityService, useValue: {} },
        { provide: ReminderService, useValue: { scheduleAppointmentReminders: jest.fn() } },
        { provide: AppointmentGateway, useValue: { emitAppointmentEvent: jest.fn() } },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: () => ({
              connect: jest.fn(),
              startTransaction: jest.fn(),
              commitTransaction: jest.fn(),
              rollbackTransaction: jest.fn(),
              release: jest.fn(),
              manager: {
                findOne: jest.fn(),
                save: jest.fn((entity) => Promise.resolve(entity)),
                find: jest.fn().mockResolvedValue([]),
                createQueryBuilder: jest.fn(),
              },
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    mockDataSource = module.get<DataSource>(DataSource);
  });

  describe('confirmAppointmentPaymentTransaction', () => {
    it('1. Non-expired valid booking confirms normally and assigns token', async () => {
      const now = new Date();
      const futureExpiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes in future

      const testAppt = {
        id: 'appt_1',
        doctorId: 'doc_1',
        patientId: 'pat_1',
        date: '2026-11-01',
        startTime: '10:00',
        endTime: '10:15',
        status: AppointmentStatus.PENDING_PAYMENT,
        pendingExpiresAt: futureExpiresAt,
        tokenNumber: null,
        doctor: { id: 'doc_1', fullName: 'Dr. Test' },
        patient: { id: 'pat_1', fullName: 'John Doe', user: { email: 'john@example.com' } },
      };

      const testPayment = {
        id: 'pay_1',
        appointmentId: 'appt_1',
        amount: 50000,
        status: PaymentStatus.PENDING,
        paymentId: null,
      } as any;

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn((entity, options) => {
            if (entity === Appointment) return Promise.resolve(testAppt);
            if (entity === Payment) return Promise.resolve(testPayment);
            return Promise.resolve(null);
          }),
          find: jest.fn().mockResolvedValue([]),
          save: jest.fn((entity) => Promise.resolve(entity)),
          createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null), // No conflict
          })),
        },
      };

      jest.spyOn(mockDataSource, 'createQueryRunner').mockReturnValue(mockQueryRunner as any);

      const result = await service.confirmAppointmentPaymentTransaction({
        payment: testPayment,
        paymentId: 'pay_rzp_123',
        signature: 'sig_123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('confirmed successfully');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(testAppt.status).toBe(AppointmentStatus.CONFIRMED);
      expect(testAppt.tokenNumber).toBe(1);
    });

    it('2. Expired reservation with slot conflict prevents confirmation and triggers 100% refund', async () => {
      const now = new Date();
      const pastExpiresAt = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

      const testAppt = {
        id: 'appt_2',
        doctorId: 'doc_1',
        patientId: 'pat_1',
        date: '2026-11-01',
        startTime: '10:00',
        endTime: '10:15',
        status: AppointmentStatus.PENDING_PAYMENT,
        pendingExpiresAt: pastExpiresAt,
        tokenNumber: null,
        doctor: { id: 'doc_1', fullName: 'Dr. Test' },
        patient: { id: 'pat_1', fullName: 'John Doe', user: { email: 'john@example.com' } },
      };

      const testPayment = {
        id: 'pay_2',
        appointmentId: 'appt_2',
        amount: 50000,
        amountRefunded: 0,
        status: PaymentStatus.PENDING,
        paymentId: null,
      } as any;

      const conflictingAppt = {
        id: 'appt_conflicting',
        doctorId: 'doc_1',
        date: '2026-11-01',
        startTime: '10:00',
        endTime: '10:15',
        status: AppointmentStatus.CONFIRMED,
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn((entity, options) => {
            if (entity === Appointment) return Promise.resolve(testAppt);
            if (entity === Payment) return Promise.resolve(testPayment);
            return Promise.resolve(null);
          }),
          save: jest.fn((entity) => Promise.resolve(entity)),
          createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(conflictingAppt), // Conflicting slot booked by someone else!
          })),
        },
      };

      jest.spyOn(mockDataSource, 'createQueryRunner').mockReturnValue(mockQueryRunner as any);

      const result = await service.confirmAppointmentPaymentTransaction({
        payment: testPayment,
        paymentId: 'pay_late_456',
      });

      // Confirmation is rejected and refund initiated
      expect(result.success).toBe(false);
      expect(result.message).toContain('refund has been automatically initiated');
      expect(mockRazorpayService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'pay_late_456',
          amount: 50000,
        }),
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('3. Booking conflict: patient already has confirmed appointment on same day -> triggers refund', async () => {
      const now = new Date();
      const futureExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);

      const testAppt = {
        id: 'appt_3',
        doctorId: 'doc_1',
        patientId: 'pat_1',
        date: '2026-11-01',
        startTime: '14:00',
        endTime: '14:15',
        status: AppointmentStatus.PENDING_PAYMENT,
        pendingExpiresAt: futureExpiresAt,
        doctor: { id: 'doc_1', fullName: 'Dr. Test' },
        patient: { id: 'pat_1', fullName: 'John Doe', user: { email: 'john@example.com' } },
      };

      const testPayment = {
        id: 'pay_3',
        appointmentId: 'appt_3',
        amount: 50000,
        amountRefunded: 0,
        status: PaymentStatus.PENDING,
      } as any;

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn((entity) => {
            if (entity === Appointment) return Promise.resolve(testAppt);
            if (entity === Payment) return Promise.resolve(testPayment);
            return Promise.resolve(null);
          }),
          save: jest.fn((entity) => Promise.resolve(entity)),
          createQueryBuilder: jest.fn()
            .mockImplementationOnce(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null), // slot itself is free
            }))
            .mockImplementationOnce(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue({ id: 'appt_same_day_confirmed' }), // patient already has booking!
            })),
        },
      };

      jest.spyOn(mockDataSource, 'createQueryRunner').mockReturnValue(mockQueryRunner as any);

      const result = await service.confirmAppointmentPaymentTransaction({
        payment: testPayment,
        paymentId: 'pay_dup_789',
      });

      expect(result.success).toBe(false);
      expect(mockRazorpayService.createRefund).toHaveBeenCalled();
    });

    it('4. Idempotency: if payment already completed, returns existing details safely', async () => {
      const completedPayment = {
        id: 'pay_comp',
        appointmentId: 'appt_comp',
        amount: 50000,
        status: PaymentStatus.COMPLETED,
        paymentId: 'pay_existing_123',
        appointment: { tokenNumber: 5 },
      } as any;

      const result = await service.confirmAppointmentPaymentTransaction({
        payment: completedPayment,
        paymentId: 'pay_existing_123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('already verified');
      expect(result.tokenNumber).toBe(5);
    });

    it('5. Late payment recovery: expired reservation without slot conflict recovers safely and confirms', async () => {
      const pastExpiresAt = new Date(Date.now() - 10 * 60 * 1000); // Expired 10 min ago

      const testAppt = {
        id: 'appt_late_rec',
        doctorId: 'doc_1',
        patientId: 'pat_1',
        date: '2026-11-01',
        startTime: '11:00',
        endTime: '11:15',
        status: AppointmentStatus.PENDING_PAYMENT,
        pendingExpiresAt: pastExpiresAt,
        doctor: { id: 'doc_1', fullName: 'Dr. Test' },
        patient: { id: 'pat_1', fullName: 'John Doe', user: { email: 'john@example.com' } },
      };

      const testPayment = {
        id: 'pay_late_rec',
        appointmentId: 'appt_late_rec',
        amount: 50000,
        status: PaymentStatus.PENDING,
      } as any;

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn((entity) => {
            if (entity === Appointment) return Promise.resolve(testAppt);
            if (entity === Payment) return Promise.resolve(testPayment);
            return Promise.resolve(null);
          }),
          find: jest.fn().mockResolvedValue([]),
          save: jest.fn((entity) => Promise.resolve(entity)),
          createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null), // slot is free, no conflict!
          })),
        },
      };

      jest.spyOn(mockDataSource, 'createQueryRunner').mockReturnValue(mockQueryRunner as any);

      const result = await service.confirmAppointmentPaymentTransaction({
        payment: testPayment,
        paymentId: 'pay_recovered_999',
      });

      expect(result.success).toBe(true);
      expect(testAppt.status).toBe(AppointmentStatus.CONFIRMED);
      expect(testAppt.tokenNumber).toBe(1);
    });
  });

  describe('Calendar Date Validation (Issue #5 Fixes)', () => {
    function isValidCalendarDate(date: string): boolean {
      if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) {
        return false;
      }
      const [yStr, mStr, dStr] = date.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      const parsed = new Date(Date.UTC(y, m - 1, d));
      return (
        !isNaN(parsed.getTime()) &&
        parsed.getUTCFullYear() === y &&
        parsed.getUTCMonth() === m - 1 &&
        parsed.getUTCDate() === d
      );
    }

    it('rejects impossible dates like 2026-02-31, 2026-04-31, and invalid leap days', () => {
      expect(isValidCalendarDate('2026-02-31')).toBe(false);
      expect(isValidCalendarDate('2026-04-31')).toBe(false);
      expect(isValidCalendarDate('2026-06-31')).toBe(false);
      expect(isValidCalendarDate('2026-09-31')).toBe(false);
      expect(isValidCalendarDate('2026-11-31')).toBe(false);

      // 2025 is not a leap year -> Feb 29 is invalid
      expect(isValidCalendarDate('2025-02-29')).toBe(false);
    });

    it('accepts legitimate calendar dates and genuine leap days', () => {
      expect(isValidCalendarDate('2026-02-28')).toBe(true);
      expect(isValidCalendarDate('2026-04-30')).toBe(true);
      expect(isValidCalendarDate('2026-12-31')).toBe(true);

      // 2024 & 2028 are leap years -> Feb 29 is valid
      expect(isValidCalendarDate('2024-02-29')).toBe(true);
      expect(isValidCalendarDate('2028-02-29')).toBe(true);
    });
  });
});
