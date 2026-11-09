 import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, MoreThan, Not } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import { Doctor } from './entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { RecurringAvailability, DayOfWeek } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { DoctorLeave } from './entities/leave.entity';
import { AppointmentRescheduleRequest } from '../appointment/entities/appointment-reschedule-request.entity';

import {
  ExpandScheduleDto,
  CheckShrinkConflictDto,
  ApplyShrinkDto,
  SmartReschedulePreviewDto,
  ApproveSmartRescheduleDto,
  ManualRescheduleDto,
  PatientRespondRescheduleDto,
  PatientChooseAlternativeDto,
  PatientCancelRescheduleDto,
  ShiftType,
} from './dto/elastic-scheduling.dto';

import { RescheduleMethod } from '../appointment/enums/reschedule-method.enum';
import { RescheduleRequestStatus } from '../appointment/enums/reschedule-request-status.enum';
import { SchedulingType } from '../common/enums/scheduling-type.enum';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { NotificationType } from '../notification/enums/notification-type.enum';
import { NotificationEventType } from '../notification/enums/notification-event-type.enum';

import { AvailabilityService } from './availability.service';
import { QueueService } from '../appointment/queue.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationDispatcher } from '../notification/notification.dispatcher';
import { PaymentService } from '../payment/payment.service';
import { ReminderService } from '../reminder/reminder.service';
import { AppointmentGateway, SOCKET_EVENTS } from '../sockets/appointment.gateway';
import { getTodayIST, formatDate, formatTime } from '../common/utils/appointment.utils';

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function toTimeString(minutes: number): string {
  const positive = Math.max(0, minutes);
  const h = Math.floor(positive / 60);
  const m = positive % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return toMinutes(s1) < toMinutes(e2) && toMinutes(s2) < toMinutes(e1);
}

function getDayOfWeekFromDate(dateStr: string): DayOfWeek {
  const date = new Date(dateStr + 'T00:00:00');
  const jsDay = date.getDay();
  const map: Record<number, DayOfWeek> = {
    0: DayOfWeek.SUNDAY,
    1: DayOfWeek.MONDAY,
    2: DayOfWeek.TUESDAY,
    3: DayOfWeek.WEDNESDAY,
    4: DayOfWeek.THURSDAY,
    5: DayOfWeek.FRIDAY,
    6: DayOfWeek.SATURDAY,
  };
  return map[jsDay];
}

@Injectable()
export class ElasticSchedulingService {
  private readonly logger = new Logger(ElasticSchedulingService.name);

  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,

    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,

    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,

    @InjectRepository(RecurringAvailability)
    private readonly recurringRepo: Repository<RecurringAvailability>,

    @InjectRepository(CustomAvailability)
    private readonly customRepo: Repository<CustomAvailability>,

    @InjectRepository(DoctorLeave)
    private readonly leaveRepo: Repository<DoctorLeave>,

    @InjectRepository(AppointmentRescheduleRequest)
    private readonly rescheduleRequestRepo: Repository<AppointmentRescheduleRequest>,

    private readonly dataSource: DataSource,
    private readonly availabilityService: AvailabilityService,
    private readonly queueService: QueueService,
    private readonly notificationService: NotificationService,

    @Optional()
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService?: PaymentService,

    @Optional()
    @Inject(forwardRef(() => ReminderService))
    private readonly reminderService?: ReminderService,

    @Optional()
    private readonly notificationDispatcher?: NotificationDispatcher,

    @Optional()
    private readonly appointmentGateway?: AppointmentGateway,
  ) {}

  private async findDoctorByUserId(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { userId } });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found. Please create your profile first.');
    }
    return doctor;
  }

  private async findPatientByUserId(userId: string): Promise<Patient> {
    const patient = await this.patientRepo.findOne({
      where: { userId },
      relations: { user: true },
    });
    if (!patient) {
      throw new NotFoundException('Patient profile not found. Please create your profile first.');
    }
    return patient;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PHASE 1: ELASTIC SCHEDULE EXPANSION
  // ───────────────────────────────────────────────────────────────────────────
  async expandSchedule(userId: string, dto: ExpandScheduleDto) {
    const doctor = await this.findDoctorByUserId(userId);
    const newStartMins = toMinutes(dto.newStartTime);
    const newEndMins = toMinutes(dto.newEndTime);

    if (newStartMins >= newEndMins) {
      throw new BadRequestException('newEndTime must be later than newStartTime');
    }

    if (dto.shiftType === ShiftType.RECURRING) {
      const shift = await this.recurringRepo.findOne({
        where: { id: dto.shiftId, doctorId: doctor.id },
      });
      if (!shift) {
        throw new NotFoundException(`Recurring shift with ID ${dto.shiftId} not found`);
      }

      const oldStartMins = toMinutes(shift.startTime);
      const oldEndMins = toMinutes(shift.endTime);

      const isExpandedStart = newStartMins < oldStartMins;
      const isExpandedEnd = newEndMins > oldEndMins;

      if (!isExpandedStart && !isExpandedEnd) {
        throw new BadRequestException(
          'New time range must extend the existing shift boundaries (earlier start or later end)',
        );
      }

      if (newStartMins > oldStartMins || newEndMins < oldEndMins) {
        throw new BadRequestException(
          'Elastic expansion cannot shrink existing boundaries. Use schedule shrinking instead.',
        );
      }

      // Check overlap with other recurring shifts on same day of week
      const otherShifts = await this.recurringRepo
        .createQueryBuilder('ra')
        .where('ra.doctorId = :doctorId', { doctorId: doctor.id })
        .andWhere('ra.dayOfWeek = :day', { day: shift.dayOfWeek })
        .andWhere('ra.id != :id', { id: shift.id })
        .getMany();

      for (const other of otherShifts) {
        if (timesOverlap(dto.newStartTime, dto.newEndTime, other.startTime, other.endTime)) {
          throw new ConflictException(
            `Expanded hours (${dto.newStartTime}–${dto.newEndTime}) overlap with existing shift (${other.startTime}–${other.endTime}) on ${shift.dayOfWeek}`,
          );
        }
      }

      // Calculate deltas
      const startDelta = isExpandedStart
        ? { start: dto.newStartTime, end: shift.startTime }
        : null;
      const endDelta = isExpandedEnd
        ? { start: shift.endTime, end: dto.newEndTime }
        : null;

      const dur = shift.slotDuration || (shift.schedulingType === SchedulingType.WAVE ? 30 : 15);
      const buffer = shift.bufferTime || 0;

      let newSlotsGenerated = 0;
      if (shift.schedulingType === SchedulingType.WAVE) {
        if (startDelta) {
          const deltaMins = toMinutes(startDelta.end) - toMinutes(startDelta.start);
          newSlotsGenerated += Math.floor(deltaMins / (dur + buffer));
        }
        if (endDelta) {
          const deltaMins = toMinutes(endDelta.end) - toMinutes(endDelta.start);
          newSlotsGenerated += Math.floor(deltaMins / (dur + buffer));
        }
      } else {
        newSlotsGenerated = 1; // Stream window expanded
      }

      shift.startTime = dto.newStartTime;
      shift.endTime = dto.newEndTime;
      const saved = await this.recurringRepo.save(shift);

      // Dispatch doctor notification
      try {
        await this.notificationService.createDoctorNotification(
          doctor.id,
          'Schedule Expanded',
          `Your ${shift.dayOfWeek} shift was expanded to ${dto.newStartTime}–${dto.newEndTime}. Existing bookings preserved.`,
          NotificationType.SCHEDULE_UPDATE,
        );
      } catch (err: any) {
        this.logger.warn(`Failed to dispatch doctor notification: ${err.message}`);
      }

      return {
        message: 'Shift expanded successfully. Existing slots and confirmed appointments preserved.',
        shift: saved,
        expansion: {
          startDelta,
          endDelta,
          newSlotsGenerated,
          existingPreserved: true,
        },
      };
    } else {
      // CUSTOM override shift
      const shift = await this.customRepo.findOne({
        where: { id: dto.shiftId, doctorId: doctor.id },
      });
      if (!shift) {
        throw new NotFoundException(`Custom shift override with ID ${dto.shiftId} not found`);
      }

      const oldStartMins = toMinutes(shift.startTime);
      const oldEndMins = toMinutes(shift.endTime);

      const isExpandedStart = newStartMins < oldStartMins;
      const isExpandedEnd = newEndMins > oldEndMins;

      if (!isExpandedStart && !isExpandedEnd) {
        throw new BadRequestException(
          'New time range must extend the existing shift boundaries (earlier start or later end)',
        );
      }

      if (newStartMins > oldStartMins || newEndMins < oldEndMins) {
        throw new BadRequestException(
          'Elastic expansion cannot shrink existing boundaries. Use schedule shrinking instead.',
        );
      }

      // Check overlap with other custom shifts on the same date
      const otherShifts = await this.customRepo
        .createQueryBuilder('ca')
        .where('ca.doctorId = :doctorId', { doctorId: doctor.id })
        .andWhere('ca.date = :date', { date: shift.date })
        .andWhere('ca.id != :id', { id: shift.id })
        .getMany();

      for (const other of otherShifts) {
        if (timesOverlap(dto.newStartTime, dto.newEndTime, other.startTime, other.endTime)) {
          throw new ConflictException(
            `Expanded hours (${dto.newStartTime}–${dto.newEndTime}) overlap with existing custom shift on ${shift.date}`,
          );
        }
      }

      const startDelta = isExpandedStart
        ? { start: dto.newStartTime, end: shift.startTime }
        : null;
      const endDelta = isExpandedEnd
        ? { start: shift.endTime, end: dto.newEndTime }
        : null;

      shift.startTime = dto.newStartTime;
      shift.endTime = dto.newEndTime;
      const saved = await this.customRepo.save(shift);

      try {
        await this.notificationService.createDoctorNotification(
          doctor.id,
          'Custom Shift Expanded',
          `Your shift on ${shift.date} was expanded to ${dto.newStartTime}–${dto.newEndTime}.`,
          NotificationType.SCHEDULE_UPDATE,
        );
      } catch (err: any) {
        this.logger.warn(`Failed to dispatch doctor notification: ${err.message}`);
      }

      return {
        message: 'Custom shift expanded successfully. Existing slots and confirmed appointments preserved.',
        shift: saved,
        expansion: {
          startDelta,
          endDelta,
          existingPreserved: true,
        },
      };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PHASE 2: ELASTIC SCHEDULE SHRINKING & CONFLICT DETECTION
  // ───────────────────────────────────────────────────────────────────────────
  async checkShrinkConflicts(userId: string, dto: CheckShrinkConflictDto) {
    const doctor = await this.findDoctorByUserId(userId);
    const newStartMins = toMinutes(dto.newStartTime);
    const newEndMins = toMinutes(dto.newEndTime);

    if (newStartMins >= newEndMins) {
      throw new BadRequestException('newEndTime must be later than newStartTime');
    }

    let oldStartTime: string;
    let oldEndTime: string;
    let targetDayOfWeek: DayOfWeek | null = null;
    let targetDate: string | null = null;

    if (dto.shiftType === ShiftType.RECURRING) {
      const shift = await this.recurringRepo.findOne({
        where: { id: dto.shiftId, doctorId: doctor.id },
      });
      if (!shift) {
        throw new NotFoundException(`Recurring shift with ID ${dto.shiftId} not found`);
      }
      oldStartTime = shift.startTime;
      oldEndTime = shift.endTime;
      targetDayOfWeek = shift.dayOfWeek;
    } else {
      const shift = await this.customRepo.findOne({
        where: { id: dto.shiftId, doctorId: doctor.id },
      });
      if (!shift) {
        throw new NotFoundException(`Custom shift with ID ${dto.shiftId} not found`);
      }
      oldStartTime = shift.startTime;
      oldEndTime = shift.endTime;
      targetDate = typeof shift.date === 'string'
        ? shift.date.split('T')[0]
        : (shift.date as any) instanceof Date
          ? (shift.date as any).toISOString().split('T')[0]
          : String(shift.date);
    }

    const oldStartMins = toMinutes(oldStartTime);
    const oldEndMins = toMinutes(oldEndTime);

    const isShrunkStart = newStartMins > oldStartMins;
    const isShrunkEnd = newEndMins < oldEndMins;
    const isExpandedStart = newStartMins < oldStartMins;
    const isExpandedEnd = newEndMins > oldEndMins;

    if (!isShrunkStart && !isShrunkEnd && !isExpandedStart && !isExpandedEnd) {
      throw new BadRequestException('No schedule change detected');
    }

    // Overlap validation: If expanding either boundary, verify no overlap with other shifts on the same day
    if (isExpandedStart || isExpandedEnd) {
      if (dto.shiftType === ShiftType.RECURRING && targetDayOfWeek) {
        const otherShifts = await this.recurringRepo
          .createQueryBuilder('ra')
          .where('ra.doctorId = :doctorId', { doctorId: doctor.id })
          .andWhere('ra.dayOfWeek = :day', { day: targetDayOfWeek })
          .andWhere('ra.id != :id', { id: dto.shiftId })
          .getMany();

        for (const other of otherShifts) {
          if (timesOverlap(dto.newStartTime, dto.newEndTime, other.startTime, other.endTime)) {
            throw new ConflictException(
              `Updated hours (${dto.newStartTime}–${dto.newEndTime}) overlap with existing shift (${other.startTime}–${other.endTime}) on ${targetDayOfWeek}`,
            );
          }
        }
      } else if (dto.shiftType === ShiftType.CUSTOM && targetDate) {
        const otherShifts = await this.customRepo
          .createQueryBuilder('ca')
          .where('ca.doctorId = :doctorId', { doctorId: doctor.id })
          .andWhere('ca.date = :date', { date: targetDate })
          .andWhere('ca.id != :id', { id: dto.shiftId })
          .getMany();

        for (const other of otherShifts) {
          if (timesOverlap(dto.newStartTime, dto.newEndTime, other.startTime, other.endTime)) {
            throw new ConflictException(
              `Updated hours (${dto.newStartTime}–${dto.newEndTime}) overlap with existing custom shift on ${targetDate}`,
            );
          }
        }
      }
    }

    // Identify clipped (removed) intervals
    const clippedIntervals: Array<{ start: string; end: string }> = [];
    if (isShrunkStart) {
      clippedIntervals.push({ start: oldStartTime, end: dto.newStartTime });
    }
    if (isShrunkEnd) {
      clippedIntervals.push({ start: dto.newEndTime, end: oldEndTime });
    }

    // Identify expanded (newly added) intervals
    const expandedIntervals: Array<{ start: string; end: string }> = [];
    if (isExpandedStart) {
      expandedIntervals.push({ start: dto.newStartTime, end: oldStartTime });
    }
    if (isExpandedEnd) {
      expandedIntervals.push({ start: oldEndTime, end: dto.newEndTime });
    }

    const isCombined = (isShrunkStart || isShrunkEnd) && (isExpandedStart || isExpandedEnd);
    const operation = isCombined ? 'COMBINED' : (isShrunkStart || isShrunkEnd ? 'SHRINK' : 'EXPANSION');

    const todayStr = getTodayIST();
    let conflictingAppointments: Appointment[] = [];

    if (dto.shiftType === ShiftType.CUSTOM && targetDate) {
      // Custom shift: appointments on this specific date
      const apptsOnDate = await this.appointmentRepo.find({
        where: {
          doctorId: doctor.id,
          date: targetDate,
          status: In([AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN]),
        },
        relations: { patient: true },
      });

      conflictingAppointments = apptsOnDate.filter((app) =>
        clippedIntervals.some((clip) => timesOverlap(app.startTime, app.endTime, clip.start, clip.end)),
      );
    } else if (dto.shiftType === ShiftType.RECURRING && targetDayOfWeek) {
      // Recurring shift: scan upcoming dates for this dayOfWeek for the next 30 days
      const [startYear, startMonth, startDay] = todayStr.split('-').map(Number);
      const datesToScan: string[] = [];

      // Check dates in the next 30 days matching targetDayOfWeek
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.UTC(startYear, startMonth - 1, startDay + i));
        const dateStr = d.toISOString().split('T')[0];
        if (getDayOfWeekFromDate(dateStr) === targetDayOfWeek) {
          datesToScan.push(dateStr);
        }
      }

      if (datesToScan.length > 0) {
        // Exclude dates that have custom overrides (because custom overrides supersede recurring availability)
        const customOverrides = await this.customRepo
          .createQueryBuilder('ca')
          .where('ca.doctorId = :doctorId', { doctorId: doctor.id })
          .andWhere('ca.date IN (:...dates)', { dates: datesToScan })
          .getMany();

        const customDatesSet = new Set(
          customOverrides.map((c) =>
            typeof c.date === 'string'
              ? c.date.split('T')[0]
              : (c.date as any) instanceof Date
                ? (c.date as any).toISOString().split('T')[0]
                : String(c.date),
          ),
        );

        const activeRecurringDates = datesToScan.filter((d) => !customDatesSet.has(d));

        if (activeRecurringDates.length > 0) {
          const apptsOnDates = await this.appointmentRepo.find({
            where: {
              doctorId: doctor.id,
              date: In(activeRecurringDates),
              status: In([AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN]),
            },
            relations: { patient: true },
          });

          conflictingAppointments = apptsOnDates.filter((app) =>
            clippedIntervals.some((clip) => timesOverlap(app.startTime, app.endTime, clip.start, clip.end)),
          );
        }
      }
    }

    const affectedAppointments = conflictingAppointments.map((app) => ({
      appointmentId: app.id,
      doctorId: app.doctorId,
      patientId: app.patientId,
      patientName: app.patient?.fullName || 'Patient',
      patientPhone: app.patient?.phone || '',
      date: app.date,
      startTime: app.startTime,
      endTime: app.endTime,
      tokenNumber: app.tokenNumber ?? null,
      schedulingType: app.tokenNumber !== null ? 'WAVE' : 'STREAM',
      paymentStatus: app.paymentStatus || 'UNPAID',
      reasonForVisit: app.reasonForVisit ?? null,
    }));

    return {
      hasConflicts: affectedAppointments.length > 0,
      conflictCount: affectedAppointments.length,
      clippedIntervals,
      expandedIntervals,
      operation,
      affectedAppointments,
    };
  }

  async applyShrink(userId: string, dto: ApplyShrinkDto) {
    const doctor = await this.findDoctorByUserId(userId);
    const conflicts = await this.checkShrinkConflicts(userId, dto);

    if (conflicts.hasConflicts && !dto.forceIfNoConflicts) {
      throw new ConflictException({
        message: 'Schedule Conflict Detected! Your updated availability affects existing appointments.',
        conflictCount: conflicts.conflictCount,
        affectedAppointments: conflicts.affectedAppointments,
        clippedIntervals: conflicts.clippedIntervals,
        expandedIntervals: conflicts.expandedIntervals,
        operation: conflicts.operation,
      });
    }

    if (dto.shiftType === ShiftType.RECURRING) {
      const shift = await this.recurringRepo.findOne({
        where: { id: dto.shiftId, doctorId: doctor.id },
      });
      if (!shift) throw new NotFoundException('Shift not found');
      shift.startTime = dto.newStartTime;
      shift.endTime = dto.newEndTime;
      const saved = await this.recurringRepo.save(shift);

      try {
        const notifTitle =
          conflicts.operation === 'COMBINED'
            ? 'Schedule Hours Adjusted'
            : conflicts.operation === 'EXPANSION'
            ? 'Schedule Expanded'
            : 'Schedule Reduction Completed';
        const notifMsg = `Your ${shift.dayOfWeek} shift was updated to ${dto.newStartTime}–${dto.newEndTime}.`;
        await this.notificationService.createDoctorNotification(
          doctor.id,
          notifTitle,
          notifMsg,
          NotificationType.SCHEDULE_UPDATE,
        );
      } catch (err: any) {
        this.logger.warn(`Failed to dispatch notification: ${err.message}`);
      }

      return {
        message:
          conflicts.operation === 'COMBINED'
            ? 'Combined schedule adjustment completed successfully with zero conflicts.'
            : conflicts.operation === 'EXPANSION'
            ? 'Schedule expansion completed successfully.'
            : 'Schedule shrinking completed successfully with zero conflicts.',
        shift: saved,
        operation: conflicts.operation,
        expandedIntervals: conflicts.expandedIntervals,
        clippedIntervals: conflicts.clippedIntervals,
      };
    } else {
      const shift = await this.customRepo.findOne({
        where: { id: dto.shiftId, doctorId: doctor.id },
      });
      if (!shift) throw new NotFoundException('Custom shift not found');
      shift.startTime = dto.newStartTime;
      shift.endTime = dto.newEndTime;
      const saved = await this.customRepo.save(shift);

      return {
        message:
          conflicts.operation === 'COMBINED'
            ? 'Custom shift combined adjustment completed successfully with zero conflicts.'
            : conflicts.operation === 'EXPANSION'
            ? 'Custom shift expansion completed successfully.'
            : 'Custom shift shrinking completed successfully with zero conflicts.',
        shift: saved,
        operation: conflicts.operation,
        expandedIntervals: conflicts.expandedIntervals,
        clippedIntervals: conflicts.clippedIntervals,
      };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PHASE 4: SMART RESCHEDULING ALGORITHM & PREVIEW
  // ───────────────────────────────────────────────────────────────────────────
  async smartReschedulePreview(userId: string, dto: SmartReschedulePreviewDto) {
    const doctor = await this.findDoctorByUserId(userId);

    const appointments = await this.appointmentRepo.find({
      where: {
        id: In(dto.appointmentIds),
        doctorId: doctor.id,
        status: In([AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN]),
      },
      relations: { patient: { user: true } },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) {
      throw new NotFoundException('No confirmed appointments found to reschedule');
    }

    // In-memory batch allocation tracker to prevent collisions among affected appointments
    const batchWaveCounts: Record<string, number> = {}; // key: `date_start_end` -> count
    const batchStreamAllocations: Array<{ date: string; startMin: number; endMin: number }> = [];

    const proposals: Array<{
      appointmentId: string;
      doctorId?: string;
      patientId: string;
      patientName: string;
      originalDate: string;
      originalStartTime: string;
      originalEndTime: string;
      originalTokenNumber: number | null;
      schedulingType: 'WAVE' | 'STREAM';
      proposedDate: string | null;
      proposedStartTime: string | null;
      proposedEndTime: string | null;
      proposedTokenNumber: number | null;
      priorityTier: 'SAME_DAY' | 'NEXT_DAY' | 'FUTURE_DATE' | null;
      found: boolean;
      failureReason?: string;
    }> = [];

    const todayStr = getTodayIST();
    const [tY, tM, tD] = todayStr.split('-').map(Number);
    const maxFutureDays = doctor.allowFutureBooking
      ? (doctor.maxFutureBookingDays && doctor.maxFutureBookingDays > 0 ? doctor.maxFutureBookingDays : 14)
      : 1;

    let shrinkTargetDayOfWeek: string | null = null;
    let shrinkTargetDate: string | null = null;
    let shrinkNewStartMin = 0;
    let shrinkNewEndMin = 1440;

    if (dto.shrinkContext) {
      shrinkNewStartMin = toMinutes(dto.shrinkContext.newStartTime);
      shrinkNewEndMin = toMinutes(dto.shrinkContext.newEndTime);

      if (dto.shrinkContext.shiftType === ShiftType.RECURRING) {
        const recShift = await this.recurringRepo.findOne({
          where: { id: dto.shrinkContext.shiftId, doctorId: doctor.id },
        });
        if (recShift) {
          shrinkTargetDayOfWeek = recShift.dayOfWeek;
        }
      } else {
        const custShift = await this.customRepo.findOne({
          where: { id: dto.shrinkContext.shiftId, doctorId: doctor.id },
        });
        if (custShift) {
          shrinkTargetDate = typeof custShift.date === 'string'
            ? custShift.date.split('T')[0]
            : (custShift.date as any) instanceof Date
              ? (custShift.date as any).toISOString().split('T')[0]
              : String(custShift.date);
        }
      }
    }

    const batchWaveTokens: Record<string, number> = {};

    for (const app of appointments) {
      const apptSchedulingType: 'WAVE' | 'STREAM' = app.tokenNumber !== null ? 'WAVE' : 'STREAM';
      const apptDuration = toMinutes(app.endTime) - toMinutes(app.startTime);

      // Search sequence: Priority 1 (Same day), Priority 2 (Next day), Priority 3 (Future days)
      const candidateDates: Array<{ date: string; priority: 'SAME_DAY' | 'NEXT_DAY' | 'FUTURE_DATE' }> = [];

      // Priority 1: Same day
      candidateDates.push({ date: app.date, priority: 'SAME_DAY' });

      // Priority 2: Next day
      const [appY, appM, appD] = app.date.split('-').map(Number);
      const nextDayDate = new Date(Date.UTC(appY, appM - 1, appD + 1));
      const nextDayStr = nextDayDate.toISOString().split('T')[0];
      candidateDates.push({ date: nextDayStr, priority: 'NEXT_DAY' });

      // Priority 3: Future days up to maxFutureDays
      for (let dayOffset = 2; dayOffset <= maxFutureDays; dayOffset++) {
        const futureDate = new Date(Date.UTC(appY, appM - 1, appD + dayOffset));
        const fStr = futureDate.toISOString().split('T')[0];
        candidateDates.push({ date: fStr, priority: 'FUTURE_DATE' });
      }

      let matchedSlot: {
        date: string;
        startTime: string;
        endTime: string;
        priority: 'SAME_DAY' | 'NEXT_DAY' | 'FUTURE_DATE';
        tokenNumber?: number;
      } | null = null;

      for (const { date: candDate, priority } of candidateDates) {
        if (candDate < todayStr) continue;

        // Check if patient already has another booking on this candidate date
        const patientBookingOnDay = await this.appointmentRepo.findOne({
          where: {
            patientId: app.patientId,
            doctorId: doctor.id,
            date: candDate,
            status: AppointmentStatus.CONFIRMED,
            id: Not(In(dto.appointmentIds)),
          },
        });
        if (patientBookingOnDay && patientBookingOnDay.id !== app.id) {
          continue; // patient already booked on this day
        }

        // Get slots on candDate
        try {
          const availableSlots = await this.availabilityService.getAvailableSlots(
            doctor.id,
            candDate,
            apptDuration,
          );

          // Filter compatible slots
          const compatibleSlots = availableSlots.filter(
            (s) =>
              s.schedulingType === apptSchedulingType &&
              (s.status === 'available' || s.status === 'cancel and available for booking'),
          );

          for (const slot of compatibleSlots) {
            // Cannot assign the exact same original slot being vacated
            if (
              candDate === app.date &&
              slot.startTime === app.startTime &&
              slot.endTime === app.endTime
            ) {
              continue;
            }

            // Exclude slots in the clipped period of the shift being shrunk
            if (dto.shrinkContext) {
              const candDayOfWeek = getDayOfWeekFromDate(candDate);
              const isAffectedByShrink =
                (shrinkTargetDayOfWeek && candDayOfWeek === shrinkTargetDayOfWeek) ||
                (shrinkTargetDate && candDate === shrinkTargetDate);

              if (isAffectedByShrink) {
                const slotStartM = toMinutes(slot.startTime);
                const slotEndM = toMinutes(slot.endTime);

                // Slot must fall completely within the new permitted hours
                if (slotStartM < shrinkNewStartMin || slotEndM > shrinkNewEndMin) {
                  continue; // Skip slot in clipped/shrunk period!
                }
              }
            }

            if (apptSchedulingType === 'WAVE') {
              const waveKey = `${candDate}_${slot.startTime}_${slot.endTime}`;
              const currentBatchCount = batchWaveCounts[waveKey] || 0;
              const maxCap = slot.maxPatients || 3;
              const bookedSoFar = (slot.bookedCount || 0) + currentBatchCount;

              if (bookedSoFar < maxCap) {
                batchWaveCounts[waveKey] = currentBatchCount + 1;

                if (batchWaveTokens[candDate] === undefined) {
                  const maxResult = await this.appointmentRepo
                    .createQueryBuilder('a')
                    .select('MAX(a.tokenNumber)', 'max')
                    .where('a.doctorId = :doctorId', { doctorId: doctor.id })
                    .andWhere('a.date = :date', { date: candDate })
                    .andWhere('a.status NOT IN (:...s)', { s: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] })
                    .getRawOne();
                  batchWaveTokens[candDate] = maxResult?.max ? parseInt(maxResult.max, 10) : 0;
                }
                batchWaveTokens[candDate] += 1;

                matchedSlot = {
                  date: candDate,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  priority,
                  tokenNumber: batchWaveTokens[candDate],
                };
                break;
              }
            } else {
              // STREAM scheduling
              const slotStartMin = toMinutes(slot.startTime);
              const slotEndMin = toMinutes(slot.endTime);

              // Check if already taken in this batch
              const streamCollision = batchStreamAllocations.some(
                (b) => b.date === candDate && !(slotEndMin <= b.startMin || slotStartMin >= b.endMin),
              );

              if (!streamCollision) {
                batchStreamAllocations.push({
                  date: candDate,
                  startMin: slotStartMin,
                  endMin: slotEndMin,
                });
                matchedSlot = {
                  date: candDate,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  priority,
                };
                break;
              }
            }
          }

          if (matchedSlot) break;
        } catch {
          // No availability on this candidate date, continue search
          continue;
        }
      }

      if (matchedSlot) {
        proposals.push({
          appointmentId: app.id,
          doctorId: doctor.id,
          patientId: app.patientId,
          patientName: app.patient?.fullName || 'Patient',
          originalDate: app.date,
          originalStartTime: app.startTime,
          originalEndTime: app.endTime,
          originalTokenNumber: app.tokenNumber ?? null,
          schedulingType: apptSchedulingType,
          proposedDate: matchedSlot.date,
          proposedStartTime: matchedSlot.startTime,
          proposedEndTime: matchedSlot.endTime,
          proposedTokenNumber: matchedSlot.tokenNumber ?? null,
          priorityTier: matchedSlot.priority,
          found: true,
        });
      } else {
        proposals.push({
          appointmentId: app.id,
          doctorId: doctor.id,
          patientId: app.patientId,
          patientName: app.patient?.fullName || 'Patient',
          originalDate: app.date,
          originalStartTime: app.startTime,
          originalEndTime: app.endTime,
          originalTokenNumber: app.tokenNumber ?? null,
          schedulingType: apptSchedulingType,
          proposedDate: null,
          proposedStartTime: null,
          proposedEndTime: null,
          proposedTokenNumber: null,
          priorityTier: null,
          found: false,
          failureReason: `No compatible ${apptSchedulingType} slots available within the next ${maxFutureDays} days`,
        });
      }
    }

    const sameDayCount = proposals.filter((p) => p.priorityTier === 'SAME_DAY').length;
    const nextDayCount = proposals.filter((p) => p.priorityTier === 'NEXT_DAY').length;
    const futureDateCount = proposals.filter((p) => p.priorityTier === 'FUTURE_DATE').length;
    const unresolvedCount = proposals.filter((p) => !p.found).length;

    return {
      totalAffected: appointments.length,
      sameDayCount,
      nextDayCount,
      futureDateCount,
      unresolvedCount,
      proposals,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DOCTOR APPROVAL: ATOMIC RESERVATION & PATIENT NOTIFICATION
  // ───────────────────────────────────────────────────────────────────────────
  async approveSmartReschedule(userId: string, dto: ApproveSmartRescheduleDto) {
    const doctor = await this.findDoctorByUserId(userId);
    if (!dto.proposals || dto.proposals.length === 0) {
      throw new BadRequestException('Proposals list cannot be empty');
    }

    if (dto.shrinkContext) {
      const shrinkStartMin = toMinutes(dto.shrinkContext.newStartTime);
      const shrinkEndMin = toMinutes(dto.shrinkContext.newEndTime);
      let shrinkTargetDayOfWeek: DayOfWeek | null = null;
      let shrinkTargetDate: string | null = null;

      const isRecurring = String(dto.shrinkContext.shiftType).toUpperCase() === 'RECURRING';
      if (isRecurring) {
        const recShift = await this.recurringRepo.findOne({
          where: { id: dto.shrinkContext.shiftId, doctorId: doctor.id },
        });
        if (recShift) shrinkTargetDayOfWeek = recShift.dayOfWeek;
      } else {
        const custShift = await this.customRepo.findOne({
          where: { id: dto.shrinkContext.shiftId, doctorId: doctor.id },
        });
        if (custShift) {
          shrinkTargetDate = typeof custShift.date === 'string'
            ? custShift.date.split('T')[0]
            : (custShift.date as any) instanceof Date
              ? (custShift.date as any).toISOString().split('T')[0]
              : String(custShift.date);
        }
      }

      for (const proposal of dto.proposals) {
        const pDayOfWeek = getDayOfWeekFromDate(proposal.proposedDate);
        const isAffected =
          (shrinkTargetDayOfWeek && pDayOfWeek === shrinkTargetDayOfWeek) ||
          (shrinkTargetDate && proposal.proposedDate === shrinkTargetDate);

        if (isAffected) {
          const pStart = toMinutes(proposal.proposedStartTime);
          const pEnd = toMinutes(proposal.proposedEndTime);
          if (pStart < shrinkStartMin || pEnd > shrinkEndMin) {
            throw new BadRequestException(
              `Proposed slot ${proposal.proposedStartTime}-${proposal.proposedEndTime} falls within the clipped/shrunk shift period`,
            );
          }
        }
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    const createdRequests: AppointmentRescheduleRequest[] = [];
    const now = new Date();
    // Default 24-hour reservation window
    const defaultExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const bulkTokensPerDay: Record<string, number> = {};

    try {
      for (const proposal of dto.proposals) {
        // Lock and verify appointment
        const appt = await queryRunner.manager.findOne(Appointment, {
          where: { id: proposal.appointmentId, doctorId: doctor.id },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        });

        if (!appt) {
          throw new NotFoundException(`Appointment with ID ${proposal.appointmentId} not found`);
        }

        // Cancel any existing active pending reschedule requests for this appointment
        await queryRunner.manager.update(
          AppointmentRescheduleRequest,
          { appointmentId: appt.id, status: RescheduleRequestStatus.PENDING },
          { status: RescheduleRequestStatus.CANCELLED },
        );

        // Check wave capacity / stream reservation availability with lock
        const sType = proposal.proposedSchedulingType || (appt.tokenNumber !== null ? SchedulingType.WAVE : SchedulingType.STREAM);

        let proposedToken: number | null = null;
        if (sType === SchedulingType.WAVE) {
          if (bulkTokensPerDay[proposal.proposedDate] === undefined) {
            const maxResult = await queryRunner.manager
              .createQueryBuilder(Appointment, 'a')
              .select('MAX(a.tokenNumber)', 'max')
              .where('a.doctorId = :doctorId', { doctorId: doctor.id })
              .andWhere('a.date = :date', { date: proposal.proposedDate })
              .andWhere('a.status NOT IN (:...s)', { s: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] })
              .getRawOne();
            bulkTokensPerDay[proposal.proposedDate] = maxResult?.max ? parseInt(maxResult.max, 10) : 0;
          }
          bulkTokensPerDay[proposal.proposedDate] += 1;
          proposedToken = bulkTokensPerDay[proposal.proposedDate];
        }

        const request = this.rescheduleRequestRepo.create({
          appointmentId: appt.id,
          doctorId: doctor.id,
          patientId: appt.patientId,
          rescheduleMethod: RescheduleMethod.SMART,
          status: RescheduleRequestStatus.PENDING,
          originalDate: appt.date,
          originalStartTime: appt.startTime,
          originalEndTime: appt.endTime,
          proposedDate: proposal.proposedDate,
          proposedStartTime: proposal.proposedStartTime,
          proposedEndTime: proposal.proposedEndTime,
          proposedTokenNumber: proposedToken,
          proposedSchedulingType: sType,
          expiresAt: defaultExpiry,
          doctorReason: proposal.doctorReason || 'Doctor updated clinic schedule',
        });

        const savedRequest = await queryRunner.manager.save(request);
        createdRequests.push(savedRequest);
      }

      // If shrinkContext provided, apply the shrink to the doctor's shift immediately!
      if (dto.shrinkContext) {
        const isRecurring = String(dto.shrinkContext.shiftType).toUpperCase() === 'RECURRING';
        const isCustom = String(dto.shrinkContext.shiftType).toUpperCase() === 'CUSTOM';

        if (isRecurring) {
          await queryRunner.manager.update(RecurringAvailability, dto.shrinkContext.shiftId, {
            startTime: dto.shrinkContext.newStartTime,
            endTime: dto.shrinkContext.newEndTime,
          });
          this.logger.log(
            `Recurring shift ${dto.shrinkContext.shiftId} shrunk to ${dto.shrinkContext.newStartTime}-${dto.shrinkContext.newEndTime} on reschedule approval`,
          );
        } else if (isCustom) {
          await queryRunner.manager.update(CustomAvailability, dto.shrinkContext.shiftId, {
            startTime: dto.shrinkContext.newStartTime,
            endTime: dto.shrinkContext.newEndTime,
          });
          this.logger.log(
            `Custom shift ${dto.shrinkContext.shiftId} shrunk to ${dto.shrinkContext.newStartTime}-${dto.shrinkContext.newEndTime} on reschedule approval`,
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Post-commit: Multi-channel notifications to patients
    for (const req of createdRequests) {
      try {
        const fullAppt = await this.appointmentRepo.findOne({
          where: { id: req.appointmentId },
          relations: { doctor: true, patient: { user: true } },
        });

        if (fullAppt) {
          // 1. In-app notification
          await this.notificationService.createNotification(
            req.patientId,
            'Appointment Rescheduling Request',
            `Dr. ${doctor.fullName} proposed rescheduling your appointment to ${formatDate(req.proposedDate)} at ${formatTime(req.proposedStartTime)}. Please confirm or select another slot.`,
            NotificationType.RESCHEDULE_REQUEST,
          );

          // 2. Multi-channel dispatch (Email, SMS, WhatsApp)
          if (this.notificationDispatcher && fullAppt.patient?.user) {
            this.notificationDispatcher.dispatchAsync({
              eventType: NotificationEventType.RESCHEDULE_PROPOSED_BY_DOCTOR,
              recipients: [
                {
                  id: req.patientId,
                  userId: fullAppt.patient.user.id,
                  name: fullAppt.patient.fullName,
                  email: fullAppt.patient.user.email,
                  phone: fullAppt.patient.phone || null,
                  role: 'PATIENT',
                },
              ],
              appointmentId: fullAppt.id,
              data: {
                patientName: fullAppt.patient.fullName,
                doctorName: doctor.fullName,
                specialization: doctor.specialization,
                originalDate: req.originalDate,
                originalStartTime: req.originalStartTime,
                proposedDate: req.proposedDate,
                proposedStartTime: req.proposedStartTime,
                proposedTokenNumber: req.proposedTokenNumber,
                appointmentId: fullAppt.id,
              },
            });
          }
        }
      } catch (notifErr: any) {
        this.logger.warn(`Failed to dispatch patient reschedule notification: ${notifErr.message}`);
      }
    }

    return {
      message: `Successfully approved smart rescheduling and reserved replacement slots for ${createdRequests.length} appointment(s).`,
      count: createdRequests.length,
      requests: createdRequests,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PHASE 3: MANUAL RESCHEDULING
  // ───────────────────────────────────────────────────────────────────────────
  async manualReschedule(userId: string, dto: ManualRescheduleDto) {
    const doctor = await this.findDoctorByUserId(userId);

    const appt = await this.appointmentRepo.findOne({
      where: { id: dto.appointmentId, doctorId: doctor.id },
      relations: { patient: { user: true }, doctor: true },
    });
    if (!appt) {
      throw new NotFoundException(`Appointment with ID ${dto.appointmentId} not found`);
    }

    if (appt.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot reschedule a cancelled appointment');
    }

    if (dto.proposedDate === appt.date && dto.proposedStartTime === appt.startTime) {
      throw new BadRequestException('Cannot reschedule to the exact same slot that is being changed');
    }

    const todayStr = getTodayIST();
    if (dto.proposedDate < todayStr) {
      throw new BadRequestException('Cannot reschedule to a past date');
    }

    // Validate that proposed slot does not fall into the clipped/shrunk period
    if (dto.shrinkContext) {
      const shrinkStartMin = toMinutes(dto.shrinkContext.newStartTime);
      const shrinkEndMin = toMinutes(dto.shrinkContext.newEndTime);
      let isAffectedDay = false;

      const isRecurring = String(dto.shrinkContext.shiftType).toUpperCase() === 'RECURRING';
      if (isRecurring) {
        const recShift = await this.recurringRepo.findOne({
          where: { id: dto.shrinkContext.shiftId, doctorId: doctor.id },
        });
        if (recShift && getDayOfWeekFromDate(dto.proposedDate) === recShift.dayOfWeek) {
          isAffectedDay = true;
        }
      } else {
        const custShift = await this.customRepo.findOne({
          where: { id: dto.shrinkContext.shiftId, doctorId: doctor.id },
        });
        if (custShift) {
          const custDateStr = typeof custShift.date === 'string'
            ? custShift.date.split('T')[0]
            : (custShift.date as any) instanceof Date
              ? (custShift.date as any).toISOString().split('T')[0]
              : String(custShift.date);
          if (dto.proposedDate === custDateStr) {
            isAffectedDay = true;
          }
        }
      }

      if (isAffectedDay) {
        const propStartMin = toMinutes(dto.proposedStartTime);
        const propEndMin = toMinutes(dto.proposedEndTime);
        if (propStartMin < shrinkStartMin || propEndMin > shrinkEndMin) {
          throw new BadRequestException('Cannot manually reschedule to a slot within the clipped/shrunk shift period');
        }
      }
    }

    // Validate doctor leave
    const leave = await this.leaveRepo.findOne({
      where: { doctorId: doctor.id, date: dto.proposedDate },
    });
    if (leave) {
      throw new BadRequestException('You are marked on leave on this date');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    let savedRequest: AppointmentRescheduleRequest;
    const defaultExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      // Cancel previous pending requests
      await queryRunner.manager.update(
        AppointmentRescheduleRequest,
        { appointmentId: appt.id, status: RescheduleRequestStatus.PENDING },
        { status: RescheduleRequestStatus.CANCELLED },
      );

      const sType = appt.tokenNumber !== null ? SchedulingType.WAVE : SchedulingType.STREAM;
      let proposedToken: number | null = null;

      if (sType === SchedulingType.WAVE) {
        const maxResult = await queryRunner.manager
          .createQueryBuilder(Appointment, 'a')
          .select('MAX(a.tokenNumber)', 'max')
          .where('a.doctorId = :doctorId', { doctorId: doctor.id })
          .andWhere('a.date = :date', { date: dto.proposedDate })
          .andWhere('a.status NOT IN (:...s)', { s: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] })
          .getRawOne();

        const currentMax = maxResult?.max ? parseInt(maxResult.max, 10) : 0;
        proposedToken = currentMax + 1;
      }

      const request = this.rescheduleRequestRepo.create({
        appointmentId: appt.id,
        doctorId: doctor.id,
        patientId: appt.patientId,
        rescheduleMethod: RescheduleMethod.MANUAL,
        status: RescheduleRequestStatus.PENDING,
        originalDate: appt.date,
        originalStartTime: appt.startTime,
        originalEndTime: appt.endTime,
        proposedDate: dto.proposedDate,
        proposedStartTime: dto.proposedStartTime,
        proposedEndTime: dto.proposedEndTime,
        proposedTokenNumber: proposedToken,
        proposedSchedulingType: sType,
        expiresAt: defaultExpiry,
        doctorReason: dto.doctorReason || 'Rescheduled manually by doctor',
      });

      savedRequest = await queryRunner.manager.save(request);

      // If shrinkContext provided, apply the shrink to the shift immediately!
      if (dto.shrinkContext) {
        const isRecurring = String(dto.shrinkContext.shiftType).toUpperCase() === 'RECURRING';
        const isCustom = String(dto.shrinkContext.shiftType).toUpperCase() === 'CUSTOM';

        if (isRecurring) {
          await queryRunner.manager.update(RecurringAvailability, dto.shrinkContext.shiftId, {
            startTime: dto.shrinkContext.newStartTime,
            endTime: dto.shrinkContext.newEndTime,
          });
          this.logger.log(
            `Recurring shift ${dto.shrinkContext.shiftId} shrunk to ${dto.shrinkContext.newStartTime}-${dto.shrinkContext.newEndTime} on manual reschedule dispatch`,
          );
        } else if (isCustom) {
          await queryRunner.manager.update(CustomAvailability, dto.shrinkContext.shiftId, {
            startTime: dto.shrinkContext.newStartTime,
            endTime: dto.shrinkContext.newEndTime,
          });
          this.logger.log(
            `Custom shift ${dto.shrinkContext.shiftId} shrunk to ${dto.shrinkContext.newStartTime}-${dto.shrinkContext.newEndTime} on manual reschedule dispatch`,
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Post-commit notification
    try {
      await this.notificationService.createNotification(
        appt.patientId,
        'Appointment Rescheduling Request',
        `Dr. ${doctor.fullName} proposed rescheduling your appointment to ${formatDate(dto.proposedDate)} at ${formatTime(dto.proposedStartTime)}. Please confirm or select another slot.`,
        NotificationType.RESCHEDULE_REQUEST,
      );

      if (this.notificationDispatcher && appt.patient?.user) {
        this.notificationDispatcher.dispatchAsync({
          eventType: NotificationEventType.RESCHEDULE_PROPOSED_BY_DOCTOR,
          recipients: [
            {
              id: appt.patientId,
              userId: appt.patient.user.id,
              name: appt.patient.fullName,
              email: appt.patient.user.email,
              phone: appt.patient.phone || null,
              role: 'PATIENT',
            },
          ],
          appointmentId: appt.id,
          data: {
            patientName: appt.patient.fullName,
            doctorName: doctor.fullName,
            specialization: doctor.specialization,
            originalDate: savedRequest.originalDate,
            originalStartTime: savedRequest.originalStartTime,
            proposedDate: savedRequest.proposedDate,
            proposedStartTime: savedRequest.proposedStartTime,
            proposedTokenNumber: savedRequest.proposedTokenNumber,
            appointmentId: appt.id,
          },
        });
      }
    } catch (notifErr: any) {
      this.logger.warn(`Failed to dispatch patient notification: ${notifErr.message}`);
    }

    return {
      message: 'Manual rescheduling request created and slot reserved.',
      request: savedRequest,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PHASE 5: PATIENT ACTIONS: ACCEPT, REJECT, CHOOSE ALTERNATIVE, CANCEL
  // ───────────────────────────────────────────────────────────────────────────
  async patientAcceptReschedule(userId: string, requestId: string, dto: PatientRespondRescheduleDto) {
    const patient = await this.findPatientByUserId(userId);

    const request = await this.rescheduleRequestRepo.findOne({
      where: { id: requestId, patientId: patient.id },
      relations: { appointment: true, doctor: { user: true } },
    });

    if (!request) {
      throw new NotFoundException(`Rescheduling request ${requestId} not found`);
    }

    if (request.status !== RescheduleRequestStatus.PENDING) {
      throw new BadRequestException(`Request is no longer pending (current status: ${request.status})`);
    }

    if (new Date() > new Date(request.expiresAt)) {
      request.status = RescheduleRequestStatus.EXPIRED;
      await this.rescheduleRequestRepo.save(request);
      throw new BadRequestException('This rescheduling request has expired. Please choose an alternative slot.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    let updatedAppointment: Appointment;

    try {
      const appt = await queryRunner.manager.findOne(Appointment, {
        where: { id: request.appointmentId },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });

      if (!appt) throw new NotFoundException('Appointment not found');

      if (appt.status === AppointmentStatus.CANCELLED) {
        request.status = RescheduleRequestStatus.CANCELLED;
        await this.rescheduleRequestRepo.save(request);
        throw new BadRequestException('This appointment has already been cancelled.');
      }

      const prevDate = appt.date;
      const prevStartTime = appt.startTime;

      // Update appointment details
      appt.date = request.proposedDate;
      appt.startTime = request.proposedStartTime;
      appt.endTime = request.proposedEndTime;
      if (request.proposedTokenNumber) {
        const collision = await queryRunner.manager.findOne(Appointment, {
          where: {
            doctorId: appt.doctorId,
            date: request.proposedDate,
            tokenNumber: request.proposedTokenNumber,
            status: Not(In([AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED])),
            id: Not(appt.id),
          },
        });
        if (collision) {
          const maxResult = await queryRunner.manager
            .createQueryBuilder(Appointment, 'a')
            .select('MAX(a.tokenNumber)', 'max')
            .where('a.doctorId = :doctorId', { doctorId: appt.doctorId })
            .andWhere('a.date = :date', { date: request.proposedDate })
            .andWhere('a.status NOT IN (:...s)', { s: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] })
            .getRawOne();
          const currentMax = maxResult?.max ? parseInt(maxResult.max, 10) : 0;
          appt.tokenNumber = currentMax + 1;
        } else {
          appt.tokenNumber = request.proposedTokenNumber;
        }
      } else {
        const maxResult = await queryRunner.manager
          .createQueryBuilder(Appointment, 'a')
          .select('MAX(a.tokenNumber)', 'max')
          .where('a.doctorId = :doctorId', { doctorId: appt.doctorId })
          .andWhere('a.date = :date', { date: request.proposedDate })
          .andWhere('a.status NOT IN (:...s)', { s: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] })
          .getRawOne();
        const currentMax = maxResult?.max ? parseInt(maxResult.max, 10) : 0;
        appt.tokenNumber = currentMax + 1;
      }
      appt.status = AppointmentStatus.CONFIRMED;

      updatedAppointment = await queryRunner.manager.save(appt);

      // Update request status
      request.status = RescheduleRequestStatus.ACCEPTED;
      request.patientRespondedAt = new Date();
      if (dto.notes) request.patientNotes = dto.notes;
      await queryRunner.manager.save(request);

      const todayStr = getTodayIST();
      if (prevDate === todayStr) {
        await this.queueService.recalculateQueue(appt.doctorId, prevDate, queryRunner.manager);
      }
      if (updatedAppointment.date === todayStr) {
        await this.queueService.recalculateQueue(appt.doctorId, updatedAppointment.date, queryRunner.manager);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Multi-channel notifications
    try {
      // 1. In-app for Doctor & Patient
      await this.notificationService.createDoctorNotification(
        request.doctorId,
        'Reschedule Confirmed by Patient',
        `Patient ${patient.fullName} accepted the appointment on ${formatDate(request.proposedDate)} at ${formatTime(request.proposedStartTime)}.`,
        NotificationType.APPOINTMENT_RESCHEDULED,
      );

      await this.notificationService.createNotification(
        patient.id,
        'Appointment Confirmed',
        `Your appointment with Dr. ${request.doctor.fullName} is confirmed for ${formatDate(request.proposedDate)} at ${formatTime(request.proposedStartTime)}.`,
        NotificationType.APPOINTMENT_RESCHEDULED,
      );

      if (this.notificationDispatcher) {
        const recipients: any[] = [
          {
            id: patient.id,
            userId: patient.user.id,
            name: patient.fullName,
            email: patient.user.email,
            phone: patient.phone || null,
            role: 'PATIENT',
          },
        ];
        if (request.doctor?.user) {
          recipients.push({
            id: request.doctorId,
            userId: request.doctor.user.id,
            name: request.doctor.fullName,
            email: request.doctor.user.email,
            phone: request.doctor.phone || null,
            role: 'DOCTOR',
          });
        }

        this.notificationDispatcher.dispatchAsync({
          eventType: NotificationEventType.RESCHEDULE_ACCEPTED_BY_PATIENT,
          recipients,
          appointmentId: updatedAppointment.id,
          data: {
            patientName: patient.fullName,
            doctorName: request.doctor.fullName,
            specialization: request.doctor.specialization,
            appointmentDate: updatedAppointment.date,
            startTime: updatedAppointment.startTime,
            endTime: updatedAppointment.endTime,
            tokenNumber: updatedAppointment.tokenNumber,
            appointmentId: updatedAppointment.id,
          },
        });
      }

      // Realtime socket event
      this.appointmentGateway?.emitAppointmentEvent(SOCKET_EVENTS.RESCHEDULED, {
        appointmentId: updatedAppointment.id,
        patientId: updatedAppointment.patientId,
        doctorId: updatedAppointment.doctorId,
        status: updatedAppointment.status,
        updatedAt: new Date().toISOString(),
        patientName: patient.fullName,
        date: updatedAppointment.date,
        startTime: updatedAppointment.startTime,
        endTime: updatedAppointment.endTime,
      });

      await this.reminderService?.scheduleAppointmentReminders(updatedAppointment);
    } catch (notifErr: any) {
      this.logger.warn(`Post-acceptance notification error: ${notifErr.message}`);
    }

    return {
      message: 'Appointment successfully confirmed for the new time slot.',
      appointment: updatedAppointment,
      request,
    };
  }

  async patientRejectReschedule(userId: string, requestId: string, dto: PatientRespondRescheduleDto) {
    const patient = await this.findPatientByUserId(userId);

    const request = await this.rescheduleRequestRepo.findOne({
      where: { id: requestId, patientId: patient.id },
      relations: { appointment: true, doctor: { user: true } },
    });

    if (!request) {
      throw new NotFoundException(`Rescheduling request ${requestId} not found`);
    }

    if (request.status !== RescheduleRequestStatus.PENDING) {
      throw new BadRequestException(`Request is no longer pending (current status: ${request.status})`);
    }

    request.status = RescheduleRequestStatus.REJECTED;
    request.patientRespondedAt = new Date();
    if (dto.notes) request.patientNotes = dto.notes;
    await this.rescheduleRequestRepo.save(request);

    // If the original shift is no longer staffed/available, auto-cancel appointment and refund patient
    let isOriginalSlotValid = false;
    try {
      const intervals = await this.availabilityService.getDoctorIntervalsForDate(
        request.doctorId,
        request.originalDate,
      );
      isOriginalSlotValid = intervals.some(
        (i) =>
          toMinutes(i.startTime) <= toMinutes(request.originalStartTime) &&
          toMinutes(i.endTime) >= toMinutes(request.originalEndTime),
      );
    } catch {
      isOriginalSlotValid = false;
    }

    let ghostCancelled = false;
    if (!isOriginalSlotValid && request.appointment) {
      request.appointment.status = AppointmentStatus.CANCELLED;
      await this.appointmentRepo.save(request.appointment);
      ghostCancelled = true;

      if (request.appointment.paymentStatus === 'PAID' && this.paymentService) {
        try {
          await this.paymentService.createRefund(userId, 'PATIENT', {
            appointmentId: request.appointment.id,
            reason: 'Clinic schedule reduced and patient declined alternative slot',
            bypassCutoff: true,
          });
        } catch (rfErr: any) {
          this.logger.error(`Auto-refund on rejected ghost slot: ${rfErr.message}`);
        }
      }
    }

    // Notify doctor
    try {
      const docMsg = ghostCancelled
        ? `Patient ${patient.fullName} declined proposed reschedule. Because original shift is no longer open, appointment was cancelled and refunded.`
        : `Patient ${patient.fullName} declined the proposed slot for their appointment on ${formatDate(request.originalDate)}. Their original booking remains recorded.`;

      await this.notificationService.createDoctorNotification(
        request.doctorId,
        'Patient Declined Reschedule',
        docMsg,
        NotificationType.APPOINTMENT_RESCHEDULED,
      );

      if (this.notificationDispatcher && request.doctor?.user) {
        this.notificationDispatcher.dispatchAsync({
          eventType: NotificationEventType.RESCHEDULE_REJECTED_BY_PATIENT,
          recipients: [
            {
              id: request.doctorId,
              userId: request.doctor.user.id,
              name: request.doctor.fullName,
              email: request.doctor.user.email,
              phone: request.doctor.phone || null,
              role: 'DOCTOR',
            },
          ],
          appointmentId: request.appointmentId,
          data: {
            patientName: patient.fullName,
            doctorName: request.doctor.fullName,
            specialization: request.doctor.specialization,
            appointmentDate: request.originalDate,
            startTime: request.originalStartTime,
            appointmentId: request.appointmentId,
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Rejection notification error: ${err.message}`);
    }

    return {
      message: 'Rescheduling proposal declined. Your original booking remains recorded. You can choose another opening or cancel if needed.',
      request,
    };
  }

  async patientChooseAlternative(userId: string, requestId: string, dto: PatientChooseAlternativeDto) {
    const patient = await this.findPatientByUserId(userId);

    const request = await this.rescheduleRequestRepo.findOne({
      where: { id: requestId, patientId: patient.id },
      relations: { appointment: true, doctor: { user: true } },
    });

    if (!request) {
      throw new NotFoundException(`Rescheduling request ${requestId} not found`);
    }

    const todayStr = getTodayIST();
    if (dto.date < todayStr) {
      throw new BadRequestException('Cannot select a past date');
    }

    // Verify slot exists and is available
    const availableSlots = await this.availabilityService.getAvailableSlots(
      request.doctorId,
      dto.date,
    );
    const valid = availableSlots.find(
      (s) => s.startTime === dto.startTime && s.endTime === dto.endTime && (s.status === 'available' || s.status === 'cancel and available for booking'),
    );
    if (!valid) {
      throw new ConflictException('Selected slot is no longer available. Please choose another slot.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    let updatedAppointment: Appointment;

    try {
      const appt = await queryRunner.manager.findOne(Appointment, {
        where: { id: request.appointmentId },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!appt) throw new NotFoundException('Appointment not found');

      if (appt.status === AppointmentStatus.CANCELLED) {
        request.status = RescheduleRequestStatus.CANCELLED;
        await this.rescheduleRequestRepo.save(request);
        throw new BadRequestException('This appointment has already been cancelled.');
      }

      const prevDate = appt.date;
      appt.date = dto.date;
      appt.startTime = dto.startTime;
      appt.endTime = dto.endTime;

      if (valid.schedulingType === SchedulingType.WAVE) {
        const maxResult = await queryRunner.manager
          .createQueryBuilder(Appointment, 'a')
          .select('MAX(a.tokenNumber)', 'max')
          .where('a.doctorId = :doctorId', { doctorId: request.doctorId })
          .andWhere('a.date = :date', { date: dto.date })
          .andWhere('a.status NOT IN (:...s)', { s: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] })
          .getRawOne();

        const currentMax = maxResult?.max ? parseInt(maxResult.max, 10) : 0;
        appt.tokenNumber = currentMax + 1;
      }

      appt.status = AppointmentStatus.CONFIRMED;
      updatedAppointment = await queryRunner.manager.save(appt);

      request.status = RescheduleRequestStatus.ACCEPTED;
      request.proposedDate = dto.date;
      request.proposedStartTime = dto.startTime;
      request.proposedEndTime = dto.endTime;
      request.proposedTokenNumber = updatedAppointment.tokenNumber;
      request.patientRespondedAt = new Date();
      request.patientNotes = dto.patientNotes || 'Patient selected custom alternative slot';
      await queryRunner.manager.save(request);

      if (prevDate === todayStr) {
        await this.queueService.recalculateQueue(appt.doctorId, prevDate, queryRunner.manager);
      }
      if (updatedAppointment.date === todayStr) {
        await this.queueService.recalculateQueue(appt.doctorId, updatedAppointment.date, queryRunner.manager);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    try {
      await this.notificationService.createDoctorNotification(
        request.doctorId,
        'Patient Selected Alternative Slot',
        `Patient ${patient.fullName} chose a replacement opening on ${formatDate(dto.date)} at ${formatTime(dto.startTime)}.`,
        NotificationType.APPOINTMENT_RESCHEDULED,
      );

      if (this.notificationDispatcher && request.doctor?.user) {
        this.notificationDispatcher.dispatchAsync({
          eventType: NotificationEventType.RESCHEDULE_ALTERNATIVE_CHOSEN,
          recipients: [
            {
              id: request.doctorId,
              userId: request.doctor.user.id,
              name: request.doctor.fullName,
              email: request.doctor.user.email,
              phone: request.doctor.phone || null,
              role: 'DOCTOR',
            },
          ],
          appointmentId: updatedAppointment.id,
          data: {
            patientName: patient.fullName,
            doctorName: request.doctor.fullName,
            specialization: request.doctor.specialization,
            appointmentDate: updatedAppointment.date,
            startTime: updatedAppointment.startTime,
            endTime: updatedAppointment.endTime,
            tokenNumber: updatedAppointment.tokenNumber,
            appointmentId: updatedAppointment.id,
          },
        });
      }

      this.appointmentGateway?.emitAppointmentEvent(SOCKET_EVENTS.RESCHEDULED, {
        appointmentId: updatedAppointment.id,
        patientId: updatedAppointment.patientId,
        doctorId: updatedAppointment.doctorId,
        status: updatedAppointment.status,
        updatedAt: new Date().toISOString(),
        patientName: patient.fullName,
        date: updatedAppointment.date,
        startTime: updatedAppointment.startTime,
        endTime: updatedAppointment.endTime,
      });

      await this.reminderService?.scheduleAppointmentReminders(updatedAppointment);
    } catch (err: any) {
      this.logger.warn(`Alternative slot notification error: ${err.message}`);
    }

    return {
      message: 'Alternative slot confirmed successfully.',
      appointment: updatedAppointment,
      request,
    };
  }

  async patientCancelReschedule(userId: string, requestId: string, dto: PatientCancelRescheduleDto) {
    const patient = await this.findPatientByUserId(userId);

    const request = await this.rescheduleRequestRepo.findOne({
      where: { id: requestId, patientId: patient.id },
      relations: { appointment: true, doctor: { user: true } },
    });

    if (!request) {
      throw new NotFoundException(`Rescheduling request ${requestId} not found`);
    }

    const appt = await this.appointmentRepo.findOne({
      where: { id: request.appointmentId },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    appt.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepo.save(appt);

    request.status = RescheduleRequestStatus.CANCELLED;
    request.patientRespondedAt = new Date();
    request.patientNotes = dto.reason || 'Patient cancelled during rescheduling';
    await this.rescheduleRequestRepo.save(request);

    // If paid, trigger automatic refund
    let refundResult: any = null;
    if (appt.paymentStatus === 'PAID' && this.paymentService) {
      try {
        refundResult = await this.paymentService.createRefund(userId, 'PATIENT', {
          appointmentId: appt.id,
          reason: dto.reason || 'Patient cancelled during availability rescheduling',
          bypassCutoff: true,
        });
        request.refundStatus = 'INITIATED';
        request.refundId = refundResult?.data?.refundId || null;
        await this.rescheduleRequestRepo.save(request);
      } catch (refundErr: any) {
        this.logger.error(`Refund initiation during cancel reschedule: ${refundErr.message}`);
        request.refundStatus = 'FAILED';
        await this.rescheduleRequestRepo.save(request);
      }
    }

    try {
      await this.notificationService.createDoctorNotification(
        request.doctorId,
        'Appointment Cancelled',
        `Patient ${patient.fullName} cancelled their appointment for ${formatDate(request.originalDate)} (${dto.reason || 'Cancelled during schedule update'}).`,
        NotificationType.APPOINTMENT_CANCELLED,
      );

      await this.notificationService.createNotification(
        patient.id,
        'Appointment Cancelled',
        `Your appointment on ${formatDate(request.originalDate)} was cancelled. ${refundResult ? 'Your refund has been initiated.' : ''}`,
        NotificationType.APPOINTMENT_CANCELLED,
      );

      this.appointmentGateway?.emitAppointmentEvent(SOCKET_EVENTS.CANCELLED, {
        appointmentId: appt.id,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        status: AppointmentStatus.CANCELLED,
        updatedAt: new Date().toISOString(),
      });
    } catch (notifErr: any) {
      this.logger.warn(`Cancellation notification error: ${notifErr.message}`);
    }

    return {
      message: refundResult
        ? 'Appointment cancelled and refund initiated successfully.'
        : 'Appointment cancelled successfully.',
      appointment: appt,
      refund: refundResult?.data || null,
      request,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CRON / MAINTENANCE: EXPIRE STALE RESERVATIONS
  // ───────────────────────────────────────────────────────────────────────────
  @Cron('*/15 * * * *') // Run every 15 minutes
  async expireStaleRequests() {
    const now = new Date();
    const staleRequests = await this.rescheduleRequestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.doctor', 'doctor')
      .leftJoinAndSelect('r.patient', 'patient')
      .where('r.status = :status', { status: RescheduleRequestStatus.PENDING })
      .andWhere('r.expiresAt < :now', { now })
      .getMany();

    if (staleRequests.length === 0) return;

    this.logger.log(`Expiring ${staleRequests.length} stale rescheduling reservation(s)...`);

    for (const req of staleRequests) {
      req.status = RescheduleRequestStatus.EXPIRED;
      await this.rescheduleRequestRepo.save(req);

      try {
        await this.notificationService.createDoctorNotification(
          req.doctorId,
          'Rescheduling Request Expired',
          `Patient ${req.patient?.fullName || 'Patient'} did not confirm the proposed slot for ${formatDate(req.proposedDate)} within 24 hours. Slot reservation released. Confirmed appointment remains intact.`,
          NotificationType.RESCHEDULE_REQUEST,
        );

        await this.notificationService.createNotification(
          req.patientId,
          'Rescheduling Window Expired',
          `The proposed time slot for Dr. ${req.doctor?.fullName || 'Doctor'} on ${formatDate(req.proposedDate)} has expired. Please contact the clinic or select another slot.`,
          NotificationType.RESCHEDULE_REQUEST,
        );
      } catch (err: any) {
        this.logger.warn(`Failed to notify on request expiry: ${err.message}`);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // QUERIES FOR DASHBOARD & CLIENT
  // ───────────────────────────────────────────────────────────────────────────
  async getDoctorRescheduleRequests(userId: string) {
    const doctor = await this.findDoctorByUserId(userId);
    const requests = await this.rescheduleRequestRepo.find({
      where: { doctorId: doctor.id },
      relations: { patient: true, appointment: true },
      order: { createdAt: 'DESC' },
    });
    return requests;
  }

  async getPatientPendingRescheduleRequests(userId: string) {
    const patient = await this.findPatientByUserId(userId);
    const requests = await this.rescheduleRequestRepo.find({
      where: {
        patientId: patient.id,
        status: RescheduleRequestStatus.PENDING,
        expiresAt: MoreThan(new Date()),
      },
      relations: { doctor: true, appointment: true },
      order: { createdAt: 'DESC' },
    });

    const activeRequests: AppointmentRescheduleRequest[] = [];
    for (const req of requests) {
      if (!req.appointment || req.appointment.status !== AppointmentStatus.CONFIRMED) {
        // Automatically cleanup orphaned requests for inactive/cancelled appointments
        await this.rescheduleRequestRepo.update(req.id, {
          status: RescheduleRequestStatus.CANCELLED,
          patientNotes: 'Appointment is no longer active',
        });
      } else {
        activeRequests.push(req);
      }
    }

    return activeRequests;
  }
}

