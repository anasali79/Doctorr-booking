import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { RecurringAvailability, DayOfWeek } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { Doctor } from './entities/doctor.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { DoctorLeave } from './entities/leave.entity';
import { SchedulingType } from '../common/enums/scheduling-type.enum';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';

describe('AvailabilityService - Wave & Stream Scheduling', () => {
  let service: AvailabilityService;
  let recurringRepo: any;
  let customRepo: any;
  let doctorRepo: any;
  let appointmentRepo: any;
  let leaveRepo: any;

  const mockDoctor: Partial<Doctor> = {
    id: 'doc-uuid-1',
    userId: 'user-uuid-1',
    fullName: 'Dr. Jane Smith',
    allowFutureBooking: true,
    maxFutureBookingDays: 30,
  };

  beforeEach(async () => {
    recurringRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    customRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn((entity) => Promise.resolve(entity)),
    };
    doctorRepo = {
      findOne: jest.fn().mockResolvedValue(mockDoctor),
      save: jest.fn((d) => Promise.resolve(d)),
    };
    appointmentRepo = {
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    };
    leaveRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: getRepositoryToken(RecurringAvailability), useValue: recurringRepo },
        { provide: getRepositoryToken(CustomAvailability), useValue: customRepo },
        { provide: getRepositoryToken(Doctor), useValue: doctorRepo },
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepo },
        { provide: getRepositoryToken(DoctorLeave), useValue: leaveRepo },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  describe('Wave Scheduling Workflow', () => {
    it('should divide recurring Wave schedule into sub-slots of given duration with per-slot capacity', async () => {
      // Doctor configures Wave on Mondays: 10:00 to 12:00, 30m duration, capacity 3 patients per slot
      recurringRepo.find.mockResolvedValueOnce([
        {
          id: 'rec-1',
          doctorId: mockDoctor.id,
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '10:00',
          endTime: '12:00',
          slotDuration: 30,
          schedulingType: SchedulingType.WAVE,
          bufferTime: 0,
          maxPatients: 3,
        },
      ]);
      customRepo.find.mockResolvedValueOnce([]); // no custom override
      appointmentRepo.find.mockResolvedValueOnce([]); // no existing bookings

      // Use future Monday date (e.g. 2026-11-23 is a Monday)
      const slots = await service.getAvailableSlots(mockDoctor.id!, '2026-11-23');

      expect(slots).toHaveLength(4);
      expect(slots[0]).toMatchObject({
        startTime: '10:00',
        endTime: '10:30',
        schedulingType: SchedulingType.WAVE,
        maxPatients: 3,
        availableCount: 3,
        bookedCount: 0,
        status: 'available',
      });
      expect(slots[1]).toMatchObject({
        startTime: '10:30',
        endTime: '11:00',
        schedulingType: SchedulingType.WAVE,
        maxPatients: 3,
        availableCount: 3,
        status: 'available',
      });
      expect(slots[2]).toMatchObject({
        startTime: '11:00',
        endTime: '11:30',
        schedulingType: SchedulingType.WAVE,
        maxPatients: 3,
        availableCount: 3,
        status: 'available',
      });
      expect(slots[3]).toMatchObject({
        startTime: '11:30',
        endTime: '12:00',
        schedulingType: SchedulingType.WAVE,
        maxPatients: 3,
        availableCount: 3,
        status: 'available',
      });
    });

    it('should enforce per-slot capacity for Wave slots independently', async () => {
      recurringRepo.find.mockResolvedValueOnce([
        {
          id: 'rec-1',
          doctorId: mockDoctor.id,
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '10:00',
          endTime: '11:00',
          slotDuration: 30,
          schedulingType: SchedulingType.WAVE,
          bufferTime: 0,
          maxPatients: 2, // 2 patients per 30m slot
        },
      ]);
      customRepo.find.mockResolvedValueOnce([]);

      // 2 bookings in 10:00-10:30 (full), and 1 booking in 10:30-11:00 (1 spot left)
      appointmentRepo.find.mockResolvedValueOnce([
        {
          id: 'app-1',
          startTime: '10:00',
          endTime: '10:30',
          status: AppointmentStatus.CONFIRMED,
        },
        {
          id: 'app-2',
          startTime: '10:00',
          endTime: '10:30',
          status: AppointmentStatus.CONFIRMED,
        },
        {
          id: 'app-3',
          startTime: '10:30',
          endTime: '11:00',
          status: AppointmentStatus.CONFIRMED,
        },
      ]);

      const slots = await service.getAvailableSlots(mockDoctor.id!, '2026-11-23');

      expect(slots).toHaveLength(2);
      // 10:00-10:30 slot should be booked (full)
      expect(slots[0]).toMatchObject({
        startTime: '10:00',
        endTime: '10:30',
        bookedCount: 2,
        availableCount: 0,
        status: 'booked',
      });
      // 10:30-11:00 slot should remain available with 1 spot left
      expect(slots[1]).toMatchObject({
        startTime: '10:30',
        endTime: '11:00',
        bookedCount: 1,
        availableCount: 1,
        status: 'available',
      });
    });

    it('should auto-align slotDuration to 30m and calculate revised capacity 3 when a 60m Wave shift is shrunk to 30m window', async () => {
      // Shift in DB with 09:00-09:30 window, 60m duration, maxPatients 5
      recurringRepo.find.mockResolvedValueOnce([
        {
          id: 'rec-wave-shrunk',
          doctorId: mockDoctor.id,
          dayOfWeek: DayOfWeek.WEDNESDAY,
          startTime: '09:00',
          endTime: '09:30',
          slotDuration: 60,
          schedulingType: SchedulingType.WAVE,
          maxPatients: 5,
        },
      ]);
      customRepo.find.mockResolvedValueOnce([]);
      appointmentRepo.find.mockResolvedValueOnce([
        { id: 'app-w1', startTime: '09:00', endTime: '09:30', status: AppointmentStatus.CONFIRMED },
        { id: 'app-w2', startTime: '09:00', endTime: '09:30', status: AppointmentStatus.CONFIRMED },
        { id: 'app-w3', startTime: '09:00', endTime: '09:30', status: AppointmentStatus.CONFIRMED },
      ]);

      const slots = await service.getAvailableSlots(mockDoctor.id!, '2026-11-25');

      expect(slots).toHaveLength(1);
      expect(slots[0]).toMatchObject({
        startTime: '09:00',
        endTime: '09:30',
        maxPatients: 3,
        bookedCount: 3,
        availableCount: 0,
        status: 'booked',
      });
    });
  });

  describe('Stream Scheduling Workflow', () => {
    it('should generate a continuous session window with configurable total capacity', async () => {
      // Doctor configures Stream on Tuesdays: 14:00 to 18:00 with total capacity of 20 patients
      recurringRepo.find.mockResolvedValueOnce([
        {
          id: 'rec-stream-1',
          doctorId: mockDoctor.id,
          dayOfWeek: DayOfWeek.TUESDAY,
          startTime: '14:00',
          endTime: '18:00',
          schedulingType: SchedulingType.STREAM,
          maxPatients: 20,
        },
      ]);
      customRepo.find.mockResolvedValueOnce([]);
      appointmentRepo.find.mockResolvedValueOnce([
        { id: 'app-s1', startTime: '14:00', endTime: '18:00', status: AppointmentStatus.CONFIRMED },
        { id: 'app-s2', startTime: '14:00', endTime: '18:00', status: AppointmentStatus.CONFIRMED },
        { id: 'app-s3', startTime: '14:00', endTime: '18:00', status: AppointmentStatus.CONFIRMED },
      ]);

      // 2026-11-10 is Tuesday
      const slots = await service.getAvailableSlots(mockDoctor.id!, '2026-11-17');

      expect(slots).toHaveLength(1);
      expect(slots[0]).toMatchObject({
        startTime: '14:00',
        endTime: '18:00',
        schedulingType: SchedulingType.STREAM,
        maxPatients: 20,
        bookedCount: 3,
        availableCount: 17,
        status: 'available',
      });
    });

    it('should mark Stream session as booked when total session capacity is reached', async () => {
      recurringRepo.find.mockResolvedValueOnce([
        {
          id: 'rec-stream-2',
          doctorId: mockDoctor.id,
          dayOfWeek: DayOfWeek.TUESDAY,
          startTime: '14:00',
          endTime: '16:00',
          schedulingType: SchedulingType.STREAM,
          maxPatients: 2,
        },
      ]);
      customRepo.find.mockResolvedValueOnce([]);
      appointmentRepo.find.mockResolvedValueOnce([
        { id: 'app-s1', startTime: '14:00', endTime: '16:00', status: AppointmentStatus.CONFIRMED },
        { id: 'app-s2', startTime: '14:00', endTime: '16:00', status: AppointmentStatus.CONFIRMED },
      ]);

      const slots = await service.getAvailableSlots(mockDoctor.id!, '2026-11-17');

      expect(slots).toHaveLength(1);
      expect(slots[0]).toMatchObject({
        startTime: '14:00',
        endTime: '16:00',
        schedulingType: SchedulingType.STREAM,
        maxPatients: 2,
        bookedCount: 2,
        availableCount: 0,
        status: 'booked',
      });
    });
  });

  describe('Non-Recurring (Specific Date Override) Workflow', () => {
    it('should correctly support non-recurring Wave schedule on a specific date', async () => {
      // Specific date override for Wave: 2026-11-15, 09:00 - 10:00, 30m duration, capacity 4
      customRepo.find.mockResolvedValueOnce([
        {
          id: 'custom-wave-1',
          doctorId: mockDoctor.id,
          date: '2026-11-15',
          startTime: '09:00',
          endTime: '10:00',
          slotDuration: 30,
          schedulingType: SchedulingType.WAVE,
          bufferTime: 0,
          maxPatients: 4,
        },
      ]);
      appointmentRepo.find.mockResolvedValueOnce([]);

      const slots = await service.getAvailableSlots(mockDoctor.id!, '2026-11-15');

      expect(slots).toHaveLength(2);
      expect(slots[0]).toMatchObject({
        startTime: '09:00',
        endTime: '09:30',
        schedulingType: SchedulingType.WAVE,
        maxPatients: 4,
        availableCount: 4,
        status: 'available',
      });
      expect(slots[1]).toMatchObject({
        startTime: '09:30',
        endTime: '10:00',
        schedulingType: SchedulingType.WAVE,
        maxPatients: 4,
        availableCount: 4,
        status: 'available',
      });
    });

    it('should correctly support non-recurring Stream schedule on a specific date', async () => {
      // Specific date override for Stream: 2026-11-16, 11:00 - 13:00, capacity 25
      customRepo.find.mockResolvedValueOnce([
        {
          id: 'custom-stream-1',
          doctorId: mockDoctor.id,
          date: '2026-11-16',
          startTime: '11:00',
          endTime: '13:00',
          schedulingType: SchedulingType.STREAM,
          maxPatients: 25,
        },
      ]);
      appointmentRepo.find.mockResolvedValueOnce([]);

      const slots = await service.getAvailableSlots(mockDoctor.id!, '2026-11-16');

      expect(slots).toHaveLength(1);
      expect(slots[0]).toMatchObject({
        startTime: '11:00',
        endTime: '13:00',
        schedulingType: SchedulingType.STREAM,
        maxPatients: 25,
        availableCount: 25,
        status: 'available',
      });
    });
  });

  describe('Scheduling Configuration Validation', () => {
    it('should throw BadRequestException if WAVE has invalid slotDuration or maxPatients', async () => {
      // maxPatients <= 0
      await expect(
        service.createRecurring('user-uuid-1', {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '10:00',
          endTime: '12:00',
          schedulingType: SchedulingType.WAVE,
          slotDuration: 30,
          maxPatients: 0,
        }),
      ).rejects.toThrow(BadRequestException);

      // slotDuration <= 0
      await expect(
        service.createRecurring('user-uuid-1', {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '10:00',
          endTime: '12:00',
          schedulingType: SchedulingType.WAVE,
          slotDuration: 0,
          maxPatients: 3,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if STREAM has invalid maxPatients', async () => {
      await expect(
        service.createRecurring('user-uuid-1', {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '10:00',
          endTime: '12:00',
          schedulingType: SchedulingType.STREAM,
          maxPatients: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteCustomOverride', () => {
    it('should delete custom override successfully when no confirmed appointments exist', async () => {
      const mockOverride = {
        id: 'override-123',
        doctorId: 'doc-uuid-1',
        date: '2026-11-05',
        startTime: '10:00',
        endTime: '12:00',
      };
      customRepo.findOne.mockResolvedValue(mockOverride);
      appointmentRepo.find.mockResolvedValue([]);

      await service.deleteCustomOverride('user-uuid-1', 'override-123');

      expect(customRepo.remove).toHaveBeenCalledWith(mockOverride);
    });

    it('should throw NotFoundException if override not found', async () => {
      customRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deleteCustomOverride('user-uuid-1', 'invalid-id'),
      ).rejects.toThrow();
    });

    it('should throw BadRequestException if confirmed appointments exist in the override window', async () => {
      const mockOverride = {
        id: 'override-123',
        doctorId: 'doc-uuid-1',
        date: '2026-11-05',
        startTime: '10:00',
        endTime: '12:00',
      };
      customRepo.findOne.mockResolvedValue(mockOverride);
      appointmentRepo.find.mockResolvedValue([
        {
          id: 'app-1',
          doctorId: 'doc-uuid-1',
          date: '2026-11-05',
          startTime: '10:30',
          endTime: '11:00',
          status: AppointmentStatus.CONFIRMED,
        },
      ]);

      await expect(
        service.deleteCustomOverride('user-uuid-1', 'override-123'),
      ).rejects.toThrow(ConflictException);
      expect(customRepo.remove).not.toHaveBeenCalled();
    });

    it('should cancel appointments and delete override when confirmCancelAndRefund is true', async () => {
      const mockOverride = {
        id: 'override-123',
        doctorId: 'doc-uuid-1',
        date: '2026-11-05',
        startTime: '10:00',
        endTime: '12:00',
      };
      doctorRepo.findOne.mockResolvedValue(mockDoctor);
      customRepo.findOne.mockResolvedValue(mockOverride);
      appointmentRepo.find.mockResolvedValue([
        {
          id: 'app-1',
          doctorId: 'doc-uuid-1',
          patientId: 'patient-1',
          date: '2026-11-05',
          startTime: '10:30',
          endTime: '11:00',
          status: AppointmentStatus.CONFIRMED,
          paymentStatus: 'PAID',
        },
      ]);

      const result = await service.deleteCustomOverride('user-uuid-1', 'override-123', true);
      expect(customRepo.remove).toHaveBeenCalledWith(mockOverride);
      expect(result.cancelledAppointmentsCount).toBe(1);
    });
  });

  describe('getSlotCapacity & Empty Slots Graceful Handling', () => {
    it('should return correct capacity for recurring wave schedule sub-slots', async () => {
      recurringRepo.find.mockResolvedValueOnce([
        {
          id: 'rec-1',
          doctorId: mockDoctor.id,
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00',
          slotDuration: 30,
          schedulingType: SchedulingType.WAVE,
          bufferTime: 0,
          maxPatients: 2,
        },
      ]);
      customRepo.find.mockResolvedValueOnce([]);

      const cap = await service.getSlotCapacity(mockDoctor.id!, '2026-11-23', '09:00', '09:30');
      expect(cap).toEqual({
        maxPatients: 2,
        schedulingType: SchedulingType.WAVE,
      });
    });

    it('should return empty array with message when no recurring or custom availability exists', async () => {
      recurringRepo.find.mockResolvedValueOnce([]);
      customRepo.find.mockResolvedValueOnce([]);

      const slots = await service.getAvailableSlots(mockDoctor.id!, '2026-11-23');
      expect(slots).toHaveLength(0);
      expect((slots as any).message).toContain('No availability found');
    });
  });
});

