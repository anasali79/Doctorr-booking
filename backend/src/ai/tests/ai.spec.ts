import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../common/enums/role.enum';
import { AiPermissionService } from '../services/ai-permission.service';
import { AiSessionService } from '../services/ai-session.service';
import { GeminiClientService } from '../services/gemini-client.service';
import { AiToolRegistryService } from '../services/ai-tool-registry.service';
import { AiOrchestratorService } from '../services/ai-orchestrator.service';
import { AiService } from '../ai.service';
import { AppointmentService } from '../../appointment/appointment.service';
import { DoctorService } from '../../doctor/doctor.service';
import { AvailabilityService } from '../../doctor/availability.service';
import { ElasticSchedulingService } from '../../doctor/elastic-scheduling.service';
import { PaymentService } from '../../payment/payment.service';
import { PrescriptionService } from '../../prescription/prescription.service';
import { NotificationService } from '../../notification/notification.service';
import { HttpException, ForbiddenException } from '@nestjs/common';

describe('AI Backend Module Unit Tests & Security Suite', () => {
  let permissionService: AiPermissionService;
  let sessionService: AiSessionService;
  let toolRegistry: AiToolRegistryService;
  let orchestrator: AiOrchestratorService;
  let aiService: AiService;
  let geminiClient: GeminiClientService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'AI_SEND_PATIENT_NAMES') return 'false';
      if (key === 'AI_MAX_HISTORY_MESSAGES') return '5';
      if (key === 'AI_DAILY_MESSAGE_CAP_PER_USER') return '2';
      if (key === 'GEMINI_MODEL') return 'gemini-2.0-flash';
      return null;
    }),
  };

  const mockAppointmentService = {
    getDoctorAppointments: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'appt-1',
          date: '2026-11-10',
          startTime: '10:00',
          status: 'CONFIRMED',
          patient: { id: 'p1', fullName: 'Rahul Verma', phone: '9999999999' },
        },
      ],
    }),
    getPatientAppointments: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'appt-patient-1',
          date: '2026-11-10',
          startTime: '10:00',
          status: 'CONFIRMED',
          doctorId: 'doc-1',
          doctor: { id: 'doc-1', fullName: 'Dr. Aryan Sharma' },
        },
      ],
    }),
    bookAppointment: jest.fn().mockResolvedValue({
      data: { id: 'new-appt-123', tokenNumber: 5 },
    }),
    rescheduleAppointment: jest.fn().mockResolvedValue({
      data: { id: 'rescheduled-appt-123' },
    }),
    cancelAppointment: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockDoctorService = {
    findAll: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'doc-1',
          fullName: 'Dr. Aryan Sharma',
          specialization: 'Cardiology',
          experience: 10,
          consultationFee: 500,
        },
      ],
    }),
    findById: jest.fn().mockResolvedValue({
      data: {
        id: 'doc-1',
        fullName: 'Dr. Aryan Sharma',
        consultationFee: 500,
      },
    }),
  };

  const mockAvailabilityService = {
    getAvailableSlots: jest.fn().mockResolvedValue([
      { startTime: '10:00', endTime: '10:30', status: 'available' },
      { startTime: '11:00', endTime: '11:30', status: 'booked' },
    ]),
    getDetailedAvailability: jest.fn().mockResolvedValue({ shifts: [] }),
    findNextAvailableSlot: jest.fn().mockResolvedValue({
      date: '2026-11-12',
      startTime: '10:00',
      endTime: '10:30',
      schedulingType: 'standard',
      availableCount: 5,
    }),
  };

  const mockElasticSchedulingService = {
    smartReschedulePreview: jest.fn().mockResolvedValue({ candidates: [] }),
  };

  const mockPaymentService = {
    getPatientPaymentHistory: jest.fn().mockResolvedValue({
      data: [
        {
          amount: 500,
          status: 'SUCCESS',
          razorpayPaymentId: 'pay_secret_123',
          appointment: { date: '2026-11-10' },
        },
      ],
    }),
    createOrder: jest.fn().mockResolvedValue({
      orderId: 'order_mock_123',
      amount: 50000,
      currency: 'INR',
      keyId: 'rzp_test_mock',
      appointmentId: 'appt-new-123',
    }),
  };

  const mockPrescriptionService = {
    getPatientPrescriptions: jest.fn().mockResolvedValue([
      {
        id: 'presc-1',
        medicines: [{ name: 'Aspirin', dose: '100mg' }],
        diagnosis: 'Private Cardiac Issue',
        appointment: { date: '2026-11-01' },
      },
    ]),
  };

  const mockNotificationService = {
    getUserPreferences: jest.fn().mockResolvedValue({ email: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPermissionService,
        AiSessionService,
        GeminiClientService,
        AiToolRegistryService,
        AiOrchestratorService,
        AiService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AppointmentService, useValue: mockAppointmentService },
        { provide: DoctorService, useValue: mockDoctorService },
        { provide: AvailabilityService, useValue: mockAvailabilityService },
        { provide: ElasticSchedulingService, useValue: mockElasticSchedulingService },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: PrescriptionService, useValue: mockPrescriptionService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    permissionService = module.get<AiPermissionService>(AiPermissionService);
    sessionService = module.get<AiSessionService>(AiSessionService);
    toolRegistry = module.get<AiToolRegistryService>(AiToolRegistryService);
    orchestrator = module.get<AiOrchestratorService>(AiOrchestratorService);
    aiService = module.get<AiService>(AiService);
    geminiClient = module.get<GeminiClientService>(GeminiClientService);
  });

  // 1. Data Minimization & Privacy (Section 3E)
  describe('Data Minimization (Section 3E)', () => {
    it('should strip phone, email, private notes, and diagnosis from tool payload', () => {
      const rawPayload = {
        id: 'appt-1',
        phone: '+919999999999',
        email: 'patient@example.com',
        diagnosis: 'Hypertension',
        medicines: [{ name: 'SecretMed' }],
        patient: { id: 'p1', fullName: 'Rahul Verma', phone: '9999999999' },
      };

      const sanitized = permissionService.sanitizeToolOutput(rawPayload);

      expect(sanitized.phone).toBeUndefined();
      expect(sanitized.email).toBeUndefined();
      expect(sanitized.diagnosis).toBeUndefined();
      expect(sanitized.medicines).toBeUndefined();
      expect(sanitized.patient.name).toBe('Patient'); // AI_SEND_PATIENT_NAMES is false
    });

    it('should never expose medicine names or diagnoses in prescription summary', async () => {
      const tool = toolRegistry.getTool('getMyPrescriptions');
      const result = await tool!.execute(
        { userId: 'user-patient', email: 'test@p.com', role: Role.PATIENT },
        {},
      );

      expect(result.success).toBe(true);
      expect(JSON.stringify(result.data)).not.toContain('Aspirin');
      expect(JSON.stringify(result.data)).not.toContain('Private Cardiac Issue');
      expect(result.data[0].status).toBe('Prescription Available');
    });
  });

  // 2. Role-Based Permissions (Section 6)
  describe('Role-Based AI Permissions (Section 6)', () => {
    it('should deny patient from executing doctor appointment tools', () => {
      const tool = toolRegistry.getTool('getDoctorAppointments');
      const allowed = permissionService.canExecuteTool(
        { userId: 'p1', email: 'p@test.com', role: Role.PATIENT },
        tool!,
      );
      expect(allowed).toBe(false);
    });

    it('should deny doctor from executing patient booking tools', () => {
      const tool = toolRegistry.getTool('previewAppointmentBooking');
      const allowed = permissionService.canExecuteTool(
        { userId: 'd1', email: 'd@test.com', role: Role.DOCTOR },
        tool!,
      );
      expect(allowed).toBe(false);
    });

    it('should exclude confirm actions from direct Gemini function calling declarations', () => {
      const declarations = toolRegistry.getFunctionDeclarationsForRole(Role.PATIENT);
      const names = declarations.map((d) => d.name);
      expect(names).not.toContain('confirmAppointmentBooking');
      expect(names).not.toContain('confirmAppointmentReschedule');
      expect(names).not.toContain('confirmAppointmentCancellation');
    });
  });

  // 3. Two-Step Confirmation Safety (Section 8)
  describe('Two-Step Confirmation Safety (Section 8)', () => {
    it('previewAppointmentBooking should require confirmation and create pending confirmation', async () => {
      const tool = toolRegistry.getTool('previewAppointmentBooking');
      const result = await tool!.execute(
        { userId: 'patient-1', email: 'p@test.com', role: Role.PATIENT },
        {
          doctorId: 'doc-1',
          date: '2026-11-10',
          startTime: '10:00',
          conversationId: 'conv-1',
        },
      );

      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationId).toBeDefined();
      expect(mockAppointmentService.bookAppointment).not.toHaveBeenCalled();
    });

    it('previewAppointmentReschedule should require confirmation card', async () => {
      const tool = toolRegistry.getTool('previewAppointmentReschedule');
      const result = await tool!.execute(
        { userId: 'patient-1', email: 'p@test.com', role: Role.PATIENT },
        {
          appointmentId: 'appt-patient-1',
          newDate: '2026-11-10',
          newStartTime: '10:00',
          conversationId: 'conv-1',
        },
      );

      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationId).toBeDefined();
    });

    it('previewAppointmentCancellation should require confirmation card', async () => {
      const tool = toolRegistry.getTool('previewAppointmentCancellation');
      const result = await tool!.execute(
        { userId: 'patient-1', email: 'p@test.com', role: Role.PATIENT },
        {
          appointmentId: 'appt-patient-1',
          reason: 'Emergency travel',
          conversationId: 'conv-1',
        },
      );

      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.confirmationId).toBeDefined();
    });

    it('should execute confirmation and require payment when doctor consultation has a fee', async () => {
      const tool = toolRegistry.getTool('previewAppointmentBooking');
      const preview = await tool!.execute(
        { userId: 'patient-1', email: 'p@test.com', role: Role.PATIENT },
        {
          doctorId: 'doc-1',
          date: '2026-11-10',
          startTime: '10:00',
          conversationId: 'conv-1',
        },
      );

      const confirmResult = await toolRegistry.executeConfirmation(
        preview.confirmationId!,
        'patient-1',
      );

      expect(confirmResult.success).toBe(true);
      expect(confirmResult.requiresPayment).toBe(true);
      expect(mockPaymentService.createOrder).toHaveBeenCalled();
    });

    it('should reject confirmation if requested by a different user', async () => {
      const tool = toolRegistry.getTool('previewAppointmentBooking');
      const preview = await tool!.execute(
        { userId: 'patient-1', email: 'p@test.com', role: Role.PATIENT },
        {
          doctorId: 'doc-1',
          date: '2026-11-10',
          startTime: '10:00',
          conversationId: 'conv-1',
        },
      );

      // Malicious user 'attacker-99' attempts to execute confirmation
      const confirmResult = await toolRegistry.executeConfirmation(
        preview.confirmationId!,
        'attacker-99',
      );

      expect(confirmResult.success).toBe(false);
      expect(confirmResult.error).toContain('invalid');
    });

    it('should reject expired confirmation', () => {
      const pending = sessionService.createPendingConfirmation(
        'user-1',
        'conv-1',
        'BOOK_APPOINTMENT',
        {},
        'Test summary',
      );

      // Manually simulate expiration (older than 5 minutes)
      pending.expiresAt = new Date(Date.now() - 1000);

      const retrieved = sessionService.getPendingConfirmation(pending.id, 'user-1');
      expect(retrieved).toBeNull();
    });
  });

  // 4. Rate Limiting and Daily Per-User Cap (Section 3D)
  describe('Daily Message Cap and Rate Limiting (Section 3D)', () => {
    it('should enforce daily message cap and block after quota is exceeded', async () => {
      const user = { id: 'capped-user', email: 'c@test.com', role: Role.PATIENT };
      jest.spyOn(geminiClient, 'generateContent').mockResolvedValue({
        candidates: [{ content: { role: 'model', parts: [{ text: 'Hello' }] } }],
      });

      // 1st request - allowed
      await aiService.chat(user, { message: 'hi' });
      // 2nd request - allowed (limit is 2 in mock)
      await aiService.chat(user, { message: 'hi again' });

      // 3rd request - should throw 429 HttpException
      await expect(aiService.chat(user, { message: 'hi 3rd time' })).rejects.toThrow(
        HttpException,
      );
    });
  });

  // 5. Provider Outage & 429 Graceful Fallback (Section 14)
  describe('Graceful Error Fallback (Section 14)', () => {
    it('should return gentle Hinglish message when Gemini is busy (429)', async () => {
      jest.spyOn(geminiClient, 'generateContent').mockResolvedValue({
        error: {
          code: 429,
          message: 'Quota exceeded',
          status: 'RESOURCE_EXHAUSTED',
        },
      });

      const user = { id: 'u-fallback', email: 'u@test.com', role: Role.PATIENT };
      const response = await aiService.chat(user, { message: 'Aaj ke slots' });

      expect(response.message).toContain('AI abhi busy hai');
      expect(response.requiresConfirmation).toBe(false);
    });
  });

  // 6. Conversation Ownership and Session Isolation
  describe('Conversation Ownership and Session Isolation', () => {
    it('should prevent access to another user\'s conversation', () => {
      // User A creates conversation
      sessionService.getOrCreateSession('user-A', 'PATIENT', 'shared-conv-id');

      // User B attempts to access User A's conversation
      expect(() => {
        sessionService.getOrCreateSession('user-B', 'PATIENT', 'shared-conv-id');
      }).toThrow(ForbiddenException);
    });

    it('should prevent deleting another user\'s conversation', () => {
      sessionService.getOrCreateSession('user-A', 'PATIENT', 'conv-to-delete');

      expect(() => {
        aiService.deleteConversation('user-B', 'conv-to-delete');
      }).toThrow(ForbiddenException);
    });
  });

  // 7. AI Symptom Checker & Guided Doctor Triage to Booking
  describe('AI Symptom Checker & Guided Doctor Triage', () => {
    it('should analyze cardiac symptoms, flag emergency, and return doctors with next slot and booking actions', async () => {
      const patientCtx = {
        userId: 'patient-symptom-1',
        email: 'patient@test.com',
        role: Role.PATIENT,
      };

      const tool = toolRegistry.getTool('checkSymptomsAndRecommendDoctors');
      expect(tool).toBeDefined();

      const result = await tool!.execute(patientCtx, {
        symptoms: 'mujhe 2 din se severe chest pain aur heart rate tez ho raha hai',
      });

      expect(result.success).toBe(true);
      expect(result.data.triageResult.specialization).toBe('cardiologist');
      expect(result.data.triageResult.isEmergency).toBe(true);
      expect(result.data.triageResult.emergencyNotice).toBeDefined();
      expect(result.data.doctors.length).toBeGreaterThan(0);
      expect(result.data.doctors[0].nextSlot).toBeDefined();
      expect(result.data.doctors[0].nextSlot.date).toBe('2026-11-12');
      expect(result.actions).toBeDefined();
      expect(result.actions![0].type).toBe('BOOK_DOCTOR_SLOT');
    });

    it('should analyze skin symptoms and identify dermatologist without emergency', async () => {
      const patientCtx = {
        userId: 'patient-symptom-2',
        email: 'patient2@test.com',
        role: Role.PATIENT,
      };

      const tool = toolRegistry.getTool('checkSymptomsAndRecommendDoctors');
      const result = await tool!.execute(patientCtx, {
        symptoms: 'chehre par red rashes aur khujli ho rahi hai pimples ke saath',
      });

      expect(result.success).toBe(true);
      expect(result.data.triageResult.specialization).toBe('dermatologist');
      expect(result.data.triageResult.isEmergency).toBe(false);
    });

    it('should disallow doctors from executing checkSymptomsAndRecommendDoctors', () => {
      const doctorCtx = {
        userId: 'doc-1',
        email: 'doctor@test.com',
        role: Role.DOCTOR,
      };

      const tool = toolRegistry.getTool('checkSymptomsAndRecommendDoctors');
      expect(permissionService.canExecuteTool(doctorCtx, tool!)).toBe(false);
    });

    it('should handle unlisted specialty (e.g. dentist / mouth ulcers) by returning foundExactSpecialist: false and providing general physician fallback', async () => {
      const patientCtx = {
        userId: 'patient-ulcer-1',
        email: 'patient@test.com',
        role: Role.PATIENT,
      };

      const tool = toolRegistry.getTool('checkSymptomsAndRecommendDoctors');
      const result = await tool!.execute(patientCtx, {
        symptoms: 'muu mai har 10 din mai chaale aa jate hai',
        specialization: 'dentist',
      });

      expect(result.success).toBe(true);
      expect(result.data.foundExactSpecialist).toBe(false);
      expect(result.data.fallbackSpecialization).toBe('general physician');
      expect(result.data.doctors.length).toBeGreaterThan(0);
      expect(result.data.doctors[0].nextSlot).toBeDefined();
    });
  });
});
