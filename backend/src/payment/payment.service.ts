import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, Not, In, LessThanOrEqual } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Refund } from './entities/refund.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { PaymentStatus } from './enums/payment-status.enum';
import { RefundStatus } from './enums/refund-status.enum';
import { WebhookEventStatus } from './enums/webhook-event-status.enum';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RazorpayService } from './providers/razorpay.service';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/enums/notification-type.enum';
import { AppointmentGateway, SOCKET_EVENTS } from '../sockets/appointment.gateway';
import { QueueService } from '../appointment/queue.service';
import { AvailabilityService } from '../doctor/availability.service';
import { ReminderService } from '../reminder/reminder.service';
import { getTodayIST, formatDate, formatTime } from '../common/utils/appointment.utils';

const RESERVATION_EXPIRY_MINUTES = 15;
const CANCEL_CUTOFF_MINUTES = 30;

function parseDateTimeIST(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00+05:30`);
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,

    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,

    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepo: Repository<WebhookEvent>,

    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,

    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,

    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,

    private readonly razorpayService: RazorpayService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    private readonly dataSource: DataSource,
    private readonly queueService: QueueService,

    @Inject(forwardRef(() => AvailabilityService))
    private readonly availabilityService: AvailabilityService,

    @Inject(forwardRef(() => ReminderService))
    private readonly reminderService: ReminderService,

    @Optional()
    private readonly appointmentGateway?: AppointmentGateway,
  ) {}

  private async getPatientByUserId(userId: string): Promise<Patient> {
    const patient = await this.patientRepo.findOne({
      where: { userId },
      relations: { user: true },
    });
    if (!patient) {
      throw new NotFoundException('Patient profile not found. Please create your profile first.');
    }
    return patient;
  }

  private async assignTokenNumber(
    manager: EntityManager,
    doctorId: string,
    date: string,
  ): Promise<number> {
    const appointments = await manager.find(Appointment, {
      select: { tokenNumber: true },
      where: {
        doctorId,
        date,
        status: Not(In([AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED])),
      },
      lock: { mode: 'pessimistic_write' },
      loadEagerRelations: false,
    });

    const tokens = appointments
      .map((a) => a.tokenNumber)
      .filter((t): t is number => typeof t === 'number' && t > 0);

    const currentMax = tokens.length > 0 ? Math.max(...tokens) : 0;
    return currentMax + 1;
  }

  /**
   * Phase 4: Create Order and reserve slot idempotently
   */
  async createOrder(userId: string, dto: CreateOrderDto) {
    const patient = await this.getPatientByUserId(userId);
    const doctor = await this.doctorRepo.findOne({ where: { id: dto.doctorId } });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${dto.doctorId} not found`);
    }

    // Authoritative consultation fee from doctor profile (converted to minor integer units: paise)
    const consultationFeeRupees = Number(doctor.consultationFee);
    const amountInPaise = Math.round(consultationFeeRupees * 100);

    if (amountInPaise <= 0) {
      throw new BadRequestException('Consultation fee must be greater than zero for paid booking');
    }

    // Check idempotency key if provided
    if (dto.idempotencyKey) {
      const existingPayment = await this.paymentRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
        relations: { appointment: true },
      });
      if (existingPayment) {
        return {
          orderId: existingPayment.orderId,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          keyId: this.razorpayService.getPublicKey(),
          appointmentId: existingPayment.appointmentId,
          expiresAt: existingPayment.appointment?.pendingExpiresAt,
        };
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    let reservedAppointment: Appointment;

    try {
      // 1. Verify no existing confirmed appointment on same day
      const existingConfirmed = await queryRunner.manager.findOne(Appointment, {
        where: {
          patientId: patient.id,
          doctorId: dto.doctorId,
          date: dto.date,
          status: AppointmentStatus.CONFIRMED,
        },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });

      if (existingConfirmed) {
        throw new ConflictException('You already have a confirmed appointment with this doctor on this day');
      }

      // 2. Concurrency check: verify slot is not booked or held by an unexpired pending reservation
      const conflictingBooking = await queryRunner.manager
        .createQueryBuilder(Appointment, 'a')
        .setLock('pessimistic_write')
        .where('a.doctorId = :doctorId', { doctorId: dto.doctorId })
        .andWhere('a.date = :date', { date: dto.date })
        .andWhere('a.startTime = :startTime', { startTime: dto.startTime })
        .andWhere('a.endTime = :endTime', { endTime: dto.endTime })
        .andWhere(
          `(a.status = :confirmedStatus OR (a.status = :pendingStatus AND a.pendingExpiresAt > :now))`,
          {
            confirmedStatus: AppointmentStatus.CONFIRMED,
            pendingStatus: AppointmentStatus.PENDING_PAYMENT,
            now: new Date(),
          },
        )
        .getOne();

      if (conflictingBooking) {
        if (
          conflictingBooking.status === AppointmentStatus.PENDING_PAYMENT &&
          conflictingBooking.patientId === patient.id &&
          conflictingBooking.pendingExpiresAt &&
          new Date(conflictingBooking.pendingExpiresAt) > new Date()
        ) {
          // Re-using active pending reservation by the same patient
          reservedAppointment = conflictingBooking;
          const existingPendingPayment = await queryRunner.manager.findOne(Payment, {
            where: {
              appointmentId: conflictingBooking.id,
              status: PaymentStatus.PENDING,
            },
            order: { createdAt: 'DESC' },
          });

          if (existingPendingPayment) {
            await queryRunner.commitTransaction();
            return {
              orderId: existingPendingPayment.orderId,
              amount: existingPendingPayment.amount,
              currency: existingPendingPayment.currency,
              keyId: this.razorpayService.getPublicKey(),
              appointmentId: reservedAppointment.id,
              expiresAt: reservedAppointment.pendingExpiresAt,
            };
          }
        } else {
          throw new ConflictException('This slot is already booked or currently reserved by another patient');
        }
      } else {
        // 3. Create reservation appointment with expiry
        const expiresAt = new Date(Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000);

        const appointment = this.appointmentRepo.create({
          doctorId: dto.doctorId,
          patientId: patient.id,
          date: dto.date,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: AppointmentStatus.PENDING_PAYMENT,
          paymentStatus: 'PENDING',
          pendingExpiresAt: expiresAt,
          tokenNumber: null,
        });

        reservedAppointment = await queryRunner.manager.save(appointment);
      }
      await queryRunner.commitTransaction();
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      if (err?.code === '40001' || err?.code === '23505') {
        throw new ConflictException('Slot reservation conflict. Please choose another slot.');
      }
      throw err;
    } finally {
      await queryRunner.release();
    }

    // 4. Create provider order outside DB transaction (never hold DB lock during network call)
    let providerOrder: any;
    try {
      providerOrder = await this.razorpayService.createOrder({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${reservedAppointment.id.replace(/-/g, '').substring(0, 16)}`,
        notes: {
          appointmentId: reservedAppointment.id,
          doctorId: dto.doctorId,
          patientId: patient.id,
        },
      });
    } catch (err: any) {
      // Release reservation if provider order creation fails
      await this.appointmentRepo.update(reservedAppointment.id, {
        status: AppointmentStatus.CANCELLED,
        paymentStatus: 'FAILED',
        pendingExpiresAt: null,
      });
      throw err;
    }

    // 5. Persist Payment record
    const payment = this.paymentRepo.create({
      appointmentId: reservedAppointment.id,
      patientId: patient.id,
      doctorId: dto.doctorId,
      provider: 'RAZORPAY',
      orderId: providerOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      status: PaymentStatus.PENDING,
      idempotencyKey: dto.idempotencyKey || null,
    });

    await this.paymentRepo.save(payment);

    return {
      orderId: providerOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      keyId: this.razorpayService.getPublicKey(),
      appointmentId: reservedAppointment.id,
      expiresAt: reservedAppointment.pendingExpiresAt,
    };
  }

  /**
   * Phase 5: Server-side Payment Verification
   */
  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const patient = await this.getPatientByUserId(userId);

    const payment = await this.paymentRepo.findOne({
      where: { orderId: dto.orderId },
      relations: { appointment: true, doctor: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment record for order ${dto.orderId} not found`);
    }

    if (payment.patientId !== patient.id) {
      throw new ForbiddenException('Unauthorized access to payment confirmation');
    }

    if (payment.appointmentId !== dto.appointmentId) {
      throw new BadRequestException('Mismatched appointment and order details');
    }

    // Idempotency: if already completed, return success safely
    if (payment.status === PaymentStatus.COMPLETED) {
      return {
        success: true,
        message: 'Payment already verified successfully',
        appointmentId: payment.appointmentId,
        paymentId: payment.paymentId,
      };
    }

    // Cryptographic signature verification using official Razorpay HMAC
    const isValidSignature = this.razorpayService.verifyPaymentSignature({
      orderId: dto.orderId,
      paymentId: dto.paymentId,
      signature: dto.signature,
    });

    if (!isValidSignature) {
      payment.errorCode = 'SIGNATURE_VERIFICATION_FAILED';
      payment.errorDescription = 'Client provided signature does not match expected HMAC';
      await this.paymentRepo.save(payment);
      throw new BadRequestException('Invalid payment signature');
    }

    // Delegate to shared transactional confirmation method (re-checks expiry & booking conflicts)
    return this.confirmAppointmentPaymentTransaction({
      payment,
      paymentId: dto.paymentId,
      signature: dto.signature,
      patient,
    });
  }

  /**
   * Phase 5: Webhook Handler with Raw-Body Signature Verification and Idempotent Processing
   */
  async handleWebhook(rawBody: string | Buffer, signature: string): Promise<{ status: string }> {
    if (!signature) {
      throw new BadRequestException('Missing x-razorpay-signature header');
    }

    const isValid = this.razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      this.logger.warn('Rejected webhook: invalid signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
    const eventType = payload.event;
    const eventId = payload.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Webhook Deduplication Check
    const existingEvent = await this.webhookEventRepo.findOne({ where: { eventId } });
    if (existingEvent && existingEvent.status === WebhookEventStatus.PROCESSED) {
      this.logger.log(`Webhook event ${eventId} already processed.`);
      return { status: 'already_processed' };
    }

    const webhookEvent = existingEvent || this.webhookEventRepo.create({
      provider: 'RAZORPAY',
      eventId,
      eventType,
      payload,
      status: WebhookEventStatus.PENDING,
    });
    await this.webhookEventRepo.save(webhookEvent);

    try {
      switch (eventType) {
        case 'payment.captured':
          await this.processPaymentCapturedWebhook(payload.payload?.payment?.entity);
          break;

        case 'payment.failed':
          await this.processPaymentFailedWebhook(payload.payload?.payment?.entity);
          break;

        case 'refund.processed':
          await this.processRefundProcessedWebhook(payload.payload?.refund?.entity);
          break;

        case 'refund.failed':
          await this.processRefundFailedWebhook(payload.payload?.refund?.entity);
          break;

        default:
          this.logger.log(`Unhandled webhook event: ${eventType}`);
          webhookEvent.status = WebhookEventStatus.IGNORED;
          await this.webhookEventRepo.save(webhookEvent);
          return { status: 'ignored' };
      }

      webhookEvent.status = WebhookEventStatus.PROCESSED;
      webhookEvent.processedAt = new Date();
      await this.webhookEventRepo.save(webhookEvent);
    } catch (err: any) {
      this.logger.error(`Error processing webhook event ${eventId}: ${err.message}`, err.stack);
      webhookEvent.status = WebhookEventStatus.FAILED;
      webhookEvent.errorMessage = err.message;
      webhookEvent.attempts += 1;
      await this.webhookEventRepo.save(webhookEvent);
      throw err;
    }

    return { status: 'ok' };
  }

  private async processPaymentCapturedWebhook(entity: any): Promise<void> {
    if (!entity) return;

    const orderId = entity.order_id;
    const paymentId = entity.id;

    const payment = await this.paymentRepo.findOne({
      where: { orderId },
      relations: { appointment: true, patient: { user: true }, doctor: true },
    });

    if (!payment) {
      this.logger.warn(`Payment record not found for webhook order ${orderId}`);
      return;
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      this.logger.log(`Payment for order ${orderId} already completed.`);
      return;
    }

    await this.confirmAppointmentPaymentTransaction({
      payment,
      paymentId,
      method: entity.method || null,
      patient: payment.patient,
    });
  }

  private async processPaymentFailedWebhook(entity: any): Promise<void> {
    if (!entity) return;
    const orderId = entity.order_id;

    const payment = await this.paymentRepo.findOne({ where: { orderId } });
    if (!payment) return;

    // Monotonic invariant: Never overwrite an already confirmed payment with a failure
    if (payment.status === PaymentStatus.COMPLETED) {
      this.logger.warn(`Received payment.failed for already completed payment order ${orderId}. Ignoring.`);
      return;
    }

    payment.status = PaymentStatus.FAILED;
    payment.errorCode = entity.error_code || 'PAYMENT_FAILED';
    payment.errorDescription = entity.error_description || null;
    await this.paymentRepo.save(payment);

    await this.appointmentRepo.update(payment.appointmentId, {
      status: AppointmentStatus.PAYMENT_FAILED,
      paymentStatus: 'FAILED',
      pendingExpiresAt: null,
    });
  }

  private async processRefundProcessedWebhook(entity: any): Promise<void> {
    if (!entity) return;
    const providerRefundId = entity.id;

    const refund = await this.refundRepo.findOne({
      where: { providerRefundId },
      relations: { payment: true, patient: { user: true }, appointment: { doctor: true } },
    });

    if (refund) {
      refund.status = RefundStatus.PROCESSED;
      refund.processedAt = new Date();
      await this.refundRepo.save(refund);

      if (refund.patient?.user?.email) {
        this.emailService.sendRefundCompleted(
          refund.patient.user.email,
          refund.patient.fullName,
          refund.appointment?.doctor?.fullName || 'Doctor',
          refund.amount,
          refund.providerRefundId || refund.id,
        );
      }
    }
  }

  private async processRefundFailedWebhook(entity: any): Promise<void> {
    if (!entity) return;
    const providerRefundId = entity.id;

    const refund = await this.refundRepo.findOne({
      where: { providerRefundId },
      relations: { patient: { user: true }, appointment: { doctor: true } },
    });

    if (refund) {
      refund.status = RefundStatus.FAILED;
      refund.errorCode = entity.error_code || 'REFUND_FAILED';
      refund.errorDescription = entity.error_description || null;
      await this.refundRepo.save(refund);

      if (refund.patient?.user?.email) {
        this.emailService.sendRefundFailed(
          refund.patient.user.email,
          refund.patient.fullName,
          refund.appointment?.doctor?.fullName || 'Doctor',
          refund.amount,
          refund.errorDescription || 'Bank processing error',
        );
      }
    }
  }

  /**
   * Phase 5/6: Shared Transactional Confirmation for verifyPayment & Webhook (P1 Issues #1 & #2 Fixed)
   * Re-validates:
   * 1. Appointment status & expiry (prevents normal confirmation if expired)
   * 2. Slot conflicts (ensures no other confirmed appointment took the slot)
   * 3. Patient same-day duplicate booking conflicts
   * 4. Idempotency (safe if already completed)
   * 5. Atomically assigns token and confirms appointment, or triggers late payment refund
   */
  async confirmAppointmentPaymentTransaction(params: {
    payment: Payment;
    paymentId: string;
    signature?: string | null;
    method?: string | null;
    patient?: Patient | null;
  }): Promise<{
    success: boolean;
    message: string;
    appointmentId?: string;
    paymentId?: string;
    tokenNumber?: number | null;
    refundId?: string;
  }> {
    const { payment, paymentId, signature, method } = params;

    // Idempotency: if already completed, return success safely
    if (payment.status === PaymentStatus.COMPLETED) {
      return {
        success: true,
        message: 'Payment already verified successfully',
        appointmentId: payment.appointmentId,
        paymentId: payment.paymentId || paymentId,
        tokenNumber: payment.appointment?.tokenNumber ?? null,
      };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const appt = await queryRunner.manager.findOne(Appointment, {
        where: { id: payment.appointmentId },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });

      if (!appt) {
        throw new NotFoundException('Appointment record not found');
      }

      const lockedPayment = await queryRunner.manager.findOne(Payment, {
        where: { id: payment.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedPayment) {
        throw new NotFoundException('Payment record not found in transaction');
      }

      if (lockedPayment.status === PaymentStatus.COMPLETED) {
        await queryRunner.rollbackTransaction();
        return {
          success: true,
          message: 'Payment already verified successfully',
          appointmentId: appt.id,
          paymentId: lockedPayment.paymentId || paymentId,
          tokenNumber: appt.tokenNumber,
        };
      }

      const now = new Date();
      const isExpired = !!(appt.pendingExpiresAt && new Date(appt.pendingExpiresAt) <= now);
      const isNotPending = appt.status !== AppointmentStatus.PENDING_PAYMENT;

      // Concurrency & conflict validation (P1 Issue #2)
      // 1. Check if another confirmed appointment already took this doctor's slot
      const conflictingSlot = await queryRunner.manager
        .createQueryBuilder(Appointment, 'a')
        .where('a.doctorId = :doctorId', { doctorId: appt.doctorId })
        .andWhere('a.date = :date', { date: appt.date })
        .andWhere('a.startTime = :startTime', { startTime: appt.startTime })
        .andWhere('a.endTime = :endTime', { endTime: appt.endTime })
        .andWhere('a.status = :confirmedStatus', { confirmedStatus: AppointmentStatus.CONFIRMED })
        .andWhere('a.id != :currentId', { currentId: appt.id })
        .getOne();

      // 2. Check if this patient already has a confirmed appointment with this doctor on this day
      const conflictingPatientDayBooking = await queryRunner.manager
        .createQueryBuilder(Appointment, 'a')
        .where('a.doctorId = :doctorId', { doctorId: appt.doctorId })
        .andWhere('a.date = :date', { date: appt.date })
        .andWhere('a.patientId = :patientId', { patientId: appt.patientId })
        .andWhere('a.status = :confirmedStatus', { confirmedStatus: AppointmentStatus.CONFIRMED })
        .andWhere('a.id != :currentId', { currentId: appt.id })
        .getOne();

      const hasConflict = !!(conflictingSlot || conflictingPatientDayBooking);

      // P1 Issue #1: If reservation expired OR status is not pending OR there is any conflict:
      if (isExpired || isNotPending || hasConflict) {
        this.logger.warn(
          `Cannot confirm appointment ${appt.id} normally: isExpired=${isExpired}, status=${appt.status}, hasConflict=${hasConflict}`,
        );

        // If slot is conflicted or was cancelled, trigger automatic 100% refund
        if (hasConflict || appt.status === AppointmentStatus.CANCELLED) {
          await queryRunner.rollbackTransaction();
          return this.handleLatePaymentConflict(lockedPayment, appt, paymentId, signature, {
            reason: conflictingSlot
              ? 'Slot was taken by another patient while reservation was pending/expired'
              : conflictingPatientDayBooking
              ? 'Patient already has a confirmed appointment with this doctor today'
              : 'Reservation expired before payment completed',
          });
        }

        // If expired with no conflicts, check if doctor/slot can be recovered safely
        const canRecover = !hasConflict;
        if (!canRecover) {
          await queryRunner.rollbackTransaction();
          return this.handleLatePaymentConflict(lockedPayment, appt, paymentId, signature, {
            reason: 'Reservation expired and slot is unavailable. Full refund initiated.',
          });
        }
      }

      // Normal or recovered confirmation: Assign sequential clinic token
      const tokenNumber = await this.assignTokenNumber(queryRunner.manager, appt.doctorId, appt.date);

      appt.status = AppointmentStatus.CONFIRMED;
      appt.paymentStatus = 'PAID';
      appt.pendingExpiresAt = null;
      appt.tokenNumber = tokenNumber;
      const confirmedAppointment = await queryRunner.manager.save(appt);

      lockedPayment.status = PaymentStatus.COMPLETED;
      lockedPayment.paymentId = paymentId;
      if (signature) lockedPayment.signature = signature;
      if (method) lockedPayment.method = method;
      await queryRunner.manager.save(lockedPayment);

      const todayStr = getTodayIST();
      if (confirmedAppointment.date === todayStr) {
        await this.queueService.recalculateQueue(
          confirmedAppointment.doctorId,
          confirmedAppointment.date,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();

      // Trigger post-confirmation side effects (emails, notifications, reminders, sockets)
      let patientEntity: Patient | null = params.patient || payment.patient || null;
      if (!patientEntity) {
        patientEntity = await this.patientRepo.findOne({
          where: { id: appt.patientId },
          relations: { user: true },
        });
      }
      if (patientEntity) {
        await this.triggerPostConfirmationSideEffects(confirmedAppointment, lockedPayment, patientEntity);
      }

      return {
        success: true,
        message: 'Payment verified and appointment confirmed successfully',
        appointmentId: confirmedAppointment.id,
        paymentId: lockedPayment.paymentId,
        tokenNumber: confirmedAppointment.tokenNumber,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Late payment / conflict recovery: Full automatic refund with notifications
   */
  private async handleLatePaymentConflict(
    payment: Payment,
    appt: Appointment,
    paymentId: string,
    signature?: string | null,
    options?: { reason?: string },
  ) {
    const reason = options?.reason || 'Reservation expired and slot was taken. Full refund initiated.';
    this.logger.warn(`Initiating automatic 100% refund for payment ${paymentId}: ${reason}`);

    // Ensure payment record is recorded before refunding
    payment.status = PaymentStatus.COMPLETED;
    payment.paymentId = paymentId;
    if (signature) payment.signature = signature;
    await this.paymentRepo.save(payment);

    let providerRefund: any;
    try {
      providerRefund = await this.razorpayService.createRefund({
        paymentId,
        amount: payment.amount,
        notes: { reason, appointmentId: appt.id },
      });
    } catch (err: any) {
      this.logger.error(`Automatic refund provider call failed for payment ${paymentId}: ${err.message}`, err.stack);
      payment.errorCode = 'REFUND_FAILED';
      payment.errorDescription = err.message;
      await this.paymentRepo.save(payment);
      return {
        success: false,
        message: 'Reservation expired. Automatic refund attempt failed and queued for manual reconciliation.',
        error: err.message,
      };
    }

    const refund = this.refundRepo.create({
      paymentId: payment.id,
      appointmentId: appt.id,
      patientId: payment.patientId,
      providerRefundId: providerRefund.id,
      amount: payment.amount,
      currency: 'INR',
      status: RefundStatus.PROCESSED,
      reason,
      processedAt: new Date(),
    });
    await this.refundRepo.save(refund);

    payment.amountRefunded = payment.amount;
    payment.status = PaymentStatus.REFUNDED;
    await this.paymentRepo.save(payment);

    if (appt.status !== AppointmentStatus.CANCELLED) {
      appt.status = AppointmentStatus.CANCELLED;
      appt.paymentStatus = 'REFUNDED';
      appt.pendingExpiresAt = null;
      await this.appointmentRepo.save(appt);
    }

    const fullAppt = await this.appointmentRepo.findOne({
      where: { id: appt.id },
      relations: { doctor: true, patient: { user: true } },
    });

    const email = fullAppt?.patient?.user?.email;
    if (email) {
      await this.emailService.sendRefundInitiated(
        email,
        fullAppt?.patient?.fullName || 'Patient',
        fullAppt?.doctor?.fullName || 'Doctor',
        payment.amount,
        providerRefund.id,
        reason,
      );
    }

    await this.notificationService.createNotification(
      appt.patientId,
      'Reservation Expired — Full Refund Initiated',
      `Your reservation with Dr. ${fullAppt?.doctor?.fullName || 'Doctor'} on ${formatDate(appt.date)} expired and the slot was taken. A full refund of ₹${payment.amount / 100} has been automatically initiated.`,
      NotificationType.APPOINTMENT_CANCELLED,
    );

    return {
      success: false,
      message: 'Reservation expired and slot was taken. A full refund has been automatically initiated.',
      refundId: providerRefund.id,
    };
  }

  /**
   * Backward-compatible handleLatePayment wrapper
   */
  private async handleLatePayment(
    payment: Payment,
    paymentId: string,
    signature: string | null,
  ): Promise<any> {
    return this.confirmAppointmentPaymentTransaction({
      payment,
      paymentId,
      signature,
    });
  }

  private async isSlotAvailable(doctorId: string, date: string, startTime: string, endTime: string): Promise<boolean> {
    const existing = await this.appointmentRepo.findOne({
      where: {
        doctorId,
        date,
        startTime,
        endTime,
        status: AppointmentStatus.CONFIRMED,
      },
    });
    return !existing;
  }

  /**
   * Post-confirmation side effects (emails, notifications, persistent reminders, sockets)
   */
  private async triggerPostConfirmationSideEffects(
    appt: Appointment,
    payment: Payment,
    patient: Patient,
  ): Promise<void> {
    try {
      // 1. Persistent 24h & 1h reminder scheduling
      await this.reminderService.scheduleAppointmentReminders(appt);

      // 2. Booking confirmation email
      const fullAppt = await this.appointmentRepo.findOne({
        where: { id: appt.id },
        relations: { doctor: true, patient: { user: true } },
      });

      const email = fullAppt?.patient?.user?.email || patient?.user?.email;
      if (email && fullAppt) {
        await this.emailService.sendBookingConfirmation(
          email,
          fullAppt.patient.fullName,
          fullAppt.doctor.fullName,
          fullAppt.doctor.specialization,
          fullAppt.date,
          fullAppt.startTime,
          fullAppt.tokenNumber,
          fullAppt.doctor.phone ?? null,
          fullAppt.id,
        );

        // 3. Payment receipt email
        await this.emailService.sendPaymentSuccess(
          email,
          fullAppt.patient.fullName,
          fullAppt.doctor.fullName,
          payment.amount,
          payment.orderId,
          payment.paymentId || 'N/A',
          fullAppt.date,
          fullAppt.startTime,
        );
      }

      // 4. In-app notification
      await this.notificationService.createNotification(
        appt.patientId,
        'Appointment Confirmed & Paid',
        `Your appointment with Dr. ${fullAppt?.doctor?.fullName || 'Doctor'} on ${formatDate(appt.date)} at ${formatTime(appt.startTime)} is confirmed!`,
        NotificationType.APPOINTMENT_BOOKED,
        appt.tokenNumber ? `Token #${appt.tokenNumber}` : null,
      );

      // 5. Broadcast live queue if appointment is today
      const todayStr = getTodayIST();
      if (appt.date === todayStr) {
        await this.queueService.broadcastQueueStatus(appt.doctorId, appt.date, this.dataSource.manager);
      }

      // 6. Socket event to doctor
      this.appointmentGateway?.emitAppointmentEvent(SOCKET_EVENTS.BOOKED, {
        appointmentId: appt.id,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        status: appt.status,
        updatedAt: new Date().toISOString(),
        patientName: patient.fullName,
        date: appt.date,
        startTime: appt.startTime,
        endTime: appt.endTime,
      });
    } catch (err: any) {
      this.logger.error('Error during post-confirmation side effects:', err.message);
    }
  }

  /**
   * Phase 8: Full and Partial Refund Management
   */
  async createRefund(userId: string, userRole: string, dto: CreateRefundDto) {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: dto.appointmentId },
      relations: { doctor: true, patient: { user: true } },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${dto.appointmentId} not found`);
    }

    // Role check & ownership validation
    if (userRole === 'PATIENT') {
      const patient = await this.getPatientByUserId(userId);
      if (appointment.patientId !== patient.id) {
        throw new ForbiddenException('Access denied: You can only request refunds for your own appointments');
      }

      // Validate cancellation/refund window (> 30 minutes before appointment start)
      const appointmentStart = parseDateTimeIST(appointment.date, appointment.startTime);
      const now = new Date();
      const diffMinutes = (appointmentStart.getTime() - now.getTime()) / (1000 * 60);

      if (diffMinutes < CANCEL_CUTOFF_MINUTES) {
        throw new BadRequestException(
          `Refunds cannot be requested less than ${CANCEL_CUTOFF_MINUTES} minutes before the appointment.`,
        );
      }
    } else if (userRole === 'DOCTOR') {
      const doctor = await this.doctorRepo.findOne({ where: { userId } });
      if (!doctor || appointment.doctorId !== doctor.id) {
        throw new ForbiddenException('Access denied: You can only refund appointments booked with you');
      }
    }

    // Find captured payment
    const payment = await this.paymentRepo.findOne({
      where: {
        appointmentId: dto.appointmentId,
        status: In([PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED]),
      },
      order: { createdAt: 'DESC' },
    });

    if (!payment || !payment.paymentId) {
      throw new BadRequestException('No eligible captured payment found for this appointment');
    }

    // Calculate remaining refundable balance
    const remainingBalance = payment.amount - payment.amountRefunded;
    if (remainingBalance <= 0) {
      throw new BadRequestException('This payment has already been fully refunded');
    }

    const refundAmount = dto.amount ? dto.amount : remainingBalance;

    if (refundAmount > remainingBalance) {
      throw new BadRequestException(
        `Requested refund amount (${refundAmount} paise) exceeds available refundable balance (${remainingBalance} paise)`,
      );
    }

    // Check request idempotency
    if (dto.idempotencyKey) {
      const existingRefund = await this.refundRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingRefund) {
        return existingRefund;
      }
    }

    const effectiveIdempotencyKey =
      dto.idempotencyKey ||
      `rfnd_${payment.id}_${refundAmount}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Check request idempotency
    const existingRefund = await this.refundRepo.findOne({
      where: { idempotencyKey: effectiveIdempotencyKey },
    });
    if (existingRefund) {
      if (existingRefund.status === RefundStatus.PROCESSED) {
        return {
          message: 'Refund already processed successfully',
          data: {
            refundId: existingRefund.id,
            providerRefundId: existingRefund.providerRefundId,
            amount: existingRefund.amount,
            currency: existingRefund.currency,
            status: existingRefund.status,
            remainingBalance: payment.amount - payment.amountRefunded,
          },
        };
      }
    }

    // Phase 1: Lock payment and calculate balance under pessimistic lock
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let pendingRefund: Refund;

    try {
      const lockedPayment = await queryRunner.manager.findOne(Payment, {
        where: { id: payment.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedPayment) {
        throw new NotFoundException('Payment record not found');
      }

      const currentRemainingBalance = lockedPayment.amount - lockedPayment.amountRefunded;
      if (currentRemainingBalance <= 0) {
        throw new BadRequestException('This payment has already been fully refunded');
      }

      if (refundAmount > currentRemainingBalance) {
        throw new BadRequestException(
          `Requested refund amount (${refundAmount} paise) exceeds available refundable balance (${currentRemainingBalance} paise)`,
        );
      }

      // Pre-persist the Refund record in PENDING state before calling provider
      const refundEntity = queryRunner.manager.create(Refund, {
        paymentId: lockedPayment.id,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        providerRefundId: null,
        amount: refundAmount,
        currency: 'INR',
        status: RefundStatus.PENDING,
        reason: dto.reason || 'Consultation cancellation refund',
        idempotencyKey: effectiveIdempotencyKey,
      });

      pendingRefund = await queryRunner.manager.save(refundEntity);
      await queryRunner.commitTransaction();
    } catch (txErr) {
      await queryRunner.rollbackTransaction();
      throw txErr;
    } finally {
      await queryRunner.release();
    }

    // Phase 2: Call Razorpay outside DB transaction
    let providerRefund: any;
    try {
      providerRefund = await this.razorpayService.createRefund({
        paymentId: payment.paymentId,
        amount: refundAmount,
        notes: {
          appointmentId: appointment.id,
          refundId: pendingRefund.id,
          idempotencyKey: effectiveIdempotencyKey,
          reason: dto.reason || 'Patient/Doctor requested refund',
        },
      });
    } catch (providerErr: any) {
      await this.refundRepo.update(pendingRefund.id, {
        status: RefundStatus.FAILED,
        errorCode: providerErr?.code || 'PROVIDER_REFUND_FAILED',
        errorDescription: providerErr?.message || 'Provider refund creation failed',
      });
      throw providerErr;
    }

    // Phase 3: Update DB with provider response in a locked transaction
    const updateRunner = this.dataSource.createQueryRunner();
    await updateRunner.connect();
    await updateRunner.startTransaction();

    let savedRefund: Refund;
    let finalRemainingBalance = 0;

    try {
      const lockedPayment = await updateRunner.manager.findOne(Payment, {
        where: { id: payment.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedPayment) throw new NotFoundException('Payment not found');

      const lockedAppt = await updateRunner.manager.findOne(Appointment, {
        where: { id: appointment.id },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });

      const refToUpdate = await updateRunner.manager.findOne(Refund, {
        where: { id: pendingRefund.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (refToUpdate) {
        refToUpdate.providerRefundId = providerRefund.id;
        refToUpdate.status = providerRefund.status === 'processed' ? RefundStatus.PROCESSED : RefundStatus.PENDING;
        refToUpdate.processedAt = providerRefund.status === 'processed' ? new Date() : null;
        savedRefund = await updateRunner.manager.save(refToUpdate);
      } else {
        savedRefund = pendingRefund;
      }

      lockedPayment.amountRefunded += refundAmount;
      lockedPayment.status =
        lockedPayment.amountRefunded >= lockedPayment.amount
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
      await updateRunner.manager.save(lockedPayment);

      finalRemainingBalance = lockedPayment.amount - lockedPayment.amountRefunded;

      if (lockedAppt) {
        lockedAppt.paymentStatus = lockedPayment.status;
        if (
          lockedPayment.status === PaymentStatus.REFUNDED &&
          lockedAppt.status !== AppointmentStatus.CANCELLED &&
          lockedAppt.status !== AppointmentStatus.COMPLETED
        ) {
          lockedAppt.status = AppointmentStatus.CANCELLED;
          const todayStr = getTodayIST();
          if (lockedAppt.date === todayStr) {
            await this.queueService.recalculateQueue(lockedAppt.doctorId, lockedAppt.date, updateRunner.manager);
          }
          this.appointmentGateway?.emitAppointmentEvent(SOCKET_EVENTS.CANCELLED, {
            appointmentId: lockedAppt.id,
            patientId: lockedAppt.patientId,
            doctorId: lockedAppt.doctorId,
            status: AppointmentStatus.CANCELLED,
            updatedAt: new Date().toISOString(),
          });
          await this.reminderService?.cancelRemindersForAppointment(lockedAppt.id);
        }
        await updateRunner.manager.save(lockedAppt);
      }

      await updateRunner.commitTransaction();
    } catch (dbErr: any) {
      await updateRunner.rollbackTransaction();
      this.logger.error(
        `CRITICAL: Database update failed after provider refund created [providerRefundId=${providerRefund.id}]: ${dbErr.message}`,
      );
      // Emergency direct write to preserve providerRefundId
      await this.refundRepo.update(pendingRefund.id, {
        providerRefundId: providerRefund.id,
        status: RefundStatus.PROCESSED,
        processedAt: new Date(),
      });
      throw dbErr;
    } finally {
      await updateRunner.release();
    }

    // Send refund email to patient
    if (appointment.patient?.user?.email) {
      await this.emailService.sendRefundInitiated(
        appointment.patient.user.email,
        appointment.patient.fullName,
        appointment.doctor.fullName,
        refundAmount,
        providerRefund.id,
        dto.reason,
      );
    }

    return {
      message: 'Refund initiated successfully',
      data: {
        refundId: savedRefund.id,
        providerRefundId: savedRefund.providerRefundId,
        amount: savedRefund.amount,
        currency: savedRefund.currency,
        status: savedRefund.status,
        remainingBalance: finalRemainingBalance,
      },
    };
  }

  /**
   * Retry payment order for an unexpired pending reservation
   */
  async retryOrder(userId: string, appointmentId: string) {
    const patient = await this.getPatientByUserId(userId);

    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: { doctor: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.patientId !== patient.id) {
      throw new ForbiddenException('Access denied: You do not own this appointment');
    }

    if (appointment.status === AppointmentStatus.CONFIRMED) {
      throw new BadRequestException('Appointment is already confirmed');
    }

    if (appointment.status !== AppointmentStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Appointment is not in pending payment status');
    }

    const now = new Date();
    if (!appointment.pendingExpiresAt || new Date(appointment.pendingExpiresAt) <= now) {
      await this.appointmentRepo.update(appointment.id, {
        status: AppointmentStatus.CANCELLED,
        paymentStatus: 'FAILED',
        pendingExpiresAt: null,
      });
      throw new BadRequestException('Reservation has expired (15-minute window passed). Please select a new slot.');
    }

    // Look for existing pending payment record
    const existingPayment = await this.paymentRepo.findOne({
      where: {
        appointmentId: appointment.id,
        status: PaymentStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });

    if (existingPayment) {
      return {
        orderId: existingPayment.orderId,
        amount: existingPayment.amount,
        currency: existingPayment.currency,
        keyId: this.razorpayService.getPublicKey(),
        appointmentId: appointment.id,
        expiresAt: appointment.pendingExpiresAt,
      };
    }

    // If no existing pending payment, create Razorpay order and payment record
    const doctor = appointment.doctor || (await this.doctorRepo.findOne({ where: { id: appointment.doctorId } }));
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const consultationFeeRupees = Number(doctor.consultationFee);
    const amountInPaise = Math.round(consultationFeeRupees * 100);

    const providerOrder = await this.razorpayService.createOrder({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${appointment.id.replace(/-/g, '').substring(0, 16)}`,
      notes: {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        patientId: patient.id,
      },
    });

    const payment = this.paymentRepo.create({
      appointmentId: appointment.id,
      patientId: patient.id,
      doctorId: appointment.doctorId,
      provider: 'RAZORPAY',
      orderId: providerOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      status: PaymentStatus.PENDING,
    });

    await this.paymentRepo.save(payment);

    return {
      orderId: providerOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      keyId: this.razorpayService.getPublicKey(),
      appointmentId: appointment.id,
      expiresAt: appointment.pendingExpiresAt,
    };
  }

  /**
   * Patient Payment History
   */
  async getPatientPaymentHistory(userId: string) {
    const patient = await this.getPatientByUserId(userId);

    const payments = await this.paymentRepo.find({
      where: { patientId: patient.id },
      relations: {
        appointment: { doctor: true },
        refunds: true,
      },
      order: { createdAt: 'DESC' },
    });

    return {
      message: 'Payment history retrieved successfully',
      data: payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        paymentId: p.paymentId,
        amount: p.amount,
        amountRefunded: p.amountRefunded,
        currency: p.currency,
        status: p.status,
        method: p.method,
        createdAt: p.createdAt,
        appointment: p.appointment
          ? {
              id: p.appointment.id,
              date: p.appointment.date,
              startTime: p.appointment.startTime,
              endTime: p.appointment.endTime,
              status: p.appointment.status,
              pendingExpiresAt: p.appointment.pendingExpiresAt,
              doctor: {
                id: p.appointment.doctor?.id,
                fullName: p.appointment.doctor?.fullName,
                specialization: p.appointment.doctor?.specialization,
              },
            }
          : null,
        refunds: p.refunds?.map((r) => ({
          id: r.id,
          providerRefundId: r.providerRefundId,
          amount: r.amount,
          status: r.status,
          reason: r.reason,
          processedAt: r.processedAt,
          createdAt: r.createdAt,
        })),
      })),
    };
  }

  /**
   * Phase 7: Durable Expiration & Reconciliation of Pending Bookings
   */
  @Cron('*/1 * * * *')
  async reconcileExpiredBookings(): Promise<number> {
    const now = new Date();
    const expiredPending = await this.appointmentRepo.find({
      where: {
        status: AppointmentStatus.PENDING_PAYMENT,
        pendingExpiresAt: LessThanOrEqual(now),
      },
      take: 50,
    });

    let reconciledCount = 0;

    for (const appt of expiredPending) {
      try {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const lockedAppt = await queryRunner.manager.findOne(Appointment, {
            where: { id: appt.id },
            lock: { mode: 'pessimistic_write' },
            loadEagerRelations: false,
          });

          if (!lockedAppt || lockedAppt.status !== AppointmentStatus.PENDING_PAYMENT) {
            await queryRunner.rollbackTransaction();
            continue;
          }

          // Check if associated payment was captured before releasing
          const payment = await queryRunner.manager.findOne(Payment, {
            where: { appointmentId: lockedAppt.id },
          });

          if (payment && payment.paymentId) {
            try {
              const providerPayment = await this.razorpayService.getPayment(payment.paymentId);
              if (providerPayment.status === 'captured') {
                // Payment was actually captured! Recover it.
                await queryRunner.rollbackTransaction();
                await this.handleLatePayment(payment, payment.paymentId, null);
                reconciledCount++;
                continue;
              }
            } catch (pErr) {
              this.logger.warn(`Could not verify provider status for payment ${payment.paymentId}: ${(pErr as any).message}`);
            }
          }

          // Release the slot
          lockedAppt.status = AppointmentStatus.CANCELLED;
          lockedAppt.paymentStatus = 'FAILED';
          lockedAppt.pendingExpiresAt = null;
          await queryRunner.manager.save(lockedAppt);

          if (payment && payment.status === PaymentStatus.PENDING) {
            payment.status = PaymentStatus.FAILED;
            payment.errorDescription = 'Slot reservation expired before payment completed';
            await queryRunner.manager.save(payment);
          }

          await queryRunner.commitTransaction();
          reconciledCount++;
        } catch (txErr) {
          await queryRunner.rollbackTransaction();
          throw txErr;
        } finally {
          await queryRunner.release();
        }
      } catch (err: any) {
        this.logger.error(`Error reconciling expired appointment ${appt.id}: ${err.message}`);
      }
    }

    if (reconciledCount > 0) {
      this.logger.log(`Reconciled ${reconciledCount} expired booking reservations.`);
    }

    return reconciledCount;
  }
}
