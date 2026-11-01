import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Appointment } from '../appointment/entities/appointment.entity';
import { ReminderJob } from './entities/reminder-job.entity';
import { ReminderJobStatus } from './enums/reminder-job-status.enum';
import { ReminderJobType } from './enums/reminder-job-type.enum';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { NotificationDispatcher } from '../notification/notification.dispatcher';
import { NotificationEventType } from '../notification/enums/notification-event-type.enum';
import { formatTime, getTodayIST, getTomorrowIST } from '../common/utils/appointment.utils';

function parseAppointmentDateTimeIST(dateStr: string, timeStr: string): Date {
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

    private readonly notificationDispatcher: NotificationDispatcher,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Schedule durable reminders (24h, 2h, and 30m) for a confirmed appointment
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

      // 2. 2-Hour Reminder
      const time2h = new Date(apptTime.getTime() - 2 * 60 * 60 * 1000);
      if (time2h > now) {
        await this.createOrUpdateReminderJob(
          appointment.id,
          appointment.patientId,
          appointment.doctorId,
          ReminderJobType.REMINDER_2H,
          time2h,
        );
      }

      // 3. 30-Minute Reminder
      const time30m = new Date(apptTime.getTime() - 30 * 60 * 1000);
      if (time30m > now) {
        await this.createOrUpdateReminderJob(
          appointment.id,
          appointment.patientId,
          appointment.doctorId,
          ReminderJobType.REMINDER_30M,
          time30m,
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
   * Invalidate scheduled reminders on appointment cancellation, completion, or reschedule
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
   * Persistent Worker Cron: processes due 24h, 2h, and 30m reminders every minute
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
        const lockedJob = await queryRunner.manager.findOne(ReminderJob, {
          where: { id: job.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedJob || lockedJob.status !== ReminderJobStatus.PENDING) {
          await queryRunner.rollbackTransaction();
          continue;
        }

        lockedJob.status = ReminderJobStatus.PROCESSING;
        lockedJob.attempts += 1;
        await queryRunner.manager.save(lockedJob);
        await queryRunner.commitTransaction();

        // Invariant check: Appointment must still be CONFIRMED
        const appointment = await this.appointmentRepo.findOne({
          where: { id: lockedJob.appointmentId },
          relations: { doctor: { user: true }, patient: { user: true } },
        });

        if (!appointment || appointment.status !== AppointmentStatus.CONFIRMED) {
          lockedJob.status = ReminderJobStatus.CANCELLED;
          await this.reminderJobRepo.save(lockedJob);
          continue;
        }

        const patientUser = appointment.patient?.user;
        const patientName = appointment.patient?.fullName || 'Patient';
        const doctorName = appointment.doctor?.fullName || 'Doctor';

        let eventType = NotificationEventType.APPOINTMENT_REMINDER_24H;
        let leadLabel = 'tomorrow';

        if (lockedJob.type === ReminderJobType.REMINDER_2H || lockedJob.type === ReminderJobType.REMINDER_1H) {
          eventType = NotificationEventType.APPOINTMENT_REMINDER_2H;
          leadLabel = 'in 2 hours';
        } else if (lockedJob.type === ReminderJobType.REMINDER_30M) {
          eventType = NotificationEventType.APPOINTMENT_REMINDER_30M;
          leadLabel = 'in 30 minutes';
        }

        // Dispatch across all 4 channels (Email, In-App, WhatsApp, SMS) via centralized dispatcher
        if (patientUser) {
          await this.notificationDispatcher.dispatch({
            eventType,
            recipients: [
              {
                id: appointment.patientId,
                userId: patientUser.id,
                name: patientName,
                email: patientUser.email,
                phone: appointment.patient?.phone || null,
                role: 'PATIENT',
              },
            ],
            appointmentId: appointment.id,
            data: {
              patientName,
              doctorName,
              specialization: appointment.doctor?.specialization,
              appointmentDate: appointment.date,
              startTime: appointment.startTime,
              tokenNumber: appointment.tokenNumber,
              leadTimeLabel: leadLabel,
              appointmentId: appointment.id,
            },
          });
        }

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
        relations: { doctor: { user: true }, patient: { user: true } },
      });

      for (const appt of appointments) {
        try {
          const patientUser = appt.patient?.user;
          if (patientUser) {
            await this.notificationDispatcher.dispatch({
              eventType: NotificationEventType.APPOINTMENT_REMINDER_2H,
              recipients: [
                {
                  id: appt.patientId,
                  userId: patientUser.id,
                  name: appt.patient.fullName,
                  email: patientUser.email,
                  phone: appt.patient.phone || null,
                  role: 'PATIENT',
                },
              ],
              appointmentId: appt.id,
              data: {
                patientName: appt.patient.fullName,
                doctorName: appt.doctor?.fullName,
                specialization: appt.doctor?.specialization,
                appointmentDate: appt.date,
                startTime: appt.startTime,
                tokenNumber: appt.tokenNumber,
                leadTimeLabel: 'today',
                appointmentId: appt.id,
              },
            });
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
        relations: { doctor: { user: true }, patient: { user: true } },
      });

      for (const appt of appointments) {
        try {
          const patientUser = appt.patient?.user;
          if (patientUser) {
            await this.notificationDispatcher.dispatch({
              eventType: NotificationEventType.APPOINTMENT_REMINDER_24H,
              recipients: [
                {
                  id: appt.patientId,
                  userId: patientUser.id,
                  name: appt.patient.fullName,
                  email: patientUser.email,
                  phone: appt.patient.phone || null,
                  role: 'PATIENT',
                },
              ],
              appointmentId: appt.id,
              data: {
                patientName: appt.patient.fullName,
                doctorName: appt.doctor?.fullName,
                specialization: appt.doctor?.specialization,
                appointmentDate: appt.date,
                startTime: appt.startTime,
                tokenNumber: appt.tokenNumber,
                leadTimeLabel: 'tomorrow',
                appointmentId: appt.id,
              },
            });
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
