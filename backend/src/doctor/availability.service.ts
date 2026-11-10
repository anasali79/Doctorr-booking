import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, DataSource } from 'typeorm';
import {
  RecurringAvailability,
  DayOfWeek,
} from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { Doctor } from './entities/doctor.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { DoctorLeave } from './entities/leave.entity';
import { AppointmentRescheduleRequest } from '../appointment/entities/appointment-reschedule-request.entity';
import { RescheduleRequestStatus } from '../appointment/enums/reschedule-request-status.enum';
import {
  CreateRecurringAvailabilityDto,
  UpdateRecurringAvailabilityDto,
  CreateCustomAvailabilityDto,
  SlotStatus,
  UpdateAvailabilityConfigDto,
} from './dto/availability.dto';
import { SchedulingType } from '../common/enums/scheduling-type.enum';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { AppointmentService } from '../appointment/appointment.service';
import { PaymentService } from '../payment/payment.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationDispatcher } from '../notification/notification.dispatcher';
import { AppointmentGateway, SOCKET_EVENTS } from '../sockets/appointment.gateway';
import { QueueService } from '../appointment/queue.service';
import { ReminderService } from '../reminder/reminder.service';

export interface DividedSlotWithBookings {
  startTime: string;
  endTime: string;
  status: SlotStatus;
  maxPatients?: number;
  bookedCount?: number;
  availableCount?: number;
  bookings?: Array<{
    id: string;
    patientName: string;
    tokenNumber: number | null;
    status: string;
    paymentStatus?: string;
  }>;
}
import { getTodayIST, getMaxFutureDateIST } from '../common/utils/appointment.utils';

function isApptActivelyBlocking(app: any): boolean {
  if (!app) return false;
  if (app.status === AppointmentStatus.CANCELLED || app.status === AppointmentStatus.RESCHEDULED) {
    return false;
  }
  if (app.status === AppointmentStatus.PENDING_PAYMENT) {
    return app.pendingExpiresAt ? new Date(app.pendingExpiresAt) > new Date() : false;
  }
  return true;
}


function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function timesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);
  return s1 < e2 && s2 < e1;
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
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    @InjectRepository(RecurringAvailability)
    private readonly recurringRepo: Repository<RecurringAvailability>,

    @InjectRepository(CustomAvailability)
    private readonly customRepo: Repository<CustomAvailability>,

    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,

    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,

    @InjectRepository(DoctorLeave)
    private readonly leaveRepo: Repository<DoctorLeave>,

    @Optional()
    @InjectRepository(AppointmentRescheduleRequest)
    private readonly rescheduleRequestRepo?: Repository<AppointmentRescheduleRequest>,

    @Optional()
    @Inject(forwardRef(() => AppointmentService))
    private readonly appointmentService?: AppointmentService,

    @Optional()
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService?: PaymentService,

    @Optional()
    private readonly notificationService?: NotificationService,

    @Optional()
    private readonly notificationDispatcher?: NotificationDispatcher,

    @Optional()
    private readonly appointmentGateway?: AppointmentGateway,

    @Optional()
    private readonly queueService?: QueueService,

    @Optional()
    @Inject(forwardRef(() => ReminderService))
    private readonly reminderService?: ReminderService,

    @Optional()
    private readonly dataSource?: DataSource,
  ) { }

  // ─── Recurring Availability ──────────────────────────────────────────────────

  async createRecurring(
    userId: string,
    dto: CreateRecurringAvailabilityDto,
  ): Promise<RecurringAvailability | RecurringAvailability[]> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);

    let doctorUpdated = false;
    if (dto.allowFutureBooking !== undefined) {
      doctor.allowFutureBooking = dto.allowFutureBooking;
      doctorUpdated = true;
    }
    if (dto.maxFutureBookingDays !== undefined) {
      if (dto.maxFutureBookingDays !== null && dto.maxFutureBookingDays < 0) {
        throw new BadRequestException('maxFutureBookingDays cannot be negative');
      }
      doctor.maxFutureBookingDays = dto.maxFutureBookingDays;
      doctorUpdated = true;
    }
    if (doctorUpdated) {
      await this.doctorRepo.save(doctor);
    }

    const schedulingType = dto.schedulingType ?? SchedulingType.STREAM;

    // Validate scheduling configuration
    this.validateSchedulingConfig(schedulingType, dto);

    // Validate: endTime must be after startTime
    this.validateTimeRange(dto.startTime, dto.endTime);

    // Determine the days we need to create slots for
    let daysToCreate: DayOfWeek[] = [];
    if (dto.daysOfWeek && dto.daysOfWeek.length > 0) {
      daysToCreate = dto.daysOfWeek;
    } else if (dto.dayOfWeek) {
      daysToCreate = [dto.dayOfWeek];
    } else {
      throw new BadRequestException(
        'Either dayOfWeek or daysOfWeek must be provided',
      );
    }

    const createdSlots: RecurringAvailability[] = [];

    for (const day of daysToCreate) {
      // Check for overlap with existing slots on the same day
      const existingSlots = await this.recurringRepo.find({
        where: { doctorId: doctor.id, dayOfWeek: day },
      });

      this.checkRecurringOverlap(existingSlots, dto.startTime, dto.endTime);

      // Check for exact duplicate
      const duplicate = existingSlots.find(
        (s) => s.startTime === dto.startTime && s.endTime === dto.endTime,
      );
      if (duplicate) {
        throw new ConflictException(
          `A slot already exists for ${day} from ${dto.startTime} to ${dto.endTime}`,
        );
      }

      const slot = this.recurringRepo.create({
        doctorId: doctor.id,
        dayOfWeek: day,
        startTime: dto.startTime,
        endTime: dto.endTime,
        slotDuration: dto.slotDuration ?? (schedulingType === SchedulingType.WAVE ? 30 : 15),
        schedulingType,
        bufferTime: dto.bufferTime ?? 0,
        maxPatients: dto.maxPatients ?? (schedulingType === SchedulingType.WAVE ? 3 : 10),
      });

      createdSlots.push(slot);
    }

    const savedSlots = await this.recurringRepo.save(createdSlots);
    return savedSlots.length === 1 ? savedSlots[0] : savedSlots;
  }

  async getRecurring(userId: string): Promise<RecurringAvailability[]> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);
    return this.recurringRepo.find({
      where: { doctorId: doctor.id },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async getDetailedAvailability(userId: string): Promise<{
    doctorId: string;
    allowFutureBooking: boolean;
    maxFutureBookingDays: number | null;
    recurring: RecurringAvailability[];
    customOverrides: Array<CustomAvailability & { dayOfWeek: DayOfWeek }>;
    generatedSchedule: Array<{
      date: string;
      dayOfWeek: DayOfWeek;
      source: 'custom' | 'recurring' | 'none';
      slots: Array<{
        id: string;
        startTime: string;
        endTime: string;
        slotDuration: number;
        schedulingType?: SchedulingType;
        bufferTime?: number;
        maxPatients?: number;
        dividedSlots: DividedSlotWithBookings[];
      }>;
    }>;
  }> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);

    // 1. Get raw recurring templates
    const recurring = await this.recurringRepo.find({
      where: { doctorId: doctor.id },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });

    // Determine range: 30 days starting from today in IST
    const startDateStr = getTodayIST();
    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
    const maxDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    maxDate.setUTCDate(maxDate.getUTCDate() + 30);
    const endDateStr = maxDate.toISOString().split('T')[0];

    // Fetch all appointments in this 30-day range for status mapping with patient details
    const appointments = await this.appointmentRepo
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.patient', 'patient')
      .where('app.doctorId = :doctorId', { doctorId: doctor.id })
      .andWhere('app.date >= :start', { start: startDateStr })
      .andWhere('app.date <= :end', { end: endDateStr })
      .getMany();

    const appsByDate: Record<string, Appointment[]> = {};
    for (const app of appointments) {
      const cleanAppDate = typeof app.date === 'string'
        ? app.date.split('T')[0]
        : (app.date as any) instanceof Date
          ? (app.date as any).toISOString().split('T')[0]
          : String(app.date);

      if (!appsByDate[cleanAppDate]) appsByDate[cleanAppDate] = [];
      appsByDate[cleanAppDate].push(app);
    }

    // Fetch all doctor leaves in this 30-day range
    const leaves = await this.leaveRepo
      .createQueryBuilder('leave')
      .where('leave.doctorId = :doctorId', { doctorId: doctor.id })
      .andWhere('leave.date >= :start', { start: startDateStr })
      .andWhere('leave.date <= :end', { end: endDateStr })
      .getMany();

    const leavesMap = new Set(leaves.map((l) => l.date));

    // 2. Fetch all upcoming custom overrides
    const customOverrides = await this.customRepo
      .createQueryBuilder('ca')
      .where('ca.doctorId = :doctorId', { doctorId: doctor.id })
      .andWhere('ca.date >= :startDate', { startDate: startDateStr })
      .orderBy('ca.date', 'ASC')
      .addOrderBy('ca.startTime', 'ASC')
      .getMany();
    const customMap: Record<
      string,
      {
        slots: Array<{
          id: string;
          startTime: string;
          endTime: string;
          slotDuration: number;
          schedulingType: SchedulingType;
          bufferTime: number;
          maxPatients: number;
          dividedSlots: DividedSlotWithBookings[];
        }>;
        hasBlockout: boolean;
      }
    > = {};

    for (const override of customOverrides) {
      const cleanOverrideDate = typeof override.date === 'string'
        ? override.date.split('T')[0]
        : (override.date as any) instanceof Date
          ? (override.date as any).toISOString().split('T')[0]
          : String(override.date);

      if (!customMap[cleanOverrideDate]) {
        customMap[cleanOverrideDate] = { slots: [], hasBlockout: false };
      }
      if (override.startTime === '00:00' && override.endTime === '00:00') {
        customMap[cleanOverrideDate].hasBlockout = true;
      } else {
        const dur = override.slotDuration ?? 15;
        const sType = override.schedulingType ?? SchedulingType.STREAM;
        const winMins = toMinutes(override.endTime) - toMinutes(override.startTime);
        const effectiveDur =
          sType === SchedulingType.WAVE && winMins > 0 && dur > winMins ? winMins : dur;
        let effectiveMaxPatients =
          override.maxPatients ?? (sType === SchedulingType.WAVE ? 3 : 10);
        if (sType === SchedulingType.WAVE && winMins > 0 && dur > winMins) {
          effectiveMaxPatients = Math.max(
            1,
            Math.round(((override.maxPatients || 3) * winMins) / dur),
          );
        }

        let dividedSlots: DividedSlotWithBookings[] = [];

        if (sType === SchedulingType.WAVE) {
          const waveSlots = this.divideIntoSlots(
            override.startTime,
            override.endTime,
            effectiveDur,
            override.bufferTime ?? 0,
          );
          const maxPatients = effectiveMaxPatients;
          dividedSlots = waveSlots.map((ws) => {
            const matchingApps = (appsByDate[cleanOverrideDate] || []).filter(
              (app) =>
                app.startTime === ws.startTime &&
                app.endTime === ws.endTime &&
                isApptActivelyBlocking(app),
            );
            const bookedCount = matchingApps.length;
            const availableCount = Math.max(0, maxPatients - bookedCount);
            const status =
              availableCount > 0 ? SlotStatus.AVAILABLE : SlotStatus.BOOKED;
            return {
              startTime: ws.startTime,
              endTime: ws.endTime,
              status,
              maxPatients,
              bookedCount,
              availableCount,
              bookings: matchingApps.map((a) => ({
                id: a.id,
                patientName: a.patient?.fullName || 'Patient',
                tokenNumber: a.tokenNumber,
                status: a.status,
                paymentStatus: a.paymentStatus,
              })),
            };
          });
        } else {
          const maxPatients = override.maxPatients || 10;
          const matchingApps = (appsByDate[cleanOverrideDate] || []).filter((app) => {
            if (!isApptActivelyBlocking(app)) return false;
            const appStart = toMinutes(app.startTime);
            const appEnd = toMinutes(app.endTime);
            const slotStart = toMinutes(override.startTime);
            const slotEnd = toMinutes(override.endTime);
            return appStart >= slotStart && appEnd <= slotEnd;
          });
          const bookedCount = matchingApps.length;
          const availableCount = Math.max(0, maxPatients - bookedCount);
          const status =
            availableCount > 0 ? SlotStatus.AVAILABLE : SlotStatus.BOOKED;
          dividedSlots = [
            {
              startTime: override.startTime,
              endTime: override.endTime,
              status,
              maxPatients,
              bookedCount,
              availableCount,
              bookings: matchingApps.map((a) => ({
                id: a.id,
                patientName: a.patient?.fullName || 'Patient',
                tokenNumber: a.tokenNumber,
                status: a.status,
                paymentStatus: a.paymentStatus,
              })),
            },
          ];
        }

        const slotObj: any = {
          id: override.id,
          startTime: override.startTime,
          endTime: override.endTime,
          schedulingType: sType,
          dividedSlots,
          slotDuration: effectiveDur,
          bufferTime: override.bufferTime ?? 0,
          maxPatients: effectiveMaxPatients,
        };

        customMap[cleanOverrideDate].slots.push(slotObj);
      }
    }

    // 3. Generate calendar schedule for next 30 days
    const generatedSchedule: Array<{
      date: string;
      dayOfWeek: DayOfWeek;
      source: 'custom' | 'recurring' | 'none';
      slots: Array<{
        id: string;
        startTime: string;
        endTime: string;
        slotDuration: number;
        dividedSlots: DividedSlotWithBookings[];
      }>;
    }> = [];

    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(Date.UTC(startYear, startMonth - 1, startDay + i));
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = getDayOfWeekFromDate(dateStr);

      // Check if doctor is on leave on this date
      if (leavesMap.has(dateStr)) {
        generatedSchedule.push({
          date: dateStr,
          dayOfWeek,
          source: 'none',
          onLeave: true,
          message: 'Doctor is on leave',
          slots: [],
        } as any);
        continue;
      }

      // Check if custom override exists for this exact date
      if (customMap[dateStr]) {
        generatedSchedule.push({
          date: dateStr,
          dayOfWeek,
          source: 'custom',
          slots: customMap[dateStr].slots,
        });
      } else {
        // Fall back to recurring availability for this day of week
        const dateRecurringSlots = recurring.filter(
          (r) => r.dayOfWeek === dayOfWeek,
        );
        if (dateRecurringSlots.length > 0) {
          generatedSchedule.push({
            date: dateStr,
            dayOfWeek,
            source: 'recurring',
            slots: dateRecurringSlots.map((s) => {
              const dur = s.slotDuration ?? 15;
              const sType = s.schedulingType ?? SchedulingType.STREAM;
              const winMins = toMinutes(s.endTime) - toMinutes(s.startTime);
              const effectiveDur =
                sType === SchedulingType.WAVE && winMins > 0 && dur > winMins ? winMins : dur;
              let effectiveMaxPatients =
                s.maxPatients ?? (sType === SchedulingType.WAVE ? 3 : 10);
              if (sType === SchedulingType.WAVE && winMins > 0 && dur > winMins) {
                effectiveMaxPatients = Math.max(
                  1,
                  Math.round(((s.maxPatients || 3) * winMins) / dur),
                );
              }

              let dividedSlots: DividedSlotWithBookings[] = [];

              if (sType === SchedulingType.WAVE) {
                const waveSlots = this.divideIntoSlots(
                  s.startTime,
                  s.endTime,
                  effectiveDur,
                  s.bufferTime ?? 0,
                );
                const maxPatients = effectiveMaxPatients;
                dividedSlots = waveSlots.map((ws) => {
                  const matchingApps = (appsByDate[dateStr] || []).filter(
                    (app) =>
                      app.startTime === ws.startTime &&
                      app.endTime === ws.endTime &&
                      isApptActivelyBlocking(app),
                  );
                  const bookedCount = matchingApps.length;
                  const availableCount = Math.max(0, maxPatients - bookedCount);
                  const status =
                    availableCount > 0 ? SlotStatus.AVAILABLE : SlotStatus.BOOKED;
                  return {
                    startTime: ws.startTime,
                    endTime: ws.endTime,
                    status,
                    maxPatients,
                    bookedCount,
                    availableCount,
                    bookings: matchingApps.map((a) => ({
                      id: a.id,
                      patientName: a.patient?.fullName || 'Patient',
                      tokenNumber: a.tokenNumber,
                      status: a.status,
                      paymentStatus: a.paymentStatus,
                    })),
                  };
                });
              } else {
                const maxPatients = s.maxPatients || 10;
                const matchingApps = (appsByDate[dateStr] || []).filter((app) => {
                  if (!isApptActivelyBlocking(app)) return false;
                  const appStart = toMinutes(app.startTime);
                  const appEnd = toMinutes(app.endTime);
                  const slotStart = toMinutes(s.startTime);
                  const slotEnd = toMinutes(s.endTime);
                  return appStart >= slotStart && appEnd <= slotEnd;
                });
                const bookedCount = matchingApps.length;
                const availableCount = Math.max(0, maxPatients - bookedCount);
                const status =
                  availableCount > 0 ? SlotStatus.AVAILABLE : SlotStatus.BOOKED;
                dividedSlots = [
                  {
                    startTime: s.startTime,
                    endTime: s.endTime,
                    status,
                    maxPatients,
                    bookedCount,
                    availableCount,
                    bookings: matchingApps.map((a) => ({
                      id: a.id,
                      patientName: a.patient?.fullName || 'Patient',
                      tokenNumber: a.tokenNumber,
                      status: a.status,
                      paymentStatus: a.paymentStatus,
                    })),
                  },
                ];
              }

              const slotObj: any = {
                id: s.id,
                startTime: s.startTime,
                endTime: s.endTime,
                schedulingType: sType,
                dividedSlots,
                slotDuration: effectiveDur,
                bufferTime: s.bufferTime ?? 0,
                maxPatients: effectiveMaxPatients,
              };

              return slotObj;
            }),
          });
        } else {
          generatedSchedule.push({
            date: dateStr,
            dayOfWeek,
            source: 'none',
            slots: [],
          });
        }
      }
    }

    const customOverridesWithDay = customOverrides
      .filter((o) => !(o.startTime === '00:00' && o.endTime === '00:00'))
      .map((override) => {
        const dateStr = typeof override.date === 'string'
          ? override.date.split('T')[0]
          : (override.date as any) instanceof Date
            ? (override.date as any).toISOString().split('T')[0]
            : String(override.date);
        return {
          ...override,
          date: dateStr,
          dayOfWeek: getDayOfWeekFromDate(dateStr),
        };
      });

    return {
      doctorId: doctor.id,
      allowFutureBooking: doctor.allowFutureBooking,
      maxFutureBookingDays: doctor.maxFutureBookingDays,
      recurring,
      customOverrides: customOverridesWithDay,
      generatedSchedule,
    };
  }

  async cancelOccurrence(
    userId: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<void> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);
    const dayOfWeek = getDayOfWeekFromDate(date);

    // 1. Check if there are already custom overrides for this date
    const customSlots = await this.customRepo.find({
      where: { doctorId: doctor.id, date },
    });

    if (customSlots.length > 0) {
      // Case A: Custom overrides exist.
      // If we find the specific slot, delete it.
      const match = customSlots.find(
        (s) => s.startTime === startTime && s.endTime === endTime,
      );
      if (match) {
        await this.customRepo.remove(match);
        const remainingCustomCount = customSlots.filter(
          (s) => s.id !== match.id,
        ).length;
        if (remainingCustomCount === 0) {
          const blockout = this.customRepo.create({
            doctorId: doctor.id,
            date,
            startTime: '00:00',
            endTime: '00:00',
          });
          await this.customRepo.save(blockout);
        }
      } else {
        throw new NotFoundException(
          `Slot ${startTime}-${endTime} not found on custom overrides for ${date}`,
        );
      }
    } else {
      const recurringSlots = await this.recurringRepo.find({
        where: { doctorId: doctor.id, dayOfWeek },
      });

      const remainingSlots = recurringSlots.filter(
        (s) => !(s.startTime === startTime && s.endTime === endTime),
      );

      if (remainingSlots.length === recurringSlots.length) {
        throw new NotFoundException(
          `No matching slot found to cancel on ${date} (Day: ${dayOfWeek})`,
        );
      }

      if (remainingSlots.length > 0) {
        // Save remaining slots as custom overrides
        const newCustoms = remainingSlots.map((s) =>
          this.customRepo.create({
            doctorId: doctor.id,
            date,
            startTime: s.startTime,
            endTime: s.endTime,
            slotDuration: s.slotDuration ?? 15,
          }),
        );
        await this.customRepo.save(newCustoms);
      } else {
        // No slots remaining -> doctor wants to be completely unavailable.
        // Save a blockout slot.
        const blockout = this.customRepo.create({
          doctorId: doctor.id,
          date,
          startTime: '00:00',
          endTime: '00:00',
        });
        await this.customRepo.save(blockout);
      }
    }
  }

  async setUnavailable(
    userId: string,
    date: string,
    startTime?: string,
    endTime?: string,
  ): Promise<
    Array<{
      appointmentId: string;
      patientId: string;
      previousDate: string;
      previousStartTime: string;
      previousEndTime: string;
      newDate: string;
      newStartTime: string;
      newEndTime: string;
      tokenNumber: number | null;
    }>
  > {
    const doctor = await this.findDoctorByUserIdOrFail(userId);

    const todayStr = getTodayIST();

    if (date < todayStr) {
      throw new BadRequestException('Date cannot be in the past');
    }

    let appointmentsToReschedule: Appointment[] = [];

    if (startTime && endTime) {
      // 1. Cancel specific slot occurrence (removes from available intervals)
      try {
        await this.cancelOccurrence(userId, date, startTime, endTime);
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }

      // 2. Find any BOOKED appointments for this doctor on this date and specific slot
      appointmentsToReschedule = await this.appointmentRepo.find({
        where: {
          doctorId: doctor.id,
          date,
          startTime,
          endTime,
          status: AppointmentStatus.CONFIRMED,
        },
      });
    } else {
      // 1. Block the entire day by inserting/updating a blockout slot
      // First, remove any custom overrides for this date
      const customSlots = await this.customRepo.find({
        where: { doctorId: doctor.id, date },
      });
      if (customSlots.length > 0) {
        await this.customRepo.remove(customSlots);
      }

      // Insert blockout slot (00:00 - 00:00)
      const blockout = this.customRepo.create({
        doctorId: doctor.id,
        date,
        startTime: '00:00',
        endTime: '00:00',
      });
      await this.customRepo.save(blockout);

      // 2. Find all BOOKED appointments for this doctor on this date
      appointmentsToReschedule = await this.appointmentRepo.find({
        where: {
          doctorId: doctor.id,
          date,
          status: AppointmentStatus.CONFIRMED,
        },
      });
    }

    const rescheduledDetails: Array<{
      appointmentId: string;
      patientId: string;
      previousDate: string;
      previousStartTime: string;
      previousEndTime: string;
      newDate: string;
      newStartTime: string;
      newEndTime: string;
      tokenNumber: number | null;
    }> = [];

    for (const appt of appointmentsToReschedule) {
      // Look for the next available slot for this doctor starting from the date of the appointment
      const excludeStart = startTime;
      const excludeEnd = endTime;

      const nextSlot = await this.findNextAvailableSlot(
        doctor.id,
        appt.date,
        excludeStart,
        excludeEnd,
      );

      if (nextSlot) {
        let newTokenNumber: number | null = null;
        if (nextSlot.schedulingType === 'WAVE') {
          const rawResult = await this.appointmentRepo
            .createQueryBuilder('appointment')
            .select('MAX(appointment.tokenNumber)', 'max')
            .where('appointment.doctorId = :doctorId', { doctorId: doctor.id })
            .andWhere('appointment.date = :date', { date: nextSlot.date })
            .andWhere('appointment.startTime = :startTime', {
              startTime: nextSlot.startTime,
            })
            .andWhere('appointment.endTime = :endTime', {
              endTime: nextSlot.endTime,
            })
            .andWhere('appointment.status NOT IN (:...statuses)', {
              statuses: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED],
            })
            .getRawOne();

          const maxResult = rawResult as { max: string | null } | undefined;
          const currentMax = maxResult?.max ? parseInt(maxResult.max, 10) : 0;
          newTokenNumber = currentMax + 1;
        }

        const previousDate = appt.date;
        const previousStartTime = appt.startTime;
        const previousEndTime = appt.endTime;

        appt.date = nextSlot.date;
        appt.startTime = nextSlot.startTime;
        appt.endTime = nextSlot.endTime;
        appt.tokenNumber = newTokenNumber;

        await this.appointmentRepo.save(appt);

        rescheduledDetails.push({
          appointmentId: appt.id,
          patientId: appt.patientId,
          previousDate,
          previousStartTime,
          previousEndTime,
          newDate: nextSlot.date,
          newStartTime: nextSlot.startTime,
          newEndTime: nextSlot.endTime,
          tokenNumber: newTokenNumber,
        });
      } else {
        appt.status = AppointmentStatus.CANCELLED;
        await this.appointmentRepo.save(appt);
      }
    }

    return rescheduledDetails;
  }

  async updateRecurring(
    userId: string,
    id: string,
    dto: UpdateRecurringAvailabilityDto,
  ): Promise<RecurringAvailability> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);

    let doctorUpdated = false;
    if (dto.allowFutureBooking !== undefined) {
      doctor.allowFutureBooking = dto.allowFutureBooking;
      doctorUpdated = true;
    }
    if (dto.maxFutureBookingDays !== undefined) {
      if (dto.maxFutureBookingDays !== null && dto.maxFutureBookingDays < 0) {
        throw new BadRequestException('maxFutureBookingDays cannot be negative');
      }
      doctor.maxFutureBookingDays = dto.maxFutureBookingDays;
      doctorUpdated = true;
    }
    if (doctorUpdated) {
      await this.doctorRepo.save(doctor);
    }

    const slot = await this.findRecurringSlotOrFail(id, doctor.id);

    const updatedDay = dto.dayOfWeek ?? slot.dayOfWeek;
    const updatedStart = dto.startTime ?? slot.startTime;
    const updatedEnd = dto.endTime ?? slot.endTime;

    // Validate time range
    this.validateTimeRange(updatedStart, updatedEnd);

    // Get all OTHER slots for that day (excluding current)
    const existingSlots = await this.recurringRepo
      .createQueryBuilder('ra')
      .where('ra.doctorId = :doctorId', { doctorId: doctor.id })
      .andWhere('ra.dayOfWeek = :day', { day: updatedDay })
      .andWhere('ra.id != :id', { id })
      .getMany();

    this.checkRecurringOverlap(existingSlots, updatedStart, updatedEnd);

    // Check for exact duplicate excluding self
    const duplicate = existingSlots.find(
      (s) => s.startTime === updatedStart && s.endTime === updatedEnd,
    );
    if (duplicate) {
      throw new ConflictException(
        `A slot already exists for ${updatedDay} from ${updatedStart} to ${updatedEnd}`,
      );
    }

    Object.assign(slot, {
      dayOfWeek: updatedDay,
      startTime: updatedStart,
      endTime: updatedEnd,
      ...(dto.slotDuration !== undefined && { slotDuration: dto.slotDuration }),
    });

    return this.recurringRepo.save(slot);
  }

  async checkRecurringShiftDelete(
    userId: string,
    id: string,
  ): Promise<{
    slot: RecurringAvailability;
    conflictCount: number;
    affectedAppointments: Array<{
      id: string;
      patientId: string;
      doctorId: string;
      patientName: string;
      date: string;
      startTime: string;
      endTime: string;
      tokenNumber: number | null;
      paymentStatus: string;
      status: string;
    }>;
  }> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);
    const slot = await this.findRecurringSlotOrFail(id, doctor.id);
    const todayStr = getTodayIST();
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();

    // Find all confirmed appointments for this doctor from today onwards
    const appointments = await this.appointmentRepo.find({
      where: {
        doctorId: doctor.id,
        status: AppointmentStatus.CONFIRMED,
        date: MoreThanOrEqual(todayStr),
      },
      relations: { patient: { user: true } },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    // Check custom overrides for this doctor from today onwards
    const customOverrides = await this.customRepo.find({
      where: {
        doctorId: doctor.id,
        date: MoreThanOrEqual(todayStr),
      },
    });

    const customDates = new Set(
      customOverrides.map((o) =>
        typeof o.date === 'string'
          ? o.date.split('T')[0]
          : (o.date as any) instanceof Date
            ? (o.date as any).toISOString().split('T')[0]
            : String(o.date),
      ),
    );

    const conflictingAppointments = appointments.filter((app) => {
      const appDateStr = typeof app.date === 'string'
        ? app.date.split('T')[0]
        : (app.date as any) instanceof Date
          ? (app.date as any).toISOString().split('T')[0]
          : String(app.date);

      // If this date has a custom override, schedule is governed by custom overrides, not this recurring slot
      if (customDates.has(appDateStr)) return false;

      const appDay = getDayOfWeekFromDate(appDateStr);
      if (appDay !== slot.dayOfWeek) return false;

      // Check time overlap
      if (!timesOverlap(app.startTime, app.endTime, slot.startTime, slot.endTime)) {
        return false;
      }

      // If appointment is today, only consider it if it hasn't ended yet
      if (appDateStr === todayStr && toMinutes(app.endTime) < currentMinutes) {
        return false;
      }

      return true;
    });

    return {
      slot,
      conflictCount: conflictingAppointments.length,
      affectedAppointments: conflictingAppointments.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        doctorId: a.doctorId,
        patientName: a.patient?.fullName || 'Patient',
        date: typeof a.date === 'string'
          ? a.date.split('T')[0]
          : (a.date as any) instanceof Date
            ? (a.date as any).toISOString().split('T')[0]
            : String(a.date),
        startTime: a.startTime,
        endTime: a.endTime,
        tokenNumber: a.tokenNumber,
        paymentStatus: a.paymentStatus,
        status: a.status,
      })),
    };
  }

  async deleteRecurring(
    userId: string,
    id: string,
    confirmCancelAndRefund?: boolean,
  ): Promise<{
    message: string;
    cancelledAppointmentsCount: number;
  }> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);
    const check = await this.checkRecurringShiftDelete(userId, id);

    if (check.conflictCount > 0) {
      if (!confirmCancelAndRefund) {
        throw new ConflictException({
          message: `Cannot delete recurring shift: There are ${check.conflictCount} confirmed appointment(s) booked during this recurring shift.`,
          requiresConfirmation: true,
          conflictCount: check.conflictCount,
          affectedAppointments: check.affectedAppointments,
        });
      }

      // Option C: Doctor confirmed shift deletion — cancel appointments and issue refunds
      for (const appt of check.affectedAppointments) {
        try {
          if (this.appointmentService) {
            await this.appointmentService.cancelAppointmentByDoctor(userId, appt.id);
          } else {
            await this.appointmentRepo.update(appt.id, {
              status: AppointmentStatus.CANCELLED,
              pendingExpiresAt: null,
            });
            if (this.rescheduleRequestRepo) {
              await this.rescheduleRequestRepo.update(
                { appointmentId: appt.id, status: RescheduleRequestStatus.PENDING },
                {
                  status: RescheduleRequestStatus.CANCELLED,
                  doctorReason: 'Doctor removed recurring shift',
                },
              );
            }
            if (this.paymentService && appt.paymentStatus === 'PAID') {
              try {
                await this.paymentService.createRefund(userId, 'DOCTOR', {
                  appointmentId: appt.id,
                  reason: 'Doctor removed recurring shift',
                });
              } catch (e: any) {
                this.logger.warn(`Refund fallback error for ${appt.id}: ${e.message}`);
              }
            }
            this.appointmentGateway?.emitAppointmentEvent(SOCKET_EVENTS.CANCELLED, {
              appointmentId: appt.id,
              patientId: appt.patientId,
              doctorId: appt.doctorId,
              status: AppointmentStatus.CANCELLED,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to cancel appointment ${appt.id} during recurring shift deletion: ${err.message}`,
          );
        }
      }
    }

    // Cancel any pending reschedule requests associated with this recurring day and shift
    if (this.rescheduleRequestRepo) {
      try {
        const pendingReqs = await this.rescheduleRequestRepo.find({
          where: {
            doctorId: doctor.id,
            status: RescheduleRequestStatus.PENDING,
          },
        });
        for (const req of pendingReqs) {
          const propDay = getDayOfWeekFromDate(req.proposedDate);
          const origDay = getDayOfWeekFromDate(req.originalDate);
          if (propDay === check.slot.dayOfWeek || origDay === check.slot.dayOfWeek) {
            await this.rescheduleRequestRepo.update(req.id, {
              status: RescheduleRequestStatus.CANCELLED,
              doctorReason: `Doctor removed recurring schedule for ${check.slot.dayOfWeek}`,
            });
          }
        }
      } catch (err: any) {
        // Log and continue deletion
      }
    }

    await this.recurringRepo.remove(check.slot);

    return {
      message:
        check.conflictCount > 0
          ? `Recurring shift removed successfully. ${check.conflictCount} appointment(s) cancelled and refunded.`
          : 'Recurring availability slot deleted successfully',
      cancelledAppointmentsCount: check.conflictCount,
    };
  }

  async checkCustomOverrideDelete(
    userId: string,
    id: string,
  ): Promise<{
    override: CustomAvailability;
    conflictCount: number;
    affectedAppointments: Array<{
      id: string;
      patientId: string;
      doctorId: string;
      patientName: string;
      date: string;
      startTime: string;
      endTime: string;
      tokenNumber: number | null;
      paymentStatus: string;
      status: string;
    }>;
  }> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);
    const override = await this.customRepo.findOne({
      where: { id, doctorId: doctor.id },
    });
    if (!override) {
      throw new NotFoundException(`Custom override with ID ${id} not found`);
    }

    const cleanDate = typeof override.date === 'string'
      ? override.date.split('T')[0]
      : (override.date as any) instanceof Date
        ? (override.date as any).toISOString().split('T')[0]
        : String(override.date);

    const appointments = await this.appointmentRepo.find({
      where: {
        doctorId: doctor.id,
        date: cleanDate,
        status: AppointmentStatus.CONFIRMED,
      },
      relations: { patient: { user: true } },
      order: { startTime: 'ASC' },
    });

    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayStr = getTodayIST();
    const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();

    const conflictingAppointments = appointments.filter((app) => {
      if (!timesOverlap(app.startTime, app.endTime, override.startTime, override.endTime)) {
        return false;
      }
      if (cleanDate === todayStr && toMinutes(app.endTime) < currentMinutes) {
        return false;
      }
      return true;
    });

    return {
      override,
      conflictCount: conflictingAppointments.length,
      affectedAppointments: conflictingAppointments.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        doctorId: a.doctorId,
        patientName: a.patient?.fullName || 'Patient',
        date: cleanDate,
        startTime: a.startTime,
        endTime: a.endTime,
        tokenNumber: a.tokenNumber,
        paymentStatus: a.paymentStatus,
        status: a.status,
      })),
    };
  }

  async deleteCustomOverride(
    userId: string,
    id: string,
    confirmCancelAndRefund?: boolean,
  ): Promise<{
    message: string;
    cancelledAppointmentsCount: number;
  }> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);
    const check = await this.checkCustomOverrideDelete(userId, id);

    if (check.conflictCount > 0) {
      if (!confirmCancelAndRefund) {
        throw new ConflictException({
          message: `Cannot delete shift override: There are ${check.conflictCount} confirmed appointment(s) booked during this shift.`,
          requiresConfirmation: true,
          conflictCount: check.conflictCount,
          affectedAppointments: check.affectedAppointments,
        });
      }

      // Option C: Doctor confirmed shift deletion — cancel appointments and issue refunds
      for (const appt of check.affectedAppointments) {
        try {
          if (this.appointmentService) {
            await this.appointmentService.cancelAppointmentByDoctor(userId, appt.id);
          } else {
            await this.appointmentRepo.update(appt.id, {
              status: AppointmentStatus.CANCELLED,
              pendingExpiresAt: null,
            });
            if (this.rescheduleRequestRepo) {
              await this.rescheduleRequestRepo.update(
                { appointmentId: appt.id, status: RescheduleRequestStatus.PENDING },
                {
                  status: RescheduleRequestStatus.CANCELLED,
                  doctorReason: 'Doctor removed shift override',
                },
              );
            }
            if (this.paymentService && appt.paymentStatus === 'PAID') {
              try {
                await this.paymentService.createRefund(userId, 'DOCTOR', {
                  appointmentId: appt.id,
                  reason: 'Doctor removed shift override',
                });
              } catch (e: any) {
                this.logger.warn(`Refund fallback error for ${appt.id}: ${e.message}`);
              }
            }
            this.appointmentGateway?.emitAppointmentEvent(SOCKET_EVENTS.CANCELLED, {
              appointmentId: appt.id,
              patientId: appt.patientId,
              doctorId: appt.doctorId,
              status: AppointmentStatus.CANCELLED,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to cancel appointment ${appt.id} during shift override deletion: ${err.message}`,
          );
        }
      }
    }

    const cleanDate = typeof check.override.date === 'string'
      ? check.override.date.split('T')[0]
      : (check.override.date as any) instanceof Date
        ? (check.override.date as any).toISOString().split('T')[0]
        : String(check.override.date);

    // Cancel any pending reschedule requests associated with this custom override date
    if (this.rescheduleRequestRepo) {
      try {
        await this.rescheduleRequestRepo.update(
          {
            doctorId: doctor.id,
            proposedDate: cleanDate,
            status: RescheduleRequestStatus.PENDING,
          },
          {
            status: RescheduleRequestStatus.CANCELLED,
            doctorReason: `Doctor deleted schedule override for ${cleanDate}`,
          },
        );
      } catch (err: any) {
        // Log and continue deletion
      }
    }

    await this.customRepo.remove(check.override);

    return {
      message:
        check.conflictCount > 0
          ? `Shift override removed successfully. ${check.conflictCount} appointment(s) cancelled and refunded.`
          : 'Custom availability override deleted successfully',
      cancelledAppointmentsCount: check.conflictCount,
    };
  }

  async createCustomOverride(
    userId: string,
    dto: CreateCustomAvailabilityDto,
  ): Promise<CustomAvailability> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);

    let doctorUpdated = false;
    if (dto.allowFutureBooking !== undefined) {
      doctor.allowFutureBooking = dto.allowFutureBooking;
      doctorUpdated = true;
    }
    if (dto.maxFutureBookingDays !== undefined) {
      if (dto.maxFutureBookingDays !== null && dto.maxFutureBookingDays < 0) {
        throw new BadRequestException('maxFutureBookingDays cannot be negative');
      }
      doctor.maxFutureBookingDays = dto.maxFutureBookingDays;
      doctorUpdated = true;
    }
    if (doctorUpdated) {
      await this.doctorRepo.save(doctor);
    }

    this.validateTimeRange(dto.startTime, dto.endTime);

    this.validateDateNotPast(dto.date);

    const existingSlots = await this.customRepo.find({
      where: { doctorId: doctor.id, date: dto.date },
    });

    this.checkCustomOverlap(existingSlots, dto.startTime, dto.endTime);
    const duplicate = existingSlots.find(
      (s) => s.startTime === dto.startTime && s.endTime === dto.endTime,
    );
    if (duplicate) {
      throw new ConflictException(
        `A custom slot already exists for ${dto.date} from ${dto.startTime} to ${dto.endTime}`,
      );
    }

    const customSchedulingType = dto.schedulingType ?? SchedulingType.STREAM;
    this.validateSchedulingConfig(customSchedulingType, dto);

    const slot = this.customRepo.create({
      doctorId: doctor.id,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      slotDuration: dto.slotDuration ?? (customSchedulingType === SchedulingType.WAVE ? 30 : 15),
      schedulingType: customSchedulingType,
      bufferTime: dto.bufferTime ?? 0,
      maxPatients: dto.maxPatients ?? (customSchedulingType === SchedulingType.WAVE ? 3 : 10),
    });

    return this.customRepo.save(slot);
  }

  async getAvailabilityByDate(
    doctorId: string,
    date: string,
  ): Promise<{
    date: string;
    dayOfWeek: DayOfWeek;
    source: 'custom' | 'recurring' | 'none';
    slots: Array<{
      startTime: string;
      endTime: string;
      slotDuration: number;
      dividedSlots: Array<{
        startTime: string;
        endTime: string;
        status: SlotStatus;
      }>;
    }>;
  }> {
    const cleanDate = date.trim().replace(/\/$/, '');
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(cleanDate)) {
      throw new BadRequestException(
        'date must be in YYYY-MM-DD format, e.g. "2026-06-15"',
      );
    }

    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${doctorId} not found`);
    }

    const dayOfWeek = getDayOfWeekFromDate(cleanDate);

    // ── Doctor leave check ──────────────────────────────────────────────────
    const leaveRecord = await this.leaveRepo.findOne({
      where: { doctorId: doctor.id, date: cleanDate },
    });
    if (leaveRecord) {
      return {
        date: cleanDate,
        dayOfWeek,
        source: 'none',
        onLeave: true,
        message: 'Doctor is on leave',
        slots: [],
      } as any;
    }

    // Validate booking date against doctor's future-booking configuration
    await this.validateFutureBookingConfig(doctor, cleanDate);

    const appointments = await this.appointmentRepo.find({
      where: { doctorId, date: cleanDate },
    });

    const customSlots = await this.customRepo.find({
      where: { doctorId, date: cleanDate },
      order: { startTime: 'ASC' },
    });

    if (customSlots.length > 0) {
      return {
        date: cleanDate,
        dayOfWeek,
        source: 'custom',
        slots: customSlots.map((s) => {
          const dur = s.slotDuration ?? 15;
          const sType = s.schedulingType ?? SchedulingType.STREAM;
          const winMins = toMinutes(s.endTime) - toMinutes(s.startTime);
          const effectiveDur =
            sType === SchedulingType.WAVE && winMins > 0 && dur > winMins ? winMins : dur;
          let effectiveMaxPatients =
            s.maxPatients ?? (sType === SchedulingType.WAVE ? 3 : 10);
          if (sType === SchedulingType.WAVE && winMins > 0 && dur > winMins) {
            effectiveMaxPatients = Math.max(
              1,
              Math.round(((s.maxPatients || 3) * winMins) / dur),
            );
          }

          let dividedSlots: Array<{
            startTime: string;
            endTime: string;
            status: SlotStatus;
            maxPatients?: number;
            bookedCount?: number;
            availableCount?: number;
          }> = [];

          if (sType === SchedulingType.WAVE) {
            const waveSlots = this.divideIntoSlots(
              s.startTime,
              s.endTime,
              effectiveDur,
              s.bufferTime ?? 0,
            );
            const maxPatients = effectiveMaxPatients;
            dividedSlots = waveSlots.map((ws) => {
              const bookedCount = appointments.filter(
                (app) =>
                  app.startTime === ws.startTime &&
                  app.endTime === ws.endTime &&
                  isApptActivelyBlocking(app),
              ).length;
              const availableCount = Math.max(0, maxPatients - bookedCount);
              const status =
                availableCount > 0 ? SlotStatus.AVAILABLE : SlotStatus.BOOKED;
              return {
                startTime: ws.startTime,
                endTime: ws.endTime,
                status,
                maxPatients,
                bookedCount,
                availableCount,
              };
            });
          } else {
            const maxPatients = s.maxPatients || 10;
            const bookedCount = appointments.filter((app) => {
              if (!isApptActivelyBlocking(app)) return false;
              const appStart = toMinutes(app.startTime);
              const appEnd = toMinutes(app.endTime);
              const slotStart = toMinutes(s.startTime);
              const slotEnd = toMinutes(s.endTime);
              return appStart >= slotStart && appEnd <= slotEnd;
            }).length;
            const availableCount = Math.max(0, maxPatients - bookedCount);
            const status =
              availableCount > 0 ? SlotStatus.AVAILABLE : SlotStatus.BOOKED;
            dividedSlots = [
              {
                startTime: s.startTime,
                endTime: s.endTime,
                status,
                maxPatients,
                bookedCount,
                availableCount,
              },
            ];
          }

          const slotObj: any = {
            startTime: s.startTime,
            endTime: s.endTime,
            schedulingType: sType,
            dividedSlots,
            slotDuration: effectiveDur,
            bufferTime: s.bufferTime ?? 0,
            maxPatients: effectiveMaxPatients,
          };

          return slotObj;
        }),
      };
    }

    const recurringSlots = await this.recurringRepo.find({
      where: { doctorId, dayOfWeek },
      order: { startTime: 'ASC' },
    });

    if (recurringSlots.length > 0) {
      return {
        date: cleanDate,
        dayOfWeek,
        source: 'recurring',
        slots: recurringSlots.map((s) => {
          const dur = s.slotDuration ?? 15;
          const sType = s.schedulingType ?? SchedulingType.STREAM;
          const winMins = toMinutes(s.endTime) - toMinutes(s.startTime);
          const effectiveDur =
            sType === SchedulingType.WAVE && winMins > 0 && dur > winMins ? winMins : dur;
          let effectiveMaxPatients =
            s.maxPatients ?? (sType === SchedulingType.WAVE ? 3 : 10);
          if (sType === SchedulingType.WAVE && winMins > 0 && dur > winMins) {
            effectiveMaxPatients = Math.max(
              1,
              Math.round(((s.maxPatients || 3) * winMins) / dur),
            );
          }

          let dividedSlots: Array<{
            startTime: string;
            endTime: string;
            status: SlotStatus;
            maxPatients?: number;
            bookedCount?: number;
            availableCount?: number;
          }> = [];

          if (sType === SchedulingType.WAVE) {
            const waveSlots = this.divideIntoSlots(
              s.startTime,
              s.endTime,
              effectiveDur,
              s.bufferTime ?? 0,
            );
            const maxPatients = effectiveMaxPatients;
            dividedSlots = waveSlots.map((ws) => {
              const bookedCount = appointments.filter(
                (app) =>
                  app.startTime === ws.startTime &&
                  app.endTime === ws.endTime &&
                  isApptActivelyBlocking(app),
              ).length;
              const availableCount = Math.max(0, maxPatients - bookedCount);
              const status =
                availableCount > 0 ? SlotStatus.AVAILABLE : SlotStatus.BOOKED;
              return {
                startTime: ws.startTime,
                endTime: ws.endTime,
                status,
                maxPatients,
                bookedCount,
                availableCount,
              };
            });
          } else {
            const maxPatients = s.maxPatients || 10;
            const bookedCount = appointments.filter((app) => {
              if (!isApptActivelyBlocking(app)) return false;
              const appStart = toMinutes(app.startTime);
              const appEnd = toMinutes(app.endTime);
              const slotStart = toMinutes(s.startTime);
              const slotEnd = toMinutes(s.endTime);
              return appStart >= slotStart && appEnd <= slotEnd;
            }).length;
            const availableCount = Math.max(0, maxPatients - bookedCount);
            const status =
              availableCount > 0 ? SlotStatus.AVAILABLE : SlotStatus.BOOKED;
            dividedSlots = [
              {
                startTime: s.startTime,
                endTime: s.endTime,
                status,
                maxPatients,
                bookedCount,
                availableCount,
              },
            ];
          }

          const slotObj: any = {
            startTime: s.startTime,
            endTime: s.endTime,
            schedulingType: sType,
            dividedSlots,
            slotDuration: effectiveDur,
            bufferTime: s.bufferTime ?? 0,
            maxPatients: effectiveMaxPatients,
          };

          return slotObj;
        }),
      };
    }

    return {
      date: cleanDate,
      dayOfWeek,
      source: 'none',
      slots: [],
    };
  }

  private divideIntoSlots(
    startTime: string,
    endTime: string,
    durationMinutes: number,
    bufferTime: number = 0,
  ): Array<{ startTime: string; endTime: string }> {
    const slots: Array<{ startTime: string; endTime: string }> = [];
    let startMin = toMinutes(startTime);
    const endMin = toMinutes(endTime);

    const totalSpan = endMin - startMin;
    if (totalSpan <= 0) return slots;

    // Resilience Guard: If shift window is shorter than durationMinutes (e.g. 30m window but 60m duration set),
    // clamp duration to totalSpan so at least one valid slot covers the doctor's shift!
    const effectiveDuration =
      durationMinutes > totalSpan && totalSpan > 0
        ? totalSpan
        : durationMinutes > 0
        ? durationMinutes
        : 15;

    while (startMin + effectiveDuration <= endMin) {
      slots.push({
        startTime: toTimeString(startMin),
        endTime: toTimeString(startMin + effectiveDuration),
      });
      startMin += effectiveDuration + bufferTime;
    }

    return slots;
  }

  private assignStatusToDividedSlots(
    dividedSlots: Array<{ startTime: string; endTime: string }>,
    appointments: Appointment[],
    dateStr: string,
  ): Array<{ startTime: string; endTime: string; status: SlotStatus }> {
    return dividedSlots.map((slot) => {
      const slotStart = toMinutes(slot.startTime);
      const slotEnd = toMinutes(slot.endTime);

      const overlapping = appointments.filter((app) => {
        const appStart = toMinutes(app.startTime);
        const appEnd = toMinutes(app.endTime);
        return slotStart < appEnd && appStart < slotEnd;
      });

      const bookedApp = overlapping.find(
        (a) => isApptActivelyBlocking(a),
      );
      if (bookedApp) return { ...slot, status: SlotStatus.BOOKED };

      const cancelledApp = overlapping.find((a) => a.status === AppointmentStatus.CANCELLED);
      if (cancelledApp) {
        const slotStartDate = new Date(`${dateStr}T${slot.startTime}:00`);
        const cancelDate = cancelledApp.updatedAt;
        const diffMinutes =
          (slotStartDate.getTime() - cancelDate.getTime()) / 60000;
        if (diffMinutes >= 5) {
          return { ...slot, status: SlotStatus.CANCEL_AND_AVAILABLE };
        }
      }
      return { ...slot, status: SlotStatus.AVAILABLE };
    });
  }

  private async findDoctorByUserIdOrFail(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { userId } });
    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found. Please create your profile first.',
      );
    }
    return doctor;
  }

  private async findRecurringSlotOrFail(
    id: string,
    doctorId: string,
  ): Promise<RecurringAvailability> {
    const slot = await this.recurringRepo.findOne({
      where: { id, doctorId },
    });
    if (!slot) {
      throw new NotFoundException(
        `Recurring availability slot with ID ${id} not found`,
      );
    }
    return slot;
  }

  private validateTimeRange(startTime: string, endTime: string): void {
    if (toMinutes(startTime) >= toMinutes(endTime)) {
      throw new BadRequestException(
        `endTime (${endTime}) must be after startTime (${startTime})`,
      );
    }
  }

  private validateDateNotPast(date: string): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inputDate = new Date(date + 'T00:00:00');
    if (inputDate < today) {
      throw new BadRequestException(`date (${date}) cannot be in the past`);
    }
  }
  private validateSchedulingConfig(
    schedulingType: SchedulingType,
    dto: { slotDuration?: number; bufferTime?: number; maxPatients?: number },
  ): void {
    if (schedulingType === SchedulingType.WAVE) {
      if (dto.slotDuration !== undefined && dto.slotDuration <= 0) {
        throw new BadRequestException(
          'slotDuration must be a positive integer for WAVE scheduling',
        );
      }
      if (dto.maxPatients !== undefined && dto.maxPatients <= 0) {
        throw new BadRequestException(
          'maxPatients must be at least 1 for WAVE scheduling',
        );
      }
      if (dto.bufferTime !== undefined && dto.bufferTime < 0) {
        throw new BadRequestException('bufferTime cannot be negative');
      }
    }
    if (schedulingType === SchedulingType.STREAM) {
      if (dto.maxPatients !== undefined && dto.maxPatients <= 0) {
        throw new BadRequestException(
          'maxPatients must be at least 1 for STREAM scheduling',
        );
      }
      if (dto.bufferTime !== undefined && dto.bufferTime < 0) {
        throw new BadRequestException('bufferTime cannot be negative');
      }
      if (dto.slotDuration !== undefined && dto.slotDuration <= 0) {
        throw new BadRequestException(
          'slotDuration must be a positive integer',
        );
      }
    }
  }

  private checkRecurringOverlap(
    existingSlots: RecurringAvailability[],
    startTime: string,
    endTime: string,
  ): void {
    for (const slot of existingSlots) {
      if (timesOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
        throw new ConflictException(
          `Time slot ${startTime}–${endTime} overlaps with existing slot ${slot.startTime}–${slot.endTime}`,
        );
      }
    }
  }

  private checkCustomOverlap(
    existingSlots: CustomAvailability[],
    startTime: string,
    endTime: string,
  ): void {
    for (const slot of existingSlots) {
      if (timesOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
        throw new ConflictException(
          `Time slot ${startTime}–${endTime} overlaps with existing slot ${slot.startTime}–${slot.endTime}`,
        );
      }
    }
  }

  async getDoctorIntervalsForDate(
    doctorId: string,
    dateStr: string,
  ): Promise<Array<{ startTime: string; endTime: string; slotDuration?: number }>> {
    const cleanDate = dateStr.trim();
    const dayOfWeek = getDayOfWeekFromDate(cleanDate);

    // 1. Check custom overrides first
    const customSlots = await this.customRepo.find({
      where: { doctorId, date: cleanDate },
      order: { startTime: 'ASC' },
    });

    if (customSlots.length > 0) {
      // Filter out blockout slots (00:00 - 00:00)
      return customSlots
        .filter((s) => !(s.startTime === '00:00' && s.endTime === '00:00'))
        .map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          slotDuration: s.slotDuration,
        }));
    }

    // 2. Fall back to recurring availability
    const recurringSlots = await this.recurringRepo.find({
      where: { doctorId, dayOfWeek },
      order: { startTime: 'ASC' },
    });

    return recurringSlots.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      slotDuration: s.slotDuration,
    }));
  }

  async getAvailableSlots(
    doctorId: string,
    dateStr: string,
    durationInput?: number,
  ): Promise<
    Array<{
      startTime: string;
      endTime: string;
      status: SlotStatus;
      schedulingType: SchedulingType;
      bufferTime?: number;
      maxPatients?: number;
      bookedCount?: number;
      availableCount?: number;
    }>
  > {
    const cleanDate = dateStr.trim();

    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(cleanDate)) {
      throw new BadRequestException(
        'Invalid date format. Expected YYYY-MM-DD.',
      );
    }

    const parsed = Date.parse(`${cleanDate}T00:00:00`);
    if (isNaN(parsed)) {
      throw new BadRequestException('Invalid date');
    }

    const duration = durationInput ?? 15;
    if (duration <= 0 || !Number.isInteger(duration)) {
      throw new BadRequestException('Invalid duration');
    }

    const doctor = await this.doctorRepo.findOne({
      where: [{ id: doctorId }, { userId: doctorId }],
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${doctorId} not found`);
    }

    // ── Doctor leave check ──────────────────────────────────────────────────
    const leaveRecord = await this.leaveRepo.findOne({
      where: { doctorId: doctor.id, date: cleanDate },
    });
    if (leaveRecord) {
      const emptySlots: any = [];
      emptySlots.onLeave = true;
      emptySlots.message = 'Doctor is on leave';
      return emptySlots;
    }

    // Validate booking date against doctor's future-booking configuration
    await this.validateFutureBookingConfig(doctor, cleanDate);

    const todayStr = getTodayIST();
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

    const dayOfWeek = getDayOfWeekFromDate(cleanDate);

    let intervals: Array<{
      startTime: string;
      endTime: string;
      slotDuration: number;
      schedulingType: SchedulingType;
      bufferTime: number;
      maxPatients: number;
    }> = [];

    const customSlots = await this.customRepo.find({
      where: { doctorId: doctor.id, date: cleanDate },
      order: { startTime: 'ASC' },
    });

    if (customSlots.length > 0) {
      intervals = customSlots
        .filter((s) => !(s.startTime === '00:00' && s.endTime === '00:00'))
        .map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          slotDuration: s.slotDuration ?? 15,
          schedulingType: s.schedulingType ?? SchedulingType.STREAM,
          bufferTime: s.bufferTime ?? 0,
          maxPatients: s.maxPatients ?? 0,
        }));
    } else {
      const recurringSlots = await this.recurringRepo.find({
        where: { doctorId: doctor.id, dayOfWeek },
        order: { startTime: 'ASC' },
      });

      if (recurringSlots.length > 0) {
        intervals = recurringSlots.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          slotDuration: s.slotDuration ?? 15,
          schedulingType: s.schedulingType ?? SchedulingType.STREAM,
          bufferTime: s.bufferTime ?? 0,
          maxPatients: s.maxPatients ?? 0,
        }));
      }
    }

    if (intervals.length === 0) {
      const emptySlots: any = [];
      emptySlots.message = 'No availability found for this doctor on the selected date';
      return emptySlots;
    }

    const candidateSlots: Array<{
      startTime: string;
      endTime: string;
      schedulingType: SchedulingType;
      bufferTime?: number;
      maxPatients?: number;
    }> = [];
    for (const interval of intervals) {
      if (interval.schedulingType === SchedulingType.WAVE) {
        const slotDur = durationInput ?? interval.slotDuration ?? 30;
        const winMins = toMinutes(interval.endTime) - toMinutes(interval.startTime);
        const effectiveDur =
          winMins > 0 && slotDur > winMins ? winMins : slotDur;
        const generated = this.divideIntoSlots(
          interval.startTime,
          interval.endTime,
          effectiveDur,
          interval.bufferTime ?? 0,
        );
        let waveCapacity =
          interval.maxPatients && interval.maxPatients > 0 ? interval.maxPatients : 3;
        if (winMins > 0 && slotDur > winMins) {
          waveCapacity = Math.max(
            1,
            Math.round((waveCapacity * winMins) / slotDur),
          );
        }
        for (const slot of generated) {
          candidateSlots.push({
            ...slot,
            schedulingType: SchedulingType.WAVE,
            bufferTime: interval.bufferTime ?? 0,
            maxPatients: waveCapacity,
          });
        }
      } else {
        // STREAM scheduling: continuous session window with configurable capacity
        const streamCapacity = interval.maxPatients && interval.maxPatients > 0 ? interval.maxPatients : 10;
        candidateSlots.push({
          startTime: interval.startTime,
          endTime: interval.endTime,
          schedulingType: SchedulingType.STREAM,
          bufferTime: interval.bufferTime ?? 0,
          maxPatients: streamCapacity,
        });
      }
    }

    let futureSlots = candidateSlots;
    if (cleanDate === todayStr) {
      const currentTimeInMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();

      futureSlots = candidateSlots.filter(
        (slot) =>
          slot.schedulingType === SchedulingType.STREAM
            ? toMinutes(slot.endTime) > currentTimeInMinutes
            : toMinutes(slot.startTime) > currentTimeInMinutes,
      );
    }

    const appointments = await this.appointmentRepo.find({
      where: { doctorId: doctor.id, date: cleanDate },
    });

    let pendingReschedules: AppointmentRescheduleRequest[] = [];
    if (this.rescheduleRequestRepo) {
      try {
        pendingReschedules = await this.rescheduleRequestRepo.find({
          where: {
            doctorId: doctor.id,
            proposedDate: cleanDate,
            status: RescheduleRequestStatus.PENDING,
          },
        });
        const nowTime = new Date().getTime();
        pendingReschedules = pendingReschedules.filter(
          (r) => new Date(r.expiresAt).getTime() > nowTime,
        );
      } catch {
        pendingReschedules = [];
      }
    }

    const resultSlots = futureSlots.map((slot) => {
      if (slot.schedulingType === SchedulingType.WAVE) {
        const apptBookedCount = appointments.filter(
          (app) =>
            app.startTime === slot.startTime &&
            app.endTime === slot.endTime &&
            isApptActivelyBlocking(app),
        ).length;

        const reservedCount = pendingReschedules.filter(
          (r) => r.proposedStartTime === slot.startTime && r.proposedEndTime === slot.endTime,
        ).length;

        const bookedCount = apptBookedCount + reservedCount;
        const maxPatients = slot.maxPatients || 3;
        const availableCount = Math.max(0, maxPatients - bookedCount);
        const status =
          availableCount > 0 ? SlotStatus.AVAILABLE : SlotStatus.BOOKED;

        return {
          ...slot,
          status,
          bookedCount,
          availableCount,
        };
      }

      // STREAM scheduling: session capacity check
      const apptBookedCount = appointments.filter((app) => {
        if (!isApptActivelyBlocking(app)) return false;
        const appStart = toMinutes(app.startTime);
        const appEnd = toMinutes(app.endTime);
        const slotStart = toMinutes(slot.startTime);
        const slotEnd = toMinutes(slot.endTime);
        return appStart >= slotStart && appEnd <= slotEnd;
      }).length;

      const reservedCount = pendingReschedules.filter((r) => {
        const rStart = toMinutes(r.proposedStartTime);
        const rEnd = toMinutes(r.proposedEndTime);
        const slotStart = toMinutes(slot.startTime);
        const slotEnd = toMinutes(slot.endTime);
        return rStart < slotEnd && slotStart < rEnd;
      }).length;

      const bookedCount = apptBookedCount + reservedCount;
      const maxPatients = slot.maxPatients || 10;
      const availableCount = Math.max(0, maxPatients - bookedCount);
      const status =
        availableCount > 0 ? SlotStatus.AVAILABLE : SlotStatus.BOOKED;

      return {
        ...slot,
        status,
        bookedCount,
        availableCount,
      };
    });

    if (resultSlots.length === 0) {
      const emptySlots: any = [];
      if (candidateSlots.length > 0) {
        emptySlots.message = 'All consultation slots for today have already elapsed';
      } else {
        emptySlots.message = 'No slots found for this doctor on the selected date';
      }
      return emptySlots;
    }

    return resultSlots;
  }

  /**
   * Retrieves the configured capacity (maxPatients) and scheduling type for a specific slot window.
   * Checks custom date overrides first, then falls back to recurring availability.
   */
  async getSlotCapacity(
    doctorId: string,
    dateStr: string,
    startTime: string,
    endTime: string,
  ): Promise<{ maxPatients: number; schedulingType: SchedulingType }> {
    const cleanDate = dateStr.trim();
    const dayOfWeek = getDayOfWeekFromDate(cleanDate);

    const doctor = await this.doctorRepo.findOne({
      where: [{ id: doctorId }, { userId: doctorId }],
    });
    const resolvedDoctorId = doctor ? doctor.id : doctorId;

    const startMin = toMinutes(startTime);
    const endMin = toMinutes(endTime);

    // 1. Check custom overrides for this date
    const customSlots = await this.customRepo.find({
      where: { doctorId: resolvedDoctorId, date: cleanDate },
      order: { startTime: 'ASC' },
    });

    if (customSlots.length > 0) {
      const match = customSlots.find(
        (s) =>
          toMinutes(s.startTime) <= startMin && toMinutes(s.endTime) >= endMin,
      );
      if (match) {
        const type = match.schedulingType ?? SchedulingType.STREAM;
        const capacity =
          match.maxPatients && match.maxPatients > 0
            ? match.maxPatients
            : type === SchedulingType.WAVE
            ? 3
            : 10;
        return { maxPatients: capacity, schedulingType: type };
      }
    }

    // 2. Check recurring availability for this day of week
    const recurringSlots = await this.recurringRepo.find({
      where: { doctorId: resolvedDoctorId, dayOfWeek },
      order: { startTime: 'ASC' },
    });

    if (recurringSlots.length > 0) {
      const match = recurringSlots.find(
        (s) =>
          toMinutes(s.startTime) <= startMin && toMinutes(s.endTime) >= endMin,
      );
      if (match) {
        const type = match.schedulingType ?? SchedulingType.STREAM;
        const capacity =
          match.maxPatients && match.maxPatients > 0
            ? match.maxPatients
            : type === SchedulingType.WAVE
            ? 3
            : 10;
        return { maxPatients: capacity, schedulingType: type };
      }
    }

    return { maxPatients: 1, schedulingType: SchedulingType.STREAM };
  }


  async findNextAvailableSlot(
    doctorId: string,
    fromDate: string,
    excludeStartTime?: string,
    excludeEndTime?: string,
  ): Promise<{
    date: string;
    startTime: string;
    endTime: string;
    schedulingType: string;
    maxPatients?: number;
    bookedCount?: number;
    availableCount?: number;
  } | null> {
    const startDate = new Date(fromDate + 'T00:00:00');

    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = `${currentDate.getFullYear()}-${(
        currentDate.getMonth() + 1
      )
        .toString()
        .padStart(
          2,
          '0',
        )}-${currentDate.getDate().toString().padStart(2, '0')}`;

      try {
        const slots = await this.getAvailableSlots(doctorId, dateStr);
        for (const slot of slots) {

          if (
            dateStr === fromDate &&
            excludeStartTime &&
            excludeEndTime &&
            slot.startTime === excludeStartTime &&
            slot.endTime === excludeEndTime
          ) {
            continue;
          }

          const validStatuses: string[] = [
            SlotStatus.AVAILABLE,
            SlotStatus.CANCEL_AND_AVAILABLE,
          ];

          if (validStatuses.includes(slot.status)) {
            const result: {
              date: string;
              startTime: string;
              endTime: string;
              schedulingType: string;
              maxPatients?: number;
              bookedCount?: number;
              availableCount?: number;
            } = {
              date: dateStr,
              startTime: slot.startTime,
              endTime: slot.endTime,
              schedulingType: slot.schedulingType,
            };

            if (slot.schedulingType === SchedulingType.WAVE || slot.schedulingType === SchedulingType.STREAM) {
              result.maxPatients = slot.maxPatients;
              result.bookedCount = slot.bookedCount;
              result.availableCount = slot.availableCount;
            }

            return result;
          }
        }
      } catch {

        continue;
      }
    }

    return null;
  }


  async getNextAvailableAppointment(
    doctorId: string,
    searchWindow: number = 30,
  ): Promise<{
    doctorId: string;
    searchedFromDate: string;
    todayAvailable: boolean;
    nextAvailableDate: string | null;
    dayOfWeek: string | null;
    schedulingType: string | null;
    availableSlots: Array<{
      startTime: string;
      endTime: string;
      status: string;
      schedulingType: string;
      maxPatients?: number;
      bookedCount?: number;
      availableCount?: number;
    }>;
    message: string;
  }> {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${doctorId} not found`);
    }


    const todayStr = getTodayIST();
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));


    const recurringSlots = await this.recurringRepo.find({
      where: { doctorId },
    });


    if (recurringSlots.length === 0) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 60);
      const maxDateStr = `${maxDate.getFullYear()}-${(maxDate.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${maxDate.getDate().toString().padStart(2, '0')}`;

      const customOverrides = await this.customRepo
        .createQueryBuilder('ca')
        .where('ca.doctorId = :doctorId', { doctorId })
        .andWhere('ca.date >= :start', { start: todayStr })
        .andWhere('ca.date <= :end', { end: maxDateStr })
        .andWhere(
          'NOT (ca.startTime = :blockStart AND ca.endTime = :blockEnd)',
          { blockStart: '00:00', blockEnd: '00:00' },
        )
        .getCount();

      if (customOverrides === 0) {
        return {
          doctorId,
          searchedFromDate: todayStr,
          todayAvailable: false,
          nextAvailableDate: null,
          dayOfWeek: null,
          schedulingType: null,
          availableSlots: [],
          message: 'Doctor has no configured schedule. No appointments available.',
        };
      }
    }


    const workingDays = new Set<string>(
      recurringSlots.map((s) => s.dayOfWeek),
    );


    const todayResult = await this.checkDayAvailability(
      doctorId,
      todayStr,
    );

    if (todayResult.hasAvailableSlots) {

      const types = new Set(
        todayResult.slots.map((s) => s.schedulingType),
      );
      const schedulingType =
        types.size > 1 ? 'MIXED' : types.values().next().value || 'STREAM';

      return {
        doctorId,
        searchedFromDate: todayStr,
        todayAvailable: true,
        nextAvailableDate: todayStr,
        dayOfWeek: getDayOfWeekFromDate(todayStr),
        schedulingType,
        availableSlots: todayResult.slots,
        message: 'Slots are available today',
      };
    }


    let workingDaysSearched = 0;
    let calendarDaysSearched = 0;
    const maxCalendarDays = searchWindow * 3;

    while (
      workingDaysSearched < searchWindow &&
      calendarDaysSearched < maxCalendarDays
    ) {
      calendarDaysSearched++;
      const candidateDate = new Date(now);
      candidateDate.setDate(now.getDate() + calendarDaysSearched);
      const candidateDateStr = `${candidateDate.getFullYear()}-${(
        candidateDate.getMonth() + 1
      )
        .toString()
        .padStart(2, '0')}-${candidateDate
          .getDate()
          .toString()
          .padStart(2, '0')}`;

      const candidateDayOfWeek = getDayOfWeekFromDate(candidateDateStr);
      const hasCustomOverride = await this.customRepo.findOne({
        where: { doctorId, date: candidateDateStr },
      });

      if (!workingDays.has(candidateDayOfWeek) && !hasCustomOverride) {
        continue;
      }

      if (hasCustomOverride) {
        const blockout = await this.customRepo.findOne({
          where: {
            doctorId,
            date: candidateDateStr,
            startTime: '00:00',
            endTime: '00:00',
          },
        });
        if (blockout) {
          workingDaysSearched++;
          continue;
        }
      }
      workingDaysSearched++;

      // Check availability for this day
      const dayResult = await this.checkDayAvailability(
        doctorId,
        candidateDateStr,
      );

      if (dayResult.hasAvailableSlots) {
        const types = new Set(
          dayResult.slots.map((s) => s.schedulingType),
        );
        const schedulingType =
          types.size > 1 ? 'MIXED' : types.values().next().value || 'STREAM';

        return {
          doctorId,
          searchedFromDate: todayStr,
          todayAvailable: false,
          nextAvailableDate: candidateDateStr,
          dayOfWeek: candidateDayOfWeek,
          schedulingType,
          availableSlots: dayResult.slots,
          message: `Next available appointment is on ${candidateDateStr} (${candidateDayOfWeek})`,
        };
      }
    }


    return {
      doctorId,
      searchedFromDate: todayStr,
      todayAvailable: false,
      nextAvailableDate: null,
      dayOfWeek: null,
      schedulingType: null,
      availableSlots: [],
      message: `No appointments available in the next ${searchWindow} working days. Please try again later.`,
    };
  }


  private async checkDayAvailability(
    doctorId: string,
    dateStr: string,
  ): Promise<{
    hasAvailableSlots: boolean;
    slots: Array<{
      startTime: string;
      endTime: string;
      status: string;
      schedulingType: string;
      maxPatients?: number;
      bookedCount?: number;
      availableCount?: number;
    }>;
  }> {
    try {
      const allSlots = await this.getAvailableSlots(doctorId, dateStr);

      const validStatuses: string[] = [
        SlotStatus.AVAILABLE,
        SlotStatus.CANCEL_AND_AVAILABLE,
      ];

      const availableSlots = allSlots
        .filter((slot) => validStatuses.includes(slot.status))
        .map((slot) => {
          const result: {
            startTime: string;
            endTime: string;
            status: string;
            schedulingType: string;
            maxPatients?: number;
            bookedCount?: number;
            availableCount?: number;
          } = {
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: slot.status,
            schedulingType: slot.schedulingType,
          };

          if (slot.schedulingType === SchedulingType.WAVE || slot.schedulingType === SchedulingType.STREAM) {
            result.maxPatients = slot.maxPatients;
            result.bookedCount = slot.bookedCount;
            result.availableCount = slot.availableCount;
          }

          return result;
        });

      return {
        hasAvailableSlots: availableSlots.length > 0,
        slots: availableSlots,
      };
    } catch {
      return {
        hasAvailableSlots: false,
        slots: [],
      };
    }
  }
  /**
   * Check if a doctor has an active approved leave on a given date.
   */
  async isDoctorOnLeave(doctorId: string, date: string): Promise<boolean> {
    const leaveRecord = await this.leaveRepo.findOne({
      where: { doctorId, date },
    });
    return !!leaveRecord;
  }

  /**
   * Validates that the requested booking date is within the doctor's
   * allowed future booking window and that the doctor is not on leave.
   *
   * Rules:
   *   - Past date              → rejected
   *   - Doctor is on leave     → rejected
   *   - allowFutureBooking = false → only today is accepted
   *   - allowFutureBooking = true  → up to maxFutureBookingDays (default 7) from today
   *   - maxFutureBookingDays < 0   → configuration is invalid
   */
  async validateFutureBookingConfig(doctor: Doctor, date: string): Promise<void> {
    const todayStr = getTodayIST();

    if (date < todayStr) {
      throw new BadRequestException('Cannot book an appointment for a past date');
    }

    if (!doctor.allowFutureBooking) {
      if (date > todayStr) {
        throw new BadRequestException(
          'This doctor does not accept future appointments. Appointments can only be booked for today.',
        );
      }
      return; // today is always allowed
    }

    // allowFutureBooking === true
    const configuredDays = doctor.maxFutureBookingDays;

    if (configuredDays !== null && configuredDays !== undefined && configuredDays < 0) {
      throw new BadRequestException(
        'Invalid doctor availability configuration: maxFutureBookingDays cannot be negative',
      );
    }

    const maxDays = (configuredDays !== null && configuredDays !== undefined) ? configuredDays : 7;
    const maxDateStr = getMaxFutureDateIST(maxDays);

    if (date > maxDateStr) {
      throw new BadRequestException(
        `Booking date exceeds the allowed future booking range. You can book up to ${maxDays} day(s) in advance (until ${maxDateStr}).`,
      );
    }
  }

  async updateAvailabilityConfig(
    userId: string,
    dto: UpdateAvailabilityConfigDto,
  ): Promise<{ allowFutureBooking: boolean; maxFutureBookingDays: number | null }> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);

    if (dto.allowFutureBooking !== undefined) {
      doctor.allowFutureBooking = dto.allowFutureBooking;
    }

    if (dto.maxFutureBookingDays !== undefined) {
      if (dto.maxFutureBookingDays !== null && dto.maxFutureBookingDays < 0) {
        throw new BadRequestException(
          'maxFutureBookingDays cannot be negative',
        );
      }
      doctor.maxFutureBookingDays = dto.maxFutureBookingDays;
    }

    const saved = await this.doctorRepo.save(doctor);
    return {
      allowFutureBooking: saved.allowFutureBooking,
      maxFutureBookingDays: saved.maxFutureBookingDays,
    };
  }
}
