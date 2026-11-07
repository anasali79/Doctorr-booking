import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ElasticSchedulingService } from './elastic-scheduling.service';
import { Doctor } from './entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { RecurringAvailability, DayOfWeek } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { DoctorLeave } from './entities/leave.entity';
import { AppointmentRescheduleRequest } from '../appointment/entities/appointment-reschedule-request.entity';
import { AvailabilityService } from './availability.service';
import { QueueService } from '../appointment/queue.service';
import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';
import { ReminderService } from '../reminder/reminder.service';
import { NotificationDispatcher } from '../notification/notification.dispatcher';
import { AppointmentGateway } from '../sockets/appointment.gateway';

import { ShiftType } from './dto/elastic-scheduling.dto';
import { SchedulingType } from '../common/enums/scheduling-type.enum';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { RescheduleRequestStatus } from '../appointment/enums/reschedule-request-status.enum';
import { RescheduleMethod } from '../appointment/enums/reschedule-method.enum';

describe('ElasticSchedulingService', () => {
  let service: ElasticSchedulingService;

  const mockDoctor: Doctor = {
    id: 'doc-uuid-1',
    userId: 'user-doc-1',
    fullName: 'Dr. Gregory House',
    specialization: 'Diagnostic Medicine',
    experience: 15,
    qualification: 'MD',
    consultationFee: 500,
    allowFutureBooking: true,
    maxFutureBookingDays: 14,
  } as any;

  const mockPatient: Patient = {
    id: 'pat-uuid-1',
    userId: 'user-pat-1',
    fullName: 'John Doe',
    phone: '+919876543210',
    user: { id: 'user-pat-1', email: 'john@example.com' } as any,
  } as any;

  const mockRecurringShift: RecurringAvailability = {
    id: 'rec-shift-1',
    doctorId: 'doc-uuid-1',
    dayOfWeek: DayOfWeek.MONDAY,
    startTime: '10:00',
    endTime: '12:00',
    slotDuration: 30,
    schedulingType: SchedulingType.WAVE,
    bufferTime: 0,
    maxPatients: 3,
  } as any;

  const mockCustomShift: CustomAvailability = {
    id: 'custom-shift-1',
    doctorId: 'doc-uuid-1',
    date: '2026-11-16',
    startTime: '10:00',
    endTime: '13:00',
    slotDuration: 15,
    schedulingType: SchedulingType.STREAM,
    bufferTime: 0,
    maxPatients: 10,
  } as any;

  let doctorRepoMock: any;
  let patientRepoMock: any;
  let appointmentRepoMock: any;
  let recurringRepoMock: any;
  let customRepoMock: any;
  let leaveRepoMock: any;
  let rescheduleRepoMock: any;
  let availabilityServiceMock: any;
  let queueServiceMock: any;
  let notificationServiceMock: any;
  let paymentServiceMock: any;
  let dataSourceMock: any;

  beforeEach(async () => {
    doctorRepoMock = {
      findOne: jest.fn().mockResolvedValue({ ...mockDoctor }),
    };

    patientRepoMock = {
      findOne: jest.fn().mockResolvedValue({ ...mockPatient }),
    };

    appointmentRepoMock = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((a) => Promise.resolve({ ...a, id: a.id || 'appt-saved-id' })),
    };

    recurringRepoMock = {
      findOne: jest.fn().mockResolvedValue({ ...mockRecurringShift }),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
    };

    customRepoMock = {
      findOne: jest.fn().mockResolvedValue({ ...mockCustomShift }),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
    };

    leaveRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    rescheduleRepoMock = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'req-uuid-1' })),
      save: jest.fn().mockImplementation((r) => Promise.resolve({ ...r, id: r.id || 'req-uuid-1' })),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    availabilityServiceMock = {
      getAvailableSlots: jest.fn().mockResolvedValue([
        {
          startTime: '09:00',
          endTime: '09:30',
          status: 'available',
          schedulingType: SchedulingType.WAVE,
          maxPatients: 3,
          bookedCount: 0,
          availableCount: 3,
        },
        {
          startTime: '10:00',
          endTime: '10:30',
          status: 'available',
          schedulingType: SchedulingType.WAVE,
          maxPatients: 3,
          bookedCount: 0,
          availableCount: 3,
        },
      ]),
    };

    queueServiceMock = {
      recalculateQueue: jest.fn().mockResolvedValue(undefined),
    };

    notificationServiceMock = {
      createDoctorNotification: jest.fn().mockResolvedValue({}),
      createNotification: jest.fn().mockResolvedValue({}),
    };

    paymentServiceMock = {
      createRefund: jest.fn().mockResolvedValue({ data: { refundId: 'rfnd_123', status: 'PROCESSED' } }),
    };

    const queryRunnerMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ max: '1' }),
        }),
      },
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElasticSchedulingService,
        { provide: getRepositoryToken(Doctor), useValue: doctorRepoMock },
        { provide: getRepositoryToken(Patient), useValue: patientRepoMock },
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepoMock },
        { provide: getRepositoryToken(RecurringAvailability), useValue: recurringRepoMock },
        { provide: getRepositoryToken(CustomAvailability), useValue: customRepoMock },
        { provide: getRepositoryToken(DoctorLeave), useValue: leaveRepoMock },
        { provide: getRepositoryToken(AppointmentRescheduleRequest), useValue: rescheduleRepoMock },
        { provide: AvailabilityService, useValue: availabilityServiceMock },
        { provide: QueueService, useValue: queueServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: PaymentService, useValue: paymentServiceMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: ReminderService, useValue: { scheduleAppointmentReminders: jest.fn() } },
        { provide: NotificationDispatcher, useValue: { dispatchAsync: jest.fn() } },
        { provide: AppointmentGateway, useValue: { emitAppointmentEvent: jest.fn() } },
      ],
    }).compile();

    service = module.get<ElasticSchedulingService>(ElasticSchedulingService);
  });

  describe('Phase 1: Elastic Schedule Expansion', () => {
    it('should successfully expand start time earlier and preserve existing slots', async () => {
      const result = await service.expandSchedule('user-doc-1', {
        shiftType: ShiftType.RECURRING,
        shiftId: 'rec-shift-1',
        newStartTime: '09:00',
        newEndTime: '12:00',
      });

      expect(result.expansion.startDelta).toEqual({ start: '09:00', end: '10:00' });
      expect(result.expansion.existingPreserved).toBe(true);
      expect(recurringRepoMock.save).toHaveBeenCalled();
      expect(notificationServiceMock.createDoctorNotification).toHaveBeenCalled();
    });

    it('should successfully expand end time later for custom shift', async () => {
      const result = await service.expandSchedule('user-doc-1', {
        shiftType: ShiftType.CUSTOM,
        shiftId: 'custom-shift-1',
        newStartTime: '10:00',
        newEndTime: '14:00',
      });

      expect(result.expansion.endDelta).toEqual({ start: '13:00', end: '14:00' });
      expect(result.expansion.existingPreserved).toBe(true);
      expect(customRepoMock.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if new time range does not extend existing boundaries', async () => {
      await expect(
        service.expandSchedule('user-doc-1', {
          shiftType: ShiftType.RECURRING,
          shiftId: 'rec-shift-1',
          newStartTime: '10:00',
          newEndTime: '12:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if doctor tries to shrink via expandSchedule', async () => {
      await expect(
        service.expandSchedule('user-doc-1', {
          shiftType: ShiftType.RECURRING,
          shiftId: 'rec-shift-1',
          newStartTime: '10:30',
          newEndTime: '12:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent expansion that overlaps with another shift on the same day', async () => {
      recurringRepoMock.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'other-shift-2',
            dayOfWeek: DayOfWeek.MONDAY,
            startTime: '08:00',
            endTime: '09:30',
          },
        ]),
      });

      await expect(
        service.expandSchedule('user-doc-1', {
          shiftType: ShiftType.RECURRING,
          shiftId: 'rec-shift-1',
          newStartTime: '09:00', // overlaps with 08:00-09:30
          newEndTime: '12:00',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Phase 2: Elastic Schedule Shrinking & Conflict Detection', () => {
    it('Case A: should shrink cleanly when there are no booked appointments', async () => {
      appointmentRepoMock.find.mockResolvedValue([]);

      const result = await service.applyShrink('user-doc-1', {
        shiftType: ShiftType.CUSTOM,
        shiftId: 'custom-shift-1',
        newStartTime: '10:00',
        newEndTime: '12:00', // clipped: 12:00 - 13:00
      });

      expect(result.message).toContain('completed successfully with zero conflicts');
      expect(customRepoMock.save).toHaveBeenCalled();
    });

    it('Case B: should detect conflicts and return summary without modifying appointments', async () => {
      const bookedAppt = {
        id: 'appt-conflict-1',
        doctorId: 'doc-uuid-1',
        patientId: 'pat-uuid-1',
        date: '2026-11-16',
        startTime: '12:15',
        endTime: '12:45',
        status: AppointmentStatus.CONFIRMED,
        paymentStatus: 'PAID',
        tokenNumber: 5,
        patient: { fullName: 'Alice Wonder', phone: '+919999999999' },
      };

      appointmentRepoMock.find.mockResolvedValue([bookedAppt]);

      const conflictCheck = await service.checkShrinkConflicts('user-doc-1', {
        shiftType: ShiftType.CUSTOM,
        shiftId: 'custom-shift-1',
        newStartTime: '10:00',
        newEndTime: '12:00',
      });

      expect(conflictCheck.hasConflicts).toBe(true);
      expect(conflictCheck.conflictCount).toBe(1);
      expect(conflictCheck.affectedAppointments[0].appointmentId).toBe('appt-conflict-1');
      expect(conflictCheck.affectedAppointments[0].patientName).toBe('Alice Wonder');

      // Attempting applyShrink without force should throw ConflictException
      await expect(
        service.applyShrink('user-doc-1', {
          shiftType: ShiftType.CUSTOM,
          shiftId: 'custom-shift-1',
          newStartTime: '10:00',
          newEndTime: '12:00',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Phase 4: Smart Rescheduling Algorithm', () => {
    it('should find replacement slots prioritizing same day, then next day, then future dates', async () => {
      const appt1 = {
        id: 'appt-1',
        doctorId: 'doc-uuid-1',
        patientId: 'pat-uuid-1',
        date: '2026-11-16',
        startTime: '12:00',
        endTime: '12:30',
        status: AppointmentStatus.CONFIRMED,
        tokenNumber: 3,
        patient: { fullName: 'Patient A', user: { id: 'u-1' } },
      };

      appointmentRepoMock.find.mockResolvedValue([appt1]);

      const preview = await service.smartReschedulePreview('user-doc-1', {
        appointmentIds: ['appt-1'],
      });

      expect(preview.totalAffected).toBe(1);
      expect(preview.proposals[0].found).toBe(true);
      expect(preview.proposals[0].priorityTier).toBe('SAME_DAY');
      expect(preview.proposals[0].proposedStartTime).toBe('09:00');
    });

    it('should approve smart proposals, reserve slots atomically and dispatch notifications', async () => {
      const qr = dataSourceMock.createQueryRunner();
      const mockAppt = {
        id: 'appt-1',
        doctorId: 'doc-uuid-1',
        patientId: 'pat-uuid-1',
        date: '2026-11-16',
        startTime: '12:00',
        endTime: '12:30',
        status: AppointmentStatus.CONFIRMED,
        patient: { fullName: 'Patient A', user: { id: 'u-1', email: 'a@example.com' } },
        doctor: { fullName: 'Dr. House' },
      };
      qr.manager.findOne.mockResolvedValue(mockAppt);
      appointmentRepoMock.findOne.mockResolvedValue(mockAppt);

      const approvalResult = await service.approveSmartReschedule('user-doc-1', {
        proposals: [
          {
            appointmentId: 'appt-1',
            proposedDate: '2026-11-16',
            proposedStartTime: '09:00',
            proposedEndTime: '09:30',
            proposedSchedulingType: SchedulingType.WAVE,
            doctorReason: 'Schedule adjustment',
          },
        ],
      });

      expect(approvalResult.count).toBe(1);
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(notificationServiceMock.createNotification).toHaveBeenCalled();
    });
  });

  describe('Phase 3: Manual Rescheduling', () => {
    it('should create a manual rescheduling request and temporarily reserve slot', async () => {
      const qr = dataSourceMock.createQueryRunner();
      appointmentRepoMock.findOne.mockResolvedValue({
        id: 'appt-manual-1',
        doctorId: 'doc-uuid-1',
        patientId: 'pat-uuid-1',
        date: '2026-11-16',
        startTime: '12:00',
        endTime: '12:30',
        status: AppointmentStatus.CONFIRMED,
        tokenNumber: 2,
        patient: { fullName: 'Bob', user: { id: 'u-2', email: 'bob@example.com' } },
        doctor: { fullName: 'Dr. House' },
      });

      const res = await service.manualReschedule('user-doc-1', {
        appointmentId: 'appt-manual-1',
        proposedDate: '2026-11-17',
        proposedStartTime: '10:00',
        proposedEndTime: '10:30',
        doctorReason: 'Manual clinic rescheduling',
      });

      expect(res.request.rescheduleMethod).toBe(RescheduleMethod.MANUAL);
      expect(res.request.status).toBe(RescheduleRequestStatus.PENDING);
      expect(qr.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('Phase 5: Patient Rescheduling Actions', () => {
    it('Accept: should confirm new slot, update appointment, and notify doctor & patient', async () => {
      const qr = dataSourceMock.createQueryRunner();
      const mockRequest = {
        id: 'req-accept-1',
        appointmentId: 'appt-1',
        patientId: 'pat-uuid-1',
        doctorId: 'doc-uuid-1',
        proposedDate: '2026-11-17',
        proposedStartTime: '10:00',
        proposedEndTime: '10:30',
        proposedTokenNumber: 4,
        status: RescheduleRequestStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        doctor: { fullName: 'Dr. House', user: { id: 'u-doc', email: 'house@example.com' } },
      };

      rescheduleRepoMock.findOne.mockResolvedValue(mockRequest);

      const mockAppt = {
        id: 'appt-1',
        doctorId: 'doc-uuid-1',
        patientId: 'pat-uuid-1',
        date: '2026-11-16',
        startTime: '12:00',
        endTime: '12:30',
        status: AppointmentStatus.CONFIRMED,
      };
      qr.manager.findOne.mockResolvedValue(mockAppt);

      const result = await service.patientAcceptReschedule('user-pat-1', 'req-accept-1', {
        notes: 'New time works great',
      });

      expect(result.appointment.date).toBe('2026-11-17');
      expect(result.appointment.startTime).toBe('10:00');
      expect(result.request.status).toBe(RescheduleRequestStatus.ACCEPTED);
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(notificationServiceMock.createDoctorNotification).toHaveBeenCalled();
    });

    it('Reject: should keep original appointment intact and notify doctor', async () => {
      const mockRequest = {
        id: 'req-reject-1',
        appointmentId: 'appt-1',
        patientId: 'pat-uuid-1',
        doctorId: 'doc-uuid-1',
        originalDate: '2026-11-16',
        originalStartTime: '12:00',
        status: RescheduleRequestStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        doctor: { fullName: 'Dr. House', user: { id: 'u-doc', email: 'house@example.com' } },
      };

      rescheduleRepoMock.findOne.mockResolvedValue(mockRequest);

      const result = await service.patientRejectReschedule('user-pat-1', 'req-reject-1', {
        notes: 'I am busy at that time',
      });

      expect(result.request.status).toBe(RescheduleRequestStatus.REJECTED);
      expect(notificationServiceMock.createDoctorNotification).toHaveBeenCalled();
    });

    it('Cancel: should cancel appointment, initiate refund for paid bookings, and notify', async () => {
      const mockRequest = {
        id: 'req-cancel-1',
        appointmentId: 'appt-paid-1',
        patientId: 'pat-uuid-1',
        doctorId: 'doc-uuid-1',
        originalDate: '2026-11-16',
        status: RescheduleRequestStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        doctor: { fullName: 'Dr. House' },
      };

      rescheduleRepoMock.findOne.mockResolvedValue(mockRequest);

      const mockPaidAppt = {
        id: 'appt-paid-1',
        patientId: 'pat-uuid-1',
        doctorId: 'doc-uuid-1',
        paymentStatus: 'PAID',
        status: AppointmentStatus.CONFIRMED,
      };
      appointmentRepoMock.findOne.mockResolvedValue(mockPaidAppt);

      const result = await service.patientCancelReschedule('user-pat-1', 'req-cancel-1', {
        reason: 'Cannot make any alternative',
      });

      expect(result.appointment.status).toBe(AppointmentStatus.CANCELLED);
      expect(paymentServiceMock.createRefund).toHaveBeenCalled();
      expect(result.refund.refundId).toBe('rfnd_123');
    });
  });

  describe('Cron: Expiry of Stale Requests', () => {
    it('should mark expired requests as EXPIRED without cancelling original appointments', async () => {
      const staleRequest = {
        id: 'req-stale-1',
        doctorId: 'doc-uuid-1',
        patientId: 'pat-uuid-1',
        proposedDate: '2026-11-16',
        status: RescheduleRequestStatus.PENDING,
        expiresAt: new Date(Date.now() - 1000),
        doctor: { fullName: 'Dr. House' },
        patient: { fullName: 'Patient Old' },
      };

      rescheduleRepoMock.createQueryBuilder = jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([staleRequest]),
      });

      await service.expireStaleRequests();

      expect(staleRequest.status).toBe(RescheduleRequestStatus.EXPIRED);
      expect(rescheduleRepoMock.save).toHaveBeenCalledWith(staleRequest);
      expect(notificationServiceMock.createDoctorNotification).toHaveBeenCalled();
    });
  });
});
