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
        throw new ConflictException('This slot is already booked or currently reserved by another patient');
      }

      // 3. Create or reuse reservation appointment with expiry
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

    // Transactional confirmation of appointment & payment
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    let confirmedAppointment: Appointment;

    try {
      const appt = await queryRunner.manager.findOne(Appointment, {
        where: { id: dto.appointmentId },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });

      if (!appt) {
        throw new NotFoundException('Appointment not found');
      }

      // Check for late payment after expiry
      const isExpired = appt.pendingExpiresAt && new Date(appt.pendingExpiresAt) < new Date();
      if (isExpired && appt.status !== AppointmentStatus.PENDING_PAYMENT) {
        // Handle late payment recovery
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        return this.handleLatePayment(payment, dto.paymentId, dto.signature);
      }

      // Assign sequential token
      const tokenNumber = await this.assignTokenNumber(queryRunner.manager, appt.doctorId, appt.date);

      appt.status = AppointmentStatus.CONFIRMED;
      appt.paymentStatus = 'PAID';
      appt.pendingExpiresAt = null;
      appt.tokenNumber = tokenNumber;

      confirmedAppointment = await queryRunner.manager.save(appt);

      // Update payment record
      payment.status = PaymentStatus.COMPLETED;
      payment.paymentId = dto.paymentId;
      payment.signature = dto.signature;
      await queryRunner.manager.save(payment);

      // Recalculate queue if appointment is today
      const todayStr = getTodayIST();
      if (confirmedAppointment.date === todayStr) {
        await this.queueService.recalculateQueue(
          confirmedAppointment.doctorId,
          confirmedAppointment.date,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Post-commit side effects: emails, notifications, reminders, sockets
    await this.triggerPostConfirmationSideEffects(confirmedAppointment, payment, patient);

    return {
      success: true,
      message: 'Payment verified and appointment confirmed successfully',
      appointmentId: confirmedAppointment.id,
      paymentId: payment.paymentId,
      tokenNumber: confirmedAppointment.tokenNumber,
    };
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

    const appt = await this.appointmentRepo.findOne({
      where: { id: payment.appointmentId },
      relations: { doctor: true, patient: { user: true } },
    });

    if (!appt) return;

    // Check if appointment reservation expired
    const isExpired = appt.pendingExpiresAt && new Date(appt.pendingExpiresAt) < new Date();
    if (isExpired && appt.status !== AppointmentStatus.PENDING_PAYMENT) {
      await this.handleLatePayment(payment, paymentId, null);
      return;
    }

    // Confirm booking
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedAppt: Appointment;
    try {
      const token = await this.assignTokenNumber(queryRunner.manager, appt.doctorId, appt.date);
      appt.status = AppointmentStatus.CONFIRMED;
      appt.paymentStatus = 'PAID';
      appt.pendingExpiresAt = null;
      appt.tokenNumber = token;
      savedAppt = await queryRunner.manager.save(appt);

      payment.status = PaymentStatus.COMPLETED;
      payment.paymentId = paymentId;
      payment.method = entity.method || null;
      await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    await this.triggerPostConfirmationSideEffects(savedAppt, payment, payment.patient);
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
   * Phase 6: Late-Payment Recovery Strategy
   */
  private async handleLatePayment(
    payment: Payment,
    paymentId: string,
    signature: string | null,
  ): Promise<any> {
    this.logger.warn(`Late payment received for expired reservation ${payment.appointmentId}`);

    const appt = await this.appointmentRepo.findOne({
      where: { id: payment.appointmentId },
      relations: { doctor: true, patient: { user: true } },
    });

    if (!appt) throw new NotFoundException('Appointment not found for late payment');

    // Check if slot is still free
    const isSlotAvailable = await this.isSlotAvailable(appt.doctorId, appt.date, appt.startTime, appt.endTime);

    if (isSlotAvailable) {
      // Slot is still free: re-confirm the appointment safely!
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction('SERIALIZABLE');

      try {
        const token = await this.assignTokenNumber(queryRunner.manager, appt.doctorId, appt.date);
        appt.status = AppointmentStatus.CONFIRMED;
        appt.paymentStatus = 'PAID';
        appt.pendingExpiresAt = null;
        appt.tokenNumber = token;
        await queryRunner.manager.save(appt);

        payment.status = PaymentStatus.COMPLETED;
        payment.paymentId = paymentId;
        if (signature) payment.signature = signature;
        await queryRunner.manager.save(payment);

        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }

      await this.triggerPostConfirmationSideEffects(appt, payment, appt.patient);

      return {
        success: true,
        message: 'Late payment accepted and appointment confirmed.',
        appointmentId: appt.id,
      };
    } else {
      // Slot was already taken by someone else: initiate automatic 100% refund!
      this.logger.warn(`Slot already taken. Initiating automatic 100% refund for payment ${paymentId}`);
      payment.status = PaymentStatus.COMPLETED;
      payment.paymentId = paymentId;
      await this.paymentRepo.save(payment);

      const refundResult = await this.razorpayService.createRefund({
        paymentId,
        amount: payment.amount,
        notes: { reason: 'Slot expired and already booked by another patient' },
      });

      const refund = this.refundRepo.create({
        paymentId: payment.id,
        appointmentId: appt.id,
        patientId: payment.patientId,
        providerRefundId: refundResult.id,
        amount: payment.amount,
        currency: 'INR',
        status: RefundStatus.PROCESSED,
        reason: 'Late payment - slot was taken by another patient',
        processedAt: new Date(),
      });
      await this.refundRepo.save(refund);

      payment.amountRefunded = payment.amount;
      payment.status = PaymentStatus.REFUNDED;
      await this.paymentRepo.save(payment);

      if (appt.patient?.user?.email) {
        await this.emailService.sendRefundInitiated(
          appt.patient.user.email,
          appt.patient.fullName,
          appt.doctor.fullName,
          payment.amount,
          refundResult.id,
          'Reservation expired and the slot was taken. Full refund initiated.',
        );
      }

      return {
        success: false,
        message: 'Reservation expired and slot was taken. A full refund has been automatically initiated.',
        refundId: refundResult.id,
      };
    }
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

    // Call Provider to initiate refund
    const providerRefund = await this.razorpayService.createRefund({
      paymentId: payment.paymentId,
      amount: refundAmount,
      notes: {
        appointmentId: appointment.id,
        reason: dto.reason || 'Patient/Doctor requested refund',
      },
    });

    // Save Refund record
    const refund = this.refundRepo.create({
      paymentId: payment.id,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      providerRefundId: providerRefund.id,
      amount: refundAmount,
      currency: 'INR',
      status: providerRefund.status === 'processed' ? RefundStatus.PROCESSED : RefundStatus.PENDING,
      reason: dto.reason || 'Consultation cancellation refund',
      idempotencyKey: dto.idempotencyKey || null,
      processedAt: providerRefund.status === 'processed' ? new Date() : null,
    });

    const savedRefund = await this.refundRepo.save(refund);

    // Update payment cumulative amounts and status
    payment.amountRefunded += refundAmount;
    payment.status =
      payment.amountRefunded >= payment.amount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;
    await this.paymentRepo.save(payment);

    // Update appointment paymentStatus
    appointment.paymentStatus = payment.status;
    await this.appointmentRepo.save(appointment);

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
        remainingBalance: payment.amount - payment.amountRefunded,
      },
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
