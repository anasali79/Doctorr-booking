import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Appointment } from '../appointment/entities/appointment.entity';
import { ReminderJob } from './entities/reminder-job.entity';
import { ReminderJobStatus } from './enums/reminder-job-status.enum';
import { ReminderJobType } from './enums/reminder-job-type.enum';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/enums/notification-type.enum';
import { EmailService } from '../email/email.service';
import { formatTime, getTodayIST, getTomorrowIST } from '../common/utils/appointment.utils';

function parseAppointmentDateTimeIST(dateStr: string, timeStr: string): Date {
  // Appointment date is in IST (+05:30)
  return new Date(`${dateStr}T${timeStr}:00+05:30`);
}

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,

    @InjectRepository(ReminderJob)
    private readonly reminderJobRepo: Repository<ReminderJob>,

    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Schedule durable 24-hour and 1-hour reminders for a confirmed appointment
   */
  async scheduleAppointmentReminders(appointment: Appointment): Promise<void> {
    try {
      const apptTime = parseAppointmentDateTimeIST(appointment.date, appointment.startTime);
      const now = new Date();

      // 1. 24-Hour Reminder
      const time24h = new Date(apptTime.getTime() - 24 * 60 * 60 * 1000);
      if (time24h > now) {
        await this.createOrUpdateReminderJob(
          appointment.id,
          appointment.patientId,
          appointment.doctorId,
          ReminderJobType.REMINDER_24H,
          time24h,
        );
      }

      // 2. 1-Hour Reminder
      const time1h = new Date(apptTime.getTime() - 1 * 60 * 60 * 1000);
      if (time1h > now) {
        await this.createOrUpdateReminderJob(
          appointment.id,
          appointment.patientId,
          appointment.doctorId,
          ReminderJobType.REMINDER_1H,
          time1h,
        );
      }
    } catch (err: any) {
      this.logger.error(`Failed to schedule reminders for appointment ${appointment.id}: ${err.message}`);
    }
  }

  private async createOrUpdateReminderJob(
    appointmentId: string,
    patientId: string,
    doctorId: string,
    type: ReminderJobType,
    targetTime: Date,
  ): Promise<void> {
    const dedupKey = `${appointmentId}_${type}`;
    const existing = await this.reminderJobRepo.findOne({ where: { dedupKey } });

    if (existing) {
      if (existing.status === ReminderJobStatus.PENDING) {
        existing.targetTime = targetTime;
        await this.reminderJobRepo.save(existing);
      }
      return;
    }

    const job = this.reminderJobRepo.create({
      appointmentId,
      patientId,
      doctorId,
      type,
      targetTime,
      dedupKey,
      status: ReminderJobStatus.PENDING,
      attempts: 0,
      maxAttempts: 3,
    });

    await this.reminderJobRepo.save(job);
    this.logger.log(`Scheduled ${type} reminder for appointment ${appointmentId} at ${targetTime.toISOString()}`);
  }

  /**
   * Invalidate scheduled reminders on appointment cancellation or completion
   */
  async cancelRemindersForAppointment(appointmentId: string): Promise<void> {
    try {
      await this.reminderJobRepo.update(
        { appointmentId, status: ReminderJobStatus.PENDING },
        { status: ReminderJobStatus.CANCELLED },
      );
      this.logger.log(`Cancelled pending reminder jobs for appointment ${appointmentId}`);
    } catch (err: any) {
      this.logger.error(`Failed to cancel reminders for appointment ${appointmentId}: ${err.message}`);
    }
  }

  /**
   * Reschedule reminders when an appointment date or time is modified
   */
  async rescheduleReminders(appointment: Appointment): Promise<void> {
    await this.cancelRemindersForAppointment(appointment.id);
    await this.scheduleAppointmentReminders(appointment);
  }

  /**
   * Persistent Worker Cron: processes due 24h/1h reminders every minute
   * Prevents duplicates across multiple workers using atomic DB row locking
   */
  @Cron('*/1 * * * *')
  async processDueReminders(): Promise<void> {
    const now = new Date();

    const dueJobs = await this.reminderJobRepo.find({
      where: {
        status: ReminderJobStatus.PENDING,
        targetTime: LessThanOrEqual(now),
      },
      take: 50,
    });

    if (dueJobs.length === 0) return;

    for (const job of dueJobs) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Atomic lock on the reminder job record to prevent duplicate worker execution
        const lockedJob = await queryRunner.manager.findOne(ReminderJob, {
          where: { id: job.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedJob || lockedJob.status !== ReminderJobStatus.PENDING) {
          await queryRunner.rollbackTransaction();
          continue;
        }

        // Atomically claim the job
        lockedJob.status = ReminderJobStatus.PROCESSING;
        lockedJob.attempts += 1;
        await queryRunner.manager.save(lockedJob);
        await queryRunner.commitTransaction();

        // Immediate pre-send invariant check: Appointment must still be CONFIRMED
        const appointment = await this.appointmentRepo.findOne({
          where: { id: lockedJob.appointmentId },
          relations: { doctor: true, patient: { user: true } },
        });

        if (!appointment || appointment.status !== AppointmentStatus.CONFIRMED) {
          lockedJob.status = ReminderJobStatus.CANCELLED;
          await this.reminderJobRepo.save(lockedJob);
          continue;
        }

        const patientEmail = appointment.patient?.user?.email;
        const patientName = appointment.patient?.fullName || 'Patient';
        const doctorName = appointment.doctor?.fullName || 'Doctor';
        const leadLabel = lockedJob.type === ReminderJobType.REMINDER_24H ? 'tomorrow' : 'in 1 hour';

        if (patientEmail) {
          await this.emailService.sendAppointmentReminder(
            patientEmail,
            patientName,
            doctorName,
            appointment.date,
            appointment.startTime,
            appointment.tokenNumber,
            leadLabel,
          );
        }

        const notifMsg = `Reminder: Your appointment with Dr. ${doctorName} is ${leadLabel} at ${formatTime(appointment.startTime)}.`;
        await this.notificationService.createNotification(
          appointment.patientId,
          'Appointment Reminder',
          notifMsg,
          NotificationType.APPOINTMENT_REMINDER,
          appointment.tokenNumber ? `Token #${appointment.tokenNumber}` : null,
        );

        lockedJob.status = ReminderJobStatus.SENT;
        lockedJob.sentAt = new Date();
        await this.reminderJobRepo.save(lockedJob);
      } catch (err: any) {
        this.logger.error(`Failed to process reminder job ${job.id}: ${err.message}`, err.stack);

        const failedJob = await this.reminderJobRepo.findOne({ where: { id: job.id } });
        if (failedJob) {
          failedJob.lastError = err.message;
          failedJob.status =
            failedJob.attempts >= failedJob.maxAttempts
              ? ReminderJobStatus.FAILED
              : ReminderJobStatus.PENDING;
          await this.reminderJobRepo.save(failedJob);
        }
      } finally {
        await queryRunner.release();
      }
    }
  }

  /**
   * Daily 6 AM Sweep
   */
  @Cron('0 6 * * *', { timeZone: 'Asia/Kolkata' })
  async sendMorningReminders(): Promise<void> {
    try {
      const todayStr = getTodayIST();
      const appointments = await this.appointmentRepo.find({
        where: {
          date: todayStr,
          status: AppointmentStatus.CONFIRMED,
          reminderSent: false,
        },
        relations: { doctor: true, patient: { user: true } },
      });

      for (const appt of appointments) {
        try {
          const patientEmail = appt.patient?.user?.email;
          const patientName = appt.patient?.fullName || 'Patient';
          const doctorName = appt.doctor?.fullName || 'Doctor';

          if (patientEmail) {
            await this.emailService.sendAppointmentReminder(
              patientEmail,
              patientName,
              doctorName,
              appt.date,
              appt.startTime,
              appt.tokenNumber,
              'today',
            );
          }

          appt.reminderSent = true;
          await this.appointmentRepo.save(appt);
        } catch (err: any) {
          this.logger.error(`[Cron 6AM] Failed for appt ${appt.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`[Cron 6AM] Job error: ${err.message}`);
    }
  }

  /**
   * Daily 6 PM Sweep
   */
  @Cron('0 18 * * *', { timeZone: 'Asia/Kolkata' })
  async sendEveningReminders(): Promise<void> {
    try {
      const tomorrowStr = getTomorrowIST();
      const appointments = await this.appointmentRepo.find({
        where: {
          date: tomorrowStr,
          status: AppointmentStatus.CONFIRMED,
          reminderSent: false,
        },
        relations: { doctor: true, patient: { user: true } },
      });

      for (const appt of appointments) {
        try {
          const patientEmail = appt.patient?.user?.email;
          const patientName = appt.patient?.fullName || 'Patient';
          const doctorName = appt.doctor?.fullName || 'Doctor';

          if (patientEmail) {
            await this.emailService.sendAppointmentReminder(
              patientEmail,
              patientName,
              doctorName,
              appt.date,
              appt.startTime,
              appt.tokenNumber,
              'tomorrow',
            );
          }

          appt.reminderSent = true;
          await this.appointmentRepo.save(appt);
        } catch (err: any) {
          this.logger.error(`[Cron 6PM] Failed for appt ${appt.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`[Cron 6PM] Job error: ${err.message}`);
    }
  }
}
