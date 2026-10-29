import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReminderService } from '../reminder.service';
import { Appointment } from '../../appointment/entities/appointment.entity';
import { ReminderJob } from '../entities/reminder-job.entity';
import { NotificationService } from '../../notification/notification.service';
import { EmailService } from '../../email/email.service';
import { ReminderJobStatus } from '../enums/reminder-job-status.enum';
import { ReminderJobType } from '../enums/reminder-job-type.enum';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum';

describe('ReminderService (Phase 10)', () => {
  let service: ReminderService;
  let appointmentRepo: any;
  let reminderJobRepo: any;
  let emailService: any;
  let notificationService: any;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((j) => Promise.resolve(j)),
      },
    };

    appointmentRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
    };

    reminderJobRepo = {
      create: jest.fn().mockImplementation((dto) => ({ id: 'job-uuid-1', ...dto })),
      save: jest.fn().mockImplementation((job) => Promise.resolve({ id: 'job-uuid-1', ...job })),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    emailService = {
      sendAppointmentReminder: jest.fn().mockResolvedValue(true),
    };

    notificationService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderService,
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepo },
        { provide: getRepositoryToken(ReminderJob), useValue: reminderJobRepo },
        { provide: NotificationService, useValue: notificationService },
        { provide: EmailService, useValue: emailService },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<ReminderService>(ReminderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Scheduling Reminders', () => {
    it('should schedule persistent 24h and 1h reminders for future appointments', async () => {
      // Future appointment: 5 days from now
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const dateStr = futureDate.toISOString().split('T')[0];

      const appointment: any = {
        id: 'appt-future-1',
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        date: dateStr,
        startTime: '14:00',
        status: AppointmentStatus.CONFIRMED,
      };

      await service.scheduleAppointmentReminders(appointment);

      // Should save 2 jobs: 24h and 1h
      expect(reminderJobRepo.create).toHaveBeenCalledTimes(2);
      expect(reminderJobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: 'appt-future-1',
          type: ReminderJobType.REMINDER_24H,
          dedupKey: 'appt-future-1_REMINDER_24H',
          status: ReminderJobStatus.PENDING,
        }),
      );
      expect(reminderJobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: 'appt-future-1',
          type: ReminderJobType.REMINDER_1H,
          dedupKey: 'appt-future-1_REMINDER_1H',
          status: ReminderJobStatus.PENDING,
        }),
      );
    });

    it('should not duplicate jobs if dedupKey already exists', async () => {
      reminderJobRepo.findOne.mockResolvedValueOnce({
        id: 'existing-job',
        status: ReminderJobStatus.PENDING,
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const dateStr = futureDate.toISOString().split('T')[0];

      const appointment: any = {
        id: 'appt-future-1',
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        date: dateStr,
        startTime: '14:00',
      };

      await service.scheduleAppointmentReminders(appointment);

      // Existing pending job should be updated, not re-created
      expect(reminderJobRepo.save).toHaveBeenCalled();
    });
  });

  describe('Cancellation and Invalidation', () => {
    it('should mark all pending reminders as CANCELLED on appointment cancellation', async () => {
      await service.cancelRemindersForAppointment('appt-123');

      expect(reminderJobRepo.update).toHaveBeenCalledWith(
        { appointmentId: 'appt-123', status: ReminderJobStatus.PENDING },
        { status: ReminderJobStatus.CANCELLED },
      );
    });
  });

  describe('Worker Processing (processDueReminders)', () => {
    it('should atomically process due reminders and send email/notification', async () => {
      const dueJob = {
        id: 'due-job-1',
        appointmentId: 'appt-1',
        type: ReminderJobType.REMINDER_24H,
        status: ReminderJobStatus.PENDING,
        attempts: 0,
        maxAttempts: 3,
      };

      reminderJobRepo.find.mockResolvedValueOnce([dueJob]);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(dueJob);

      const confirmedAppt = {
        id: 'appt-1',
        status: AppointmentStatus.CONFIRMED,
        date: '2026-11-10',
        startTime: '10:00',
        patientId: 'pat-1',
        tokenNumber: 5,
        patient: { fullName: 'John Doe', user: { email: 'john@example.com' } },
        doctor: { fullName: 'Jane Smith' },
      };
      appointmentRepo.findOne.mockResolvedValueOnce(confirmedAppt);

      await service.processDueReminders();

      expect(dueJob.status).toBe(ReminderJobStatus.SENT);
      expect(emailService.sendAppointmentReminder).toHaveBeenCalledWith(
        'john@example.com',
        'John Doe',
        'Jane Smith',
        '2026-11-10',
        '10:00',
        5,
        'tomorrow',
      );
      expect(notificationService.createNotification).toHaveBeenCalled();
    });

    it('should cancel reminder job and abort send if appointment is cancelled in the meantime', async () => {
      const dueJob = {
        id: 'due-job-1',
        appointmentId: 'appt-cancelled',
        type: ReminderJobType.REMINDER_1H,
        status: ReminderJobStatus.PENDING,
        attempts: 0,
        maxAttempts: 3,
      };

      reminderJobRepo.find.mockResolvedValueOnce([dueJob]);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(dueJob);

      // Appointment is CANCELLED!
      appointmentRepo.findOne.mockResolvedValueOnce({
        id: 'appt-cancelled',
        status: AppointmentStatus.CANCELLED,
      });

      await service.processDueReminders();

      // Pre-send invariant prevented send
      expect(dueJob.status).toBe(ReminderJobStatus.CANCELLED);
      expect(emailService.sendAppointmentReminder).not.toHaveBeenCalled();
    });
  });
});

