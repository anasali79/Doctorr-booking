import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentService } from '../payment.service';
import { Payment } from '../entities/payment.entity';
import { Refund } from '../entities/refund.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { Appointment } from '../../appointment/entities/appointment.entity';
import { Doctor } from '../../doctor/entities/doctor.entity';
import { Patient } from '../../patient/entities/patient.entity';
import { RazorpayService } from '../providers/razorpay.service';
import { EmailService } from '../../email/email.service';
import { NotificationService } from '../../notification/notification.service';
import { QueueService } from '../../appointment/queue.service';
import { AvailabilityService } from '../../doctor/availability.service';
import { ReminderService } from '../../reminder/reminder.service';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { RefundStatus } from '../enums/refund-status.enum';
import { WebhookEventStatus } from '../enums/webhook-event-status.enum';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo: any;
  let refundRepo: any;
  let webhookRepo: any;
  let appointmentRepo: any;
  let doctorRepo: any;
  let patientRepo: any;
  let razorpayService: any;
  let emailService: any;
  let reminderService: any;
  let mockQueryRunner: any;

  const mockPatient = {
    id: 'patient-uuid-1',
    userId: 'user-patient-1',
    fullName: 'John Patient',
    user: { email: 'john@example.com' },
  };

  const mockDoctor = {
    id: 'doctor-uuid-1',
    userId: 'user-doctor-1',
    fullName: 'Dr. Jane Smith',
    specialization: 'Cardiology',
    consultationFee: 500.0, // ₹500.00
  };

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'saved-id', ...entity })),
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
      },
    };

    paymentRepo = {
      create: jest.fn().mockImplementation((dto) => ({ id: 'pay-uuid-1', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'pay-uuid-1', ...entity })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    refundRepo = {
      create: jest.fn().mockImplementation((dto) => ({ id: 'rfnd-uuid-1', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'rfnd-uuid-1', ...entity })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    webhookRepo = {
      create: jest.fn().mockImplementation((dto) => ({ id: 'wh-uuid-1', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'wh-uuid-1', ...entity })),
      findOne: jest.fn().mockResolvedValue(null),
    };

    appointmentRepo = {
      create: jest.fn().mockImplementation((dto) => ({ id: 'appt-uuid-1', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'appt-uuid-1', ...entity })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    doctorRepo = {
      findOne: jest.fn().mockResolvedValue(mockDoctor),
    };

    patientRepo = {
      findOne: jest.fn().mockResolvedValue(mockPatient),
    };

    razorpayService = {
      getPublicKey: jest.fn().mockReturnValue('rzp_test_mock'),
      createOrder: jest.fn().mockResolvedValue({
        id: 'order_mock_123',
        amount: 50000,
        currency: 'INR',
        status: 'created',
      }),
      verifyPaymentSignature: jest.fn().mockReturnValue(true),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      createRefund: jest.fn().mockResolvedValue({
        id: 'rfnd_mock_123',
        amount: 50000,
        currency: 'INR',
        status: 'processed',
      }),
      getPayment: jest.fn().mockResolvedValue({
        id: 'pay_mock_123',
        status: 'captured',
        amount: 50000,
      }),
    };

    emailService = {
      sendBookingConfirmation: jest.fn().mockResolvedValue(true),
      sendPaymentSuccess: jest.fn().mockResolvedValue(true),
      sendRefundInitiated: jest.fn().mockResolvedValue(true),
      sendRefundCompleted: jest.fn().mockResolvedValue(true),
      sendRefundFailed: jest.fn().mockResolvedValue(true),
    };

    reminderService = {
      scheduleAppointmentReminders: jest.fn().mockResolvedValue(undefined),
      cancelRemindersForAppointment: jest.fn().mockResolvedValue(undefined),
      rescheduleReminders: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(Refund), useValue: refundRepo },
        { provide: getRepositoryToken(WebhookEvent), useValue: webhookRepo },
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepo },
        { provide: getRepositoryToken(Doctor), useValue: doctorRepo },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: RazorpayService, useValue: razorpayService },
        { provide: EmailService, useValue: emailService },
        { provide: NotificationService, useValue: { createNotification: jest.fn() } },
        { provide: QueueService, useValue: { recalculateQueue: jest.fn(), broadcastQueueStatus: jest.fn() } },
        { provide: AvailabilityService, useValue: {} },
        { provide: ReminderService, useValue: reminderService },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder (Phase 4)', () => {
    it('should create order using server-side consultation fee in integer paise (₹500 -> 50000 paise)', async () => {
      const result = await service.createOrder('user-patient-1', {
        doctorId: 'doctor-uuid-1',
        date: '2026-11-10',
        startTime: '10:00',
        endTime: '10:30',
      });

      expect(result).toBeDefined();
      expect(result.amount).toBe(50000);
      expect(result.currency).toBe('INR');
      expect(result.orderId).toBe('order_mock_123');
      expect(razorpayService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
          currency: 'INR',
        }),
      );
    });

    it('should prevent booking if patient already has a confirmed appointment on the same day', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({ id: 'existing-confirmed' });

      await expect(
        service.createOrder('user-patient-1', {
          doctorId: 'doctor-uuid-1',
          date: '2026-11-10',
          startTime: '10:00',
          endTime: '10:30',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should return existing order idempotently if idempotencyKey is already used', async () => {
      paymentRepo.findOne.mockResolvedValueOnce({
        orderId: 'existing_order_123',
        amount: 50000,
        currency: 'INR',
        appointmentId: 'appt-123',
        appointment: { pendingExpiresAt: new Date() },
      });

      const res = await service.createOrder('user-patient-1', {
        doctorId: 'doctor-uuid-1',
        date: '2026-11-10',
        startTime: '10:00',
        endTime: '10:30',
        idempotencyKey: 'idemp-key-1',
      });

      expect(res.orderId).toBe('existing_order_123');
      expect(razorpayService.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('verifyPayment (Phase 5)', () => {
    it('should verify payment signature, confirm appointment, and trigger reminders & emails', async () => {
      const mockPayment = {
        id: 'pay-1',
        orderId: 'order_123',
        patientId: 'patient-uuid-1',
        appointmentId: 'appt-1',
        status: PaymentStatus.PENDING,
        amount: 50000,
        doctor: mockDoctor,
      };

      const mockAppt = {
        id: 'appt-1',
        doctorId: 'doctor-uuid-1',
        patientId: 'patient-uuid-1',
        date: '2026-11-10',
        startTime: '10:00',
        endTime: '10:30',
        status: AppointmentStatus.PENDING_PAYMENT,
        pendingExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };

      paymentRepo.findOne.mockResolvedValueOnce(mockPayment);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockAppt);
      appointmentRepo.findOne.mockResolvedValue({
        ...mockAppt,
        doctor: mockDoctor,
        patient: mockPatient,
      });

      const res = await service.verifyPayment('user-patient-1', {
        orderId: 'order_123',
        paymentId: 'pay_123',
        signature: 'valid_sig',
        appointmentId: 'appt-1',
      });

      expect(res.success).toBe(true);
      expect(mockAppt.status).toBe(AppointmentStatus.CONFIRMED);
      expect(mockAppt.paymentStatus).toBe('PAID');
      expect(mockPayment.status).toBe(PaymentStatus.COMPLETED);
      expect(reminderService.scheduleAppointmentReminders).toHaveBeenCalled();
      expect(emailService.sendPaymentSuccess).toHaveBeenCalled();
    });

    it('should reject payment verification if signature does not match', async () => {
      paymentRepo.findOne.mockResolvedValueOnce({
        id: 'pay-1',
        orderId: 'order_123',
        patientId: 'patient-uuid-1',
        appointmentId: 'appt-1',
        status: PaymentStatus.PENDING,
      });

      razorpayService.verifyPaymentSignature.mockReturnValueOnce(false);

      await expect(
        service.verifyPayment('user-patient-1', {
          orderId: 'order_123',
          paymentId: 'pay_123',
          signature: 'invalid_sig',
          appointmentId: 'appt-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return idempotent success if payment is already marked COMPLETED', async () => {
      paymentRepo.findOne.mockResolvedValueOnce({
        id: 'pay-1',
        orderId: 'order_123',
        patientId: 'patient-uuid-1',
        appointmentId: 'appt-1',
        status: PaymentStatus.COMPLETED,
        paymentId: 'pay_123',
      });

      const res = await service.verifyPayment('user-patient-1', {
        orderId: 'order_123',
        paymentId: 'pay_123',
        signature: 'valid_sig',
        appointmentId: 'appt-1',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('already verified');
    });

    it('should forbid verification if patient does not own the payment attempt', async () => {
      paymentRepo.findOne.mockResolvedValueOnce({
        id: 'pay-1',
        orderId: 'order_123',
        patientId: 'other-patient-uuid', // Different patient!
        appointmentId: 'appt-1',
        status: PaymentStatus.PENDING,
      });

      await expect(
        service.verifyPayment('user-patient-1', {
          orderId: 'order_123',
          paymentId: 'pay_123',
          signature: 'valid_sig',
          appointmentId: 'appt-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Webhooks & Monotonic State Invariant (Phase 5)', () => {
    it('should ignore duplicate webhook event if already processed', async () => {
      webhookRepo.findOne.mockResolvedValueOnce({
        eventId: 'evt_123',
        status: WebhookEventStatus.PROCESSED,
      });

      const payload = JSON.stringify({ id: 'evt_123', event: 'payment.captured' });
      const res = await service.handleWebhook(payload, 'valid_sig');

      expect(res.status).toBe('already_processed');
    });

    it('should enforce monotonic payment invariant: payment.failed must NEVER overwrite a COMPLETED payment', async () => {
      const mockCompletedPayment = {
        id: 'pay-1',
        orderId: 'order_completed',
        status: PaymentStatus.COMPLETED,
      };

      paymentRepo.findOne.mockResolvedValueOnce(mockCompletedPayment);

      const payload = JSON.stringify({
        id: 'evt_failed_delayed',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              order_id: 'order_completed',
              id: 'pay_failed',
              error_code: 'BAD_REQUEST',
            },
          },
        },
      });

      await service.handleWebhook(payload, 'valid_sig');

      // Assert status was not changed from COMPLETED to FAILED
      expect(mockCompletedPayment.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should throw BadRequestException if webhook signature is missing', async () => {
      const payload = JSON.stringify({ event: 'payment.captured' });
      await expect(service.handleWebhook(payload, '')).rejects.toThrow(BadRequestException);
    });

    it('should ignore unsupported webhook events gracefully without corrupting database state', async () => {
      const payload = JSON.stringify({ id: 'evt_custom', event: 'order.paid' });
      const res = await service.handleWebhook(payload, 'valid_sig');
      expect(res.status).toBe('ignored');
    });
  });

  describe('Refund Management (Phase 8)', () => {
    it('should successfully initiate an eligible refund and update remaining balance', async () => {
      const mockAppointment = {
        id: 'appt-1',
        patientId: 'patient-uuid-1',
        doctorId: 'doctor-uuid-1',
        date: '2026-11-20', // far in future (> 30 min)
        startTime: '10:00',
        doctor: mockDoctor,
        patient: mockPatient,
      };

      const mockPayment = {
        id: 'pay-1',
        paymentId: 'pay_provider_123',
        amount: 50000,
        amountRefunded: 0,
        status: PaymentStatus.COMPLETED,
      };

      appointmentRepo.findOne.mockResolvedValueOnce(mockAppointment);
      paymentRepo.findOne.mockResolvedValueOnce(mockPayment);

      const res = await service.createRefund('user-patient-1', 'PATIENT', {
        appointmentId: 'appt-1',
        amount: 25000,
        reason: 'Patient reschedule plan',
      });

      expect(res.data.status).toBe(RefundStatus.PROCESSED);
      expect(mockPayment.amountRefunded).toBe(25000);
      expect(mockPayment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
      expect(razorpayService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'pay_provider_123',
          amount: 25000,
        }),
      );
    });

    it('should reject refund request that exceeds remaining refundable balance', async () => {
      const mockAppointment = {
        id: 'appt-1',
        patientId: 'patient-uuid-1',
        doctorId: 'doctor-uuid-1',
        date: '2026-11-20',
        startTime: '10:00',
      };

      const mockPayment = {
        id: 'pay-1',
        paymentId: 'pay_provider_123',
        amount: 50000,
        amountRefunded: 40000, // Only 10000 remaining
        status: PaymentStatus.PARTIALLY_REFUNDED,
      };

      appointmentRepo.findOne.mockResolvedValueOnce(mockAppointment);
      paymentRepo.findOne.mockResolvedValueOnce(mockPayment);

      await expect(
        service.createRefund('user-patient-1', 'PATIENT', {
          appointmentId: 'appt-1',
          amount: 20000, // exceeds 10000
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject refund request submitted within 30-minute cutoff prior to appointment', async () => {
      // Mock appointment 10 minutes in future (inside 30-min non-refundable window)
      const nearFuture = new Date(Date.now() + 10 * 60 * 1000);
      const dateStr = nearFuture.toISOString().split('T')[0];
      const hours = String(nearFuture.getHours()).padStart(2, '0');
      const minutes = String(nearFuture.getMinutes()).padStart(2, '0');

      const mockAppointment = {
        id: 'appt-imminent-1',
        patientId: 'patient-uuid-1',
        doctorId: 'doctor-uuid-1',
        date: dateStr,
        startTime: `${hours}:${minutes}`,
      };

      appointmentRepo.findOne.mockResolvedValueOnce(mockAppointment);

      await expect(
        service.createRefund('user-patient-1', 'PATIENT', {
          appointmentId: 'appt-imminent-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Durable Expiration & Reconciliation (Phase 7)', () => {
    it('should release expired pending booking reservations and free the slot', async () => {
      const mockExpiredAppt = {
        id: 'expired-appt-1',
        status: AppointmentStatus.PENDING_PAYMENT,
        pendingExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      };

      appointmentRepo.find.mockResolvedValueOnce([mockExpiredAppt]);
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(mockExpiredAppt) // for appointment lock
        .mockResolvedValueOnce({ id: 'pay-1', status: PaymentStatus.PENDING, paymentId: null }); // for payment

      const count = await service.reconcileExpiredBookings();

      expect(count).toBe(1);
      expect(mockExpiredAppt.status).toBe(AppointmentStatus.CANCELLED);
      expect(mockExpiredAppt.paymentStatus).toBe('FAILED');
    });
  });
});
