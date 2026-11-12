import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import {
  AiTool,
  AiUserContext,
  ToolExecutionResult,
} from '../interfaces/ai-tool.interface';
import { GeminiFunctionDeclaration } from '../interfaces/gemini.interface';
import { AppointmentService } from '../../appointment/appointment.service';
import { DoctorService } from '../../doctor/doctor.service';
import { AvailabilityService } from '../../doctor/availability.service';
import { ElasticSchedulingService } from '../../doctor/elastic-scheduling.service';
import { PaymentService } from '../../payment/payment.service';
import { PrescriptionService } from '../../prescription/prescription.service';
import { NotificationService } from '../../notification/notification.service';
import { AiSessionService } from './ai-session.service';
import { AiPermissionService } from './ai-permission.service';
import { SlotStatus } from '../../doctor/dto/availability.dto';
import { getTodayIST } from '../../common/utils/appointment.utils';
import { triageSymptoms } from './symptom-triage.helper';
import {
  isValidSpecialization,
  normalizeSpecialization,
} from '../../doctor/constants/specializations';

@Injectable()
export class AiToolRegistryService {
  private readonly logger = new Logger(AiToolRegistryService.name);
  private readonly tools = new Map<string, AiTool>();

  constructor(
    private readonly appointmentService: AppointmentService,
    private readonly doctorService: DoctorService,
    private readonly availabilityService: AvailabilityService,
    private readonly elasticSchedulingService: ElasticSchedulingService,
    private readonly paymentService: PaymentService,
    private readonly prescriptionService: PrescriptionService,
    private readonly notificationService: NotificationService,
    private readonly sessionService: AiSessionService,
    private readonly permissionService: AiPermissionService,
  ) {
    this.registerAllTools();
  }

  getTool(name: string): AiTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Returns function declarations permitted for the user's role.
   * Model-direct confirm actions are excluded from the model tools.
   */
  getFunctionDeclarationsForRole(role: Role): GeminiFunctionDeclaration[] {
    const list: GeminiFunctionDeclaration[] = [];
    for (const tool of this.tools.values()) {
      if (tool.permittedRoles.includes(role) && !tool.isConfirmAction) {
        list.push(tool.declaration);
      }
    }
    return list;
  }

  private register(tool: AiTool) {
    this.tools.set(tool.name, tool);
  }

  private registerAllTools() {
    // =========================================================================
    // 1. DOCTOR TOOLS
    // =========================================================================

    // getDoctorAppointments
    this.register({
      name: 'getDoctorAppointments',
      description:
        "Fetches the authenticated doctor's appointments. Can filter by date (YYYY-MM-DD).",
      permittedRoles: [Role.DOCTOR],
      declaration: {
        name: 'getDoctorAppointments',
        description:
          "Fetches the authenticated doctor's appointments. Optionally filter by date.",
        parameters: {
          type: 'OBJECT',
          properties: {
            date: {
              type: 'STRING',
              description: 'Optional date in YYYY-MM-DD format (e.g. 2026-11-10)',
            },
          },
        },
      },
      execute: async (ctx, args) => {
        const response = await this.appointmentService.getDoctorAppointments(
          ctx.userId,
          args?.date,
        );
        const list = Array.isArray(response) ? response : response.data || [];
        return {
          success: true,
          data: this.permissionService.sanitizeToolOutput(list),
        };
      },
    });

    // getDoctorAppointmentSummary
    this.register({
      name: 'getDoctorAppointmentSummary',
      description:
        "Returns summary count of the doctor's appointments grouped by status (confirmed, completed, cancelled) for today or a specific date with patient roster and quick actions.",
      permittedRoles: [Role.DOCTOR],
      declaration: {
        name: 'getDoctorAppointmentSummary',
        description:
          'Returns count and summary of appointments for today or a specific date.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: {
              type: 'STRING',
              description: 'Date in YYYY-MM-DD format',
            },
          },
        },
      },
      execute: async (ctx, args) => {
        const todayIST = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
        }).format(new Date());
        const targetDate = args?.date || todayIST;

        const response = await this.appointmentService.getDoctorAppointments(
          ctx.userId,
          targetDate,
        );
        const appointments: any[] = Array.isArray(response)
          ? response
          : response.data || [];

        const total = appointments.length;
        const confirmed = appointments.filter((a) => a.status === 'CONFIRMED').length;
        const checkedIn = appointments.filter((a) => a.status === 'CHECKED_IN').length;
        const inConsultation = appointments.filter((a) => a.status === 'IN_CONSULTATION').length;
        const completed = appointments.filter((a) => a.status === 'COMPLETED').length;
        const cancelled = appointments.filter((a) => a.status === 'CANCELLED').length;
        const noShow = appointments.filter((a) => a.status === 'NO_SHOW').length;
        const firstAppointment = appointments[0]
          ? { time: appointments[0].startTime, status: appointments[0].status }
          : null;

        const roster = appointments.map((a) => ({
          appointmentId: a.id,
          tokenNumber: a.tokenNumber ?? null,
          date: a.date,
          startTime: a.startTime,
          endTime: a.endTime,
          timeWindow: `${a.startTime} - ${a.endTime}`,
          status: a.status,
          patientId: a.patientId,
          patientName: a.patient?.fullName || 'Patient',
          age: a.patient?.age,
          gender: a.patient?.gender,
          bloodGroup: a.patient?.bloodGroup,
          allergies: a.patient?.allergies,
          reasonForVisit: a.reasonForVisit || a.clinicalNotes || null,
        }));

        const actions = roster.map((p) => ({
          type: 'GET_PATIENT_SUMMARY',
          label: `Summary: ${p.patientName} (${p.tokenNumber ? `#${p.tokenNumber}` : p.startTime})`,
          payload: {
            patientId: p.patientId,
            patientName: p.patientName,
          },
        }));

        return {
          success: true,
          dataType: 'DOCTOR_DAILY_SCHEDULE',
          data: {
            date: targetDate,
            total,
            confirmed,
            checkedIn,
            inConsultation,
            completed,
            cancelled,
            noShow,
            firstAppointment,
            counts: {
              confirmed,
              checkedIn,
              inConsultation,
              completed,
              cancelled,
              noShow,
            },
            roster,
          },
          actions,
        };
      },
    });

    // getDoctorDailySchedule
    this.register({
      name: 'getDoctorDailySchedule',
      description:
        "Fetches the authenticated doctor's appointment roster and schedule for today (or a specified date). Returns counts, token numbers, patient demographics, and quick actions to review each patient's summary.",
      permittedRoles: [Role.DOCTOR],
      declaration: {
        name: 'getDoctorDailySchedule',
        description:
          "Returns doctor's appointment roster and patient list for today or a specific date with quick summary actions.",
        parameters: {
          type: 'OBJECT',
          properties: {
            date: {
              type: 'STRING',
              description: 'Optional date in YYYY-MM-DD format (defaults to today)',
            },
          },
        },
      },
      execute: async (ctx, args) => {
        const todayIST = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
        }).format(new Date());
        const targetDate = args?.date || todayIST;

        const response = await this.appointmentService.getDoctorAppointments(
          ctx.userId,
          targetDate,
        );
        const appointments: any[] = Array.isArray(response)
          ? response
          : response.data || [];

        const total = appointments.length;
        const confirmed = appointments.filter((a) => a.status === 'CONFIRMED').length;
        const checkedIn = appointments.filter((a) => a.status === 'CHECKED_IN').length;
        const inConsultation = appointments.filter((a) => a.status === 'IN_CONSULTATION').length;
        const completed = appointments.filter((a) => a.status === 'COMPLETED').length;
        const cancelled = appointments.filter((a) => a.status === 'CANCELLED').length;
        const noShow = appointments.filter((a) => a.status === 'NO_SHOW').length;

        const roster = appointments.map((a) => ({
          appointmentId: a.id,
          tokenNumber: a.tokenNumber ?? null,
          date: a.date,
          startTime: a.startTime,
          endTime: a.endTime,
          timeWindow: `${a.startTime} - ${a.endTime}`,
          status: a.status,
          patientId: a.patientId,
          patientName: a.patient?.fullName || 'Patient',
          age: a.patient?.age,
          gender: a.patient?.gender,
          bloodGroup: a.patient?.bloodGroup,
          allergies: a.patient?.allergies,
          reasonForVisit: a.reasonForVisit || a.clinicalNotes || null,
        }));

        const actions = roster.map((p) => ({
          type: 'GET_PATIENT_SUMMARY',
          label: `Summary: ${p.patientName} (${p.tokenNumber ? `#${p.tokenNumber}` : p.startTime})`,
          payload: {
            patientId: p.patientId,
            patientName: p.patientName,
          },
        }));

        return {
          success: true,
          dataType: 'DOCTOR_DAILY_SCHEDULE',
          data: {
            date: targetDate,
            total,
            counts: {
              confirmed,
              checkedIn,
              inConsultation,
              completed,
              cancelled,
              noShow,
            },
            roster,
          },
          actions,
        };
      },
    });

    // getPatientClinicalSummary
    this.register({
      name: 'getPatientClinicalSummary',
      description:
        "Fetches a 30-second clinical summary/dossier of a patient for the authenticated doctor. Includes critical safety alerts (known drug allergies, medical history, current medications), last consultation notes, previous diagnosis, and prescribed medicines with dosages. Can be queried by patient name or patientId.",
      permittedRoles: [Role.DOCTOR],
      declaration: {
        name: 'getPatientClinicalSummary',
        description:
          "Returns the patient's medical history, allergies, past diagnoses, previous prescriptions, and today's appointment status for the doctor.",
        parameters: {
          type: 'OBJECT',
          properties: {
            patientName: {
              type: 'STRING',
              description: 'The name or partial name of the patient (e.g. "Raj", "Raj Kumar", "Priya").',
            },
            patientId: {
              type: 'STRING',
              description: 'Optional UUID of the patient if already known.',
            },
          },
          required: ['patientName'],
        },
      },
      execute: async (ctx, args) => {
        const patientName = (args?.patientName || '').trim();
        const patientId = args?.patientId;

        const doctor = await this.doctorService.findByUserIdOrFail(ctx.userId);

        let targetPatientId = patientId;

        if (!targetPatientId) {
          const searchResult = await this.doctorService.getDoctorPatients(
            ctx.userId,
            patientName,
          );
          const patients = searchResult?.data || [];

          if (patients.length === 0) {
            return {
              success: false,
              message: `Doctor, aapke clinic records me "${patientName}" naam ka koi patient nahi mila.`,
            };
          }

          if (patients.length > 1) {
            // Check for exact case-insensitive match
            const exactMatches = patients.filter(
              (p: any) => p.fullName.toLowerCase() === patientName.toLowerCase(),
            );
            if (exactMatches.length === 1) {
              targetPatientId = exactMatches[0].id;
            } else {
              // Return disambiguation list
              return {
                success: true,
                dataType: 'MULTIPLE_PATIENTS_FOUND',
                message: `Multiple patients found matching "${patientName}". Please select one:`,
                data: {
                  query: patientName,
                  matches: patients.map((p: any) => ({
                    id: p.id,
                    fullName: p.fullName,
                    age: p.age,
                    gender: p.gender,
                    phone: p.phone,
                    lastVisit: p.lastVisit?.date || null,
                  })),
                },
                actions: patients.map((p: any) => ({
                  type: 'GET_PATIENT_SUMMARY',
                  label: `${p.fullName} (${p.age}y, ${p.gender})`,
                  payload: { patientId: p.id, patientName: p.fullName },
                })),
              };
            }
          } else {
            targetPatientId = patients[0].id;
          }
        }

        // Fetch full patient clinical record for this doctor
        const recordResponse = await this.doctorService.getDoctorPatientRecord(
          ctx.userId,
          targetPatientId,
        );
        const recordData = recordResponse.data;
        const patient = recordData.patient;

        // Fetch prescriptions issued for this patient by this doctor
        const prescriptions =
          await this.prescriptionService.getPrescriptionsByDoctorAndPatient(
            doctor.id,
            targetPatientId,
          );

        const latestPrescription = prescriptions[0] || null;
        const prescribedMedicines = latestPrescription?.medicines || [];
        const lastDiagnosis =
          latestPrescription?.diagnosis ||
          recordData.allClinicalNotes?.[0]?.notes ||
          null;

        // Check if there is an appointment today
        const todayIST = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
        }).format(new Date());

        const todayAppt = recordData.appointments?.find(
          (a: any) => a.date === todayIST,
        );

        const summaryPayload = {
          patient: {
            id: patient.id,
            fullName: patient.fullName,
            age: patient.age,
            gender: patient.gender,
            bloodGroup: patient.bloodGroup || 'Not specified',
            phone: patient.phone,
          },
          safetyAlerts: {
            allergies: patient.allergies || 'No known drug allergies reported',
            hasAllergyAlert: Boolean(
              patient.allergies &&
                patient.allergies.trim().length > 0 &&
                !['none', 'nil', 'no', 'na'].includes(patient.allergies.trim().toLowerCase()),
            ),
            medicalHistory: patient.medicalHistory || 'No major chronic conditions recorded',
            currentMedication: patient.currentMedication || 'None',
          },
          consultationStats: {
            totalVisits: recordData.stats.totalVisits,
            completedVisits: recordData.stats.completedVisits,
            lastVisitDate: recordData.stats.lastVisitDate,
          },
          lastConsultation: {
            date: recordData.stats.lastVisitDate || (latestPrescription?.createdAt ? new Date(latestPrescription.createdAt).toISOString().split('T')[0] : null),
            diagnosis: lastDiagnosis || 'Routine Consultation / Checkup',
            clinicalNotes: recordData.allClinicalNotes?.[0]?.notes || latestPrescription?.notes || null,
            symptoms: latestPrescription?.symptoms || recordData.appointments?.[0]?.reasonForVisit || null,
            vitals: latestPrescription?.vitals || null,
            prescribedMedicines: prescribedMedicines.map((m: any) => ({
              name: m.name,
              dosage: m.dosage,
              frequency: m.frequency,
              timing: m.timing,
              duration: m.duration,
              instructions: m.instructions || '',
            })),
          },
          todayAppointment: todayAppt
            ? {
                id: todayAppt.id,
                tokenNumber: todayAppt.tokenNumber,
                timeWindow: `${todayAppt.startTime} - ${todayAppt.endTime}`,
                status: todayAppt.status,
              }
            : null,
        };

        return {
          success: true,
          dataType: 'PATIENT_CLINICAL_SUMMARY',
          data: summaryPayload,
          actions: [
            {
              type: 'VIEW_PATIENT_RECORDS',
              label: `Open Full Records of ${patient.fullName}`,
              payload: { patientId: patient.id },
            },
          ],
        };
      },
    });

    // getDoctorAvailability
    this.register({
      name: 'getDoctorAvailability',
      description:
        "Fetches the authenticated doctor's recurring weekly availability and overrides.",
      permittedRoles: [Role.DOCTOR],
      declaration: {
        name: 'getDoctorAvailability',
        description:
          "Fetches the authenticated doctor's configured availability slots and shifts.",
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      execute: async (ctx) => {
        const availability =
          await this.availabilityService.getDetailedAvailability(ctx.userId);
        return {
          success: true,
          data: this.permissionService.sanitizeToolOutput(availability),
        };
      },
    });

    // getDoctorAppointmentsByDate
    this.register({
      name: 'getDoctorAppointmentsByDate',
      description:
        "Fetches the authenticated doctor's appointments for a specific date (YYYY-MM-DD).",
      permittedRoles: [Role.DOCTOR],
      declaration: {
        name: 'getDoctorAppointmentsByDate',
        description: 'Returns appointments of the doctor on a specific date.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: {
              type: 'STRING',
              description: 'Date in YYYY-MM-DD format (e.g. 2026-11-10)',
            },
          },
          required: ['date'],
        },
      },
      execute: async (ctx, args) => {
        if (!args.date) {
          throw new BadRequestException('Date is required');
        }
        const response = await this.appointmentService.getDoctorAppointments(
          ctx.userId,
          args.date,
        );
        const list = Array.isArray(response) ? response : response.data || [];
        return {
          success: true,
          data: this.permissionService.sanitizeToolOutput(list),
        };
      },
    });

    // getDoctorSchedule
    this.register({
      name: 'getDoctorSchedule',
      description:
        "Fetches the full schedule overview for the authenticated doctor, including active shifts, slot durations, buffer times, and leave days.",
      permittedRoles: [Role.DOCTOR],
      declaration: {
        name: 'getDoctorSchedule',
        description: 'Returns the full working schedule and leaves for the doctor.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      execute: async (ctx) => {
        const availability =
          await this.availabilityService.getDetailedAvailability(ctx.userId);
        return {
          success: true,
          data: this.permissionService.sanitizeToolOutput(availability),
        };
      },
    });

    // getDoctorSchedulingConflicts
    this.register({
      name: 'getDoctorSchedulingConflicts',
      description:
        'Checks if there are conflicting appointments for a given date or shift.',
      permittedRoles: [Role.DOCTOR],
      declaration: {
        name: 'getDoctorSchedulingConflicts',
        description: 'Finds any scheduling conflicts or overlapping bookings.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: {
              type: 'STRING',
              description: 'Date to inspect in YYYY-MM-DD format',
            },
          },
          required: ['date'],
        },
      },
      execute: async (ctx, args) => {
        const apptResponse =
          await this.appointmentService.getDoctorAppointments(
            ctx.userId,
            args.date,
          );
        const appointments: any[] = Array.isArray(apptResponse)
          ? apptResponse
          : apptResponse.data || [];

        // Identify overlapping or double-booked slots if any
        const timeMap = new Map<string, any[]>();
        for (const appt of appointments) {
          if (appt.status === 'CONFIRMED') {
            const list = timeMap.get(appt.startTime) || [];
            list.push(appt);
            timeMap.set(appt.startTime, list);
          }
        }

        const conflicts: any[] = [];
        for (const [time, list] of timeMap.entries()) {
          if (list.length > 1) {
            conflicts.push({
              time,
              count: list.length,
              appointments: list.map((a) => a.id),
            });
          }
        }

        return {
          success: true,
          data: {
            date: args.date,
            hasConflicts: conflicts.length > 0,
            conflicts,
          },
        };
      },
    });

    // previewDoctorSmartReschedule
    this.register({
      name: 'previewDoctorSmartReschedule',
      description:
        'Doctor preview for smart reschedule options when doctor wants to move appointments or leaves.',
      permittedRoles: [Role.DOCTOR],
      declaration: {
        name: 'previewDoctorSmartReschedule',
        description:
          'Previews smart reschedule options for appointments affected by shift changes.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: {
              type: 'STRING',
              description: 'The affected date (YYYY-MM-DD)',
            },
          },
          required: ['date'],
        },
      },
      execute: async (ctx, args) => {
        if (!args.date) {
          throw new BadRequestException('Date is required');
        }
        // First find doctor's appointments for that date
        const apptResponse =
          await this.appointmentService.getDoctorAppointments(
            ctx.userId,
            args.date,
          );
        const appointments: any[] = Array.isArray(apptResponse)
          ? apptResponse
          : apptResponse.data || [];

        const activeApptIds = appointments
          .filter((a) => a.status === 'CONFIRMED')
          .map((a) => a.id);

        if (activeApptIds.length === 0) {
          return {
            success: true,
            data: {
              message: `No confirmed appointments found on ${args.date} to reschedule.`,
              rescheduleCandidates: [],
            },
          };
        }

        const preview =
          await this.elasticSchedulingService.smartReschedulePreview(
            ctx.userId,
            { appointmentIds: activeApptIds },
          );
        return {
          success: true,
          data: this.permissionService.sanitizeToolOutput(preview),
        };
      },
    });

    // previewDoctorSetAvailability
    this.register({
      name: 'previewDoctorSetAvailability',
      description:
        'Previews setting recurring or custom date availability for the authenticated doctor. If required details like days of week/date, start time, end time, or slot duration are missing, prompts the doctor for the missing details before previewing.',
      permittedRoles: [Role.DOCTOR],
      declaration: {
        name: 'previewDoctorSetAvailability',
        description:
          'Previews setting doctor availability. Validates all required fields and asks for clarification if any are missing.',
        parameters: {
          type: 'OBJECT',
          properties: {
            shiftType: {
              type: 'STRING',
              description: "Type of shift: 'RECURRING' (every week) or 'CUSTOM' (specific date). Default is RECURRING.",
            },
            dayOfWeek: {
              type: 'STRING',
              description: "Day of the week (e.g. 'MONDAY', 'SUNDAY').",
            },
            daysOfWeek: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              description: "Array of days of the week, e.g. ['SUNDAY'] or ['MONDAY', 'WEDNESDAY'].",
            },
            specificDate: {
              type: 'STRING',
              description: 'Date in YYYY-MM-DD format (required if shiftType is CUSTOM).',
            },
            startTime: {
              type: 'STRING',
              description: "Shift start time in 24-hr HH:MM format (e.g. '09:00', '10:00').",
            },
            endTime: {
              type: 'STRING',
              description: "Shift end time in 24-hr HH:MM format (e.g. '12:00', '17:00').",
            },
            slotDuration: {
              type: 'INTEGER',
              description: 'Duration of each consultation slot in minutes (e.g. 15, 20, 30).',
            },
            schedulingType: {
              type: 'STRING',
              description: "'STREAM' (default, 1 patient per slot) or 'WAVE' (group slots).",
            },
          },
          required: ['startTime', 'endTime'],
        },
      },
      execute: async (ctx, args) => {
        const startTime: string = args.startTime;
        const endTime: string = args.endTime;
        const shiftType: string = (args.shiftType || 'RECURRING').toUpperCase();
        const slotDuration: number | undefined = args.slotDuration ? Number(args.slotDuration) : undefined;
        const schedulingType: string = (args.schedulingType || 'STREAM').toUpperCase();

        let daysOfWeek: string[] | undefined = args.daysOfWeek;
        if (!daysOfWeek && args.dayOfWeek) {
          daysOfWeek = [args.dayOfWeek.toUpperCase()];
        }

        const missingFields: string[] = [];
        if (!daysOfWeek && !args.specificDate) {
          missingFields.push('dayOfWeek or specificDate');
        }
        if (!startTime) {
          missingFields.push('startTime');
        }
        if (!endTime) {
          missingFields.push('endTime');
        }
        if (!slotDuration) {
          missingFields.push('slotDuration (e.g. 15, 20, 30 minutes)');
        }

        if (missingFields.length > 0) {
          return {
            success: false,
            data: {
              needsClarification: true,
              missingFields,
              providedDetails: {
                shiftType,
                daysOfWeek,
                specificDate: args.specificDate,
                startTime,
                endTime,
                slotDuration,
              },
              guidance:
                'Please ask the doctor for the missing details before confirming availability.',
            },
          };
        }

        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        if (startMins >= endMins) {
          return {
            success: false,
            error: 'End time must be after start time.',
          };
        }

        const totalMinutes = endMins - startMins;
        const estSlots = Math.floor(totalMinutes / (slotDuration || 15));
        const dayName = daysOfWeek ? daysOfWeek.join(', ') : args.specificDate;
        const summaryText = shiftType === 'RECURRING'
          ? 'Recurring shift for ' + dayName + ' from ' + startTime + ' to ' + endTime + ' (' + (slotDuration || 15) + ' mins/slot, ~' + estSlots + ' slots).'
          : 'Custom shift for ' + dayName + ' from ' + startTime + ' to ' + endTime + ' (' + (slotDuration || 15) + ' mins/slot, ~' + estSlots + ' slots).';

        const pending = this.sessionService.createPendingConfirmation(
          ctx.userId,
          (args as any)?.conversationId || '',
          'SET_DOCTOR_AVAILABILITY',
          {
            shiftType,
            daysOfWeek,
            specificDate: args.specificDate,
            startTime,
            endTime,
            slotDuration: slotDuration || 15,
            schedulingType,
            totalEstimatedSlots: estSlots,
          },
          summaryText,
        );

        return {
          success: true,
          requiresConfirmation: true,
          confirmationId: pending.id,
          expiresAt: pending.expiresAt.toISOString(),
          data: {
            actionType: 'SET_DOCTOR_AVAILABILITY',
            shiftType,
            day: dayName,
            daysOfWeek,
            specificDate: args.specificDate,
            startTime,
            endTime,
            slotDuration: slotDuration || 15,
            schedulingType,
            totalEstimatedSlots: estSlots,
            summary: summaryText,
          },
          actions: [
            {
              type: 'CONFIRM_AVAILABILITY',
              label: 'Confirm & Set ' + dayName + ' (' + startTime + ' - ' + endTime + ')',
              data: {
                confirmationId: pending.id,
              },
            },
          ],
        };
      },
    });

    // previewDoctorElasticSchedule
    this.register({
      name: 'previewDoctorElasticSchedule',
      description:
        'Previews expanding or shrinking an existing shift for the doctor. For shrink, checks conflicts and identifies affected appointments that will automatically receive reschedule requests upon confirmation.',
      permittedRoles: [Role.DOCTOR],
      declaration: {
        name: 'previewDoctorElasticSchedule',
        description:
          'Previews expanding or shrinking a shift. Validates capacity and reports affected appointments with automatic reschedule dispatch upon confirmation.',
        parameters: {
          type: 'OBJECT',
          properties: {
            actionType: {
              type: 'STRING',
              description: "'EXPAND' (increase hours) or 'SHRINK' (decrease hours).",
            },
            shiftId: {
              type: 'STRING',
              description: 'Optional ID of the shift. If omitted, the shift is resolved using dayOfWeek or date.',
            },
            shiftType: {
              type: 'STRING',
              description: "'RECURRING' or 'CUSTOM'. Default is 'RECURRING'.",
            },
            date: {
              type: 'STRING',
              description: 'Date in YYYY-MM-DD format (e.g. today or tomorrow).',
            },
            dayOfWeek: {
              type: 'STRING',
              description: "Day of week (e.g. 'FRIDAY', 'SUNDAY').",
            },
            newStartTime: {
              type: 'STRING',
              description: "New start time in HH:MM (e.g. '09:00').",
            },
            newEndTime: {
              type: 'STRING',
              description: "New end time in HH:MM (e.g. '11:00').",
            },
          },
          required: ['actionType', 'newStartTime', 'newEndTime'],
        },
      },
      execute: async (ctx, args) => {
        const actionType = (args.actionType || 'SHRINK').toUpperCase();
        const newStartTime: string = args.newStartTime;
        const newEndTime: string = args.newEndTime;
        const shiftType: string = (args.shiftType || 'RECURRING').toUpperCase();
        const targetDate: string = args.date || getTodayIST();

        let targetShiftId: string | undefined = args.shiftId;
        const doctorAvailability =
          await this.availabilityService.getDetailedAvailability(ctx.userId);

        if (!targetShiftId) {
          if (shiftType === 'CUSTOM' && args.date) {
            const custom = doctorAvailability.customOverrides?.find(
              (c) => c.date === args.date,
            );
            if (custom) targetShiftId = custom.id;
          } else {
            const dayTarget = (
              args.dayOfWeek ||
              new Date(targetDate).toLocaleDateString('en-US', {
                weekday: 'long',
              })
            ).toUpperCase();
            const rec = doctorAvailability.recurring?.find(
              (r) => r.dayOfWeek?.toUpperCase() === dayTarget,
            );
            if (rec) targetShiftId = rec.id;
          }
        }

        if (!targetShiftId) {
          const firstShift =
            doctorAvailability.recurring?.[0] ||
            doctorAvailability.customOverrides?.[0];
          if (firstShift) {
            targetShiftId = firstShift.id;
          } else {
            return {
              success: false,
              error:
                'No active shifts found for this doctor to shrink or expand. Please set availability first.',
            };
          }
        }

        if (actionType === 'EXPAND') {
          const summaryText = 'Expand shift to ' + newStartTime + ' - ' + newEndTime + ' on ' + targetDate + '. This will open additional appointment slots.';
          const pending = this.sessionService.createPendingConfirmation(
            ctx.userId,
            (args as any)?.conversationId || '',
            'APPLY_DOCTOR_EXPAND',
            {
              shiftId: targetShiftId,
              shiftType,
              newStartTime,
              newEndTime,
              date: targetDate,
            },
            summaryText,
          );

          return {
            success: true,
            requiresConfirmation: true,
            confirmationId: pending.id,
            expiresAt: pending.expiresAt.toISOString(),
            data: {
              actionType: 'APPLY_DOCTOR_EXPAND',
              shiftId: targetShiftId,
              shiftType,
              newStartTime,
              newEndTime,
              date: targetDate,
              summary: summaryText,
            },
            actions: [
              {
                type: 'CONFIRM_EXPAND',
                label: 'Confirm Expansion (' + newStartTime + ' - ' + newEndTime + ')',
                data: { confirmationId: pending.id },
              },
            ],
          };
        }

        // SHRINK ACTION: Check conflicts and affected appointments
        const conflicts = await this.elasticSchedulingService.checkShrinkConflicts(
          ctx.userId,
          {
            shiftId: targetShiftId,
            shiftType: shiftType as any,
            newStartTime,
            newEndTime,
          },
        );

        const affectedAppts = (conflicts.affectedAppointments || []).map((a) => ({
          appointmentId: a.appointmentId,
          patientName: a.patientName || 'Patient',
          tokenNumber: a.tokenNumber,
          date: a.date,
          startTime: a.startTime,
          endTime: a.endTime,
        }));

        const summaryText =
          conflicts.conflictCount > 0
            ? 'Shrinking shift to ' + newStartTime + ' - ' + newEndTime + ' affects ' + conflicts.conflictCount + ' existing appointment(s). Confirming will automatically notify affected patients and send reschedule requests.'
            : 'Shrinking shift to ' + newStartTime + ' - ' + newEndTime + '. No existing appointments will be affected.';

        const pending = this.sessionService.createPendingConfirmation(
          ctx.userId,
          (args as any)?.conversationId || '',
          'APPLY_DOCTOR_SHRINK',
          {
            shiftId: targetShiftId,
            shiftType,
            newStartTime,
            newEndTime,
            date: targetDate,
            conflictCount: conflicts.conflictCount || affectedAppts.length,
            affectedAppointments: affectedAppts,
            forceIfNoConflicts: true,
          },
          summaryText,
        );

        return {
          success: true,
          requiresConfirmation: true,
          confirmationId: pending.id,
          expiresAt: pending.expiresAt.toISOString(),
          data: {
            actionType: 'APPLY_DOCTOR_SHRINK',
            shiftId: targetShiftId,
            shiftType,
            newStartTime,
            newEndTime,
            date: targetDate,
            hasConflicts: conflicts.hasConflicts,
            conflictCount: conflicts.conflictCount || affectedAppts.length,
            affectedAppointments: affectedAppts,
            summary: summaryText,
          },
          actions: [
            {
              type: 'CONFIRM_SHRINK',
              label:
                conflicts.conflictCount > 0
                  ? 'Confirm Shrink & Auto-Notify (' + conflicts.conflictCount + ' affected)'
                  : 'Confirm Shrink (' + newStartTime + ' - ' + newEndTime + ')',
              data: { confirmationId: pending.id },
            },
          ],
        };
      },
    });


    // =========================================================================
    // 2. PATIENT TOOLS
    // =========================================================================

    // checkSymptomsAndRecommendDoctors (AI-Driven Symptom Analysis & Doctor Triage)
    this.register({
      name: 'checkSymptomsAndRecommendDoctors',
      description:
        'Analyzes patient symptoms or clinical specialization, checks for critical emergency red flags, finds matching doctors in that field with their earliest free available booking slots, and transparently offers General Physician alternatives if the exact specialist is not registered.',
      permittedRoles: [Role.PATIENT],
      declaration: {
        name: 'checkSymptomsAndRecommendDoctors',
        description:
          'Finds doctors and their next available free slots for the patient’s symptoms or specialization. If the requested specialist is unavailable or not on the platform, returns General Physician alternatives.',
        parameters: {
          type: 'OBJECT',
          properties: {
            symptoms: {
              type: 'STRING',
              description:
                'The health complaints described by the patient (e.g. "muu me chaale", "severe headache and vomiting", "seene me dard", "skin rash and itching").',
            },
            specialization: {
              type: 'STRING',
              description:
                'Optional medical specialization determined by the AI (e.g. "cardiologist", "dentist", "dermatologist", "ent specialist", "general physician", "neurologist", "orthopedist", "pediatrician").',
            },
          },
          required: ['symptoms'],
        },
      },
      execute: async (ctx, args) => {
        if (!args?.symptoms) {
          throw new BadRequestException('Symptoms description is required');
        }

        const triage = triageSymptoms(args.symptoms, args.specialization);
        const requestedSpec = (args.specialization || '').trim().toLowerCase();

        // 1. Determine target specialization: either AI's explicit judgment or fallback triage helper
        let targetSpec: string = triage.primarySpecialization;
        let isKnownSpecialty = true;

        if (requestedSpec) {
          if (isValidSpecialization(requestedSpec)) {
            targetSpec = normalizeSpecialization(requestedSpec);
          } else {
            isKnownSpecialty = false;
          }
        }

        let docResult: any = null;
        let foundExactSpecialist = false;

        // 2. If specialty is valid in our system, search for doctors in that category
        if (isKnownSpecialty) {
          docResult = await this.doctorService.findAll({
            specialization: targetSpec,
            page: 1,
            limit: 3,
          });
          if (docResult?.data && docResult.data.length > 0) {
            foundExactSpecialist = true;
          }
        }

        // 3. Fallback: If exact specialist is not registered on the platform or has 0 doctors,
        // provide General Physicians as the safe primary clinical alternative!
        if (!foundExactSpecialist) {
          docResult = await this.doctorService.findAll({
            specialization: 'general physician',
            page: 1,
            limit: 3,
          });
          // If still no general physician, fetch any active verified doctor
          if (!docResult?.data || docResult.data.length === 0) {
            docResult = await this.doctorService.findAll({
              page: 1,
              limit: 3,
            });
          }
        }

        const doctors = docResult?.data || [];
        const todayIST = getTodayIST();

        // 4. For each doctor, lookup their next available slot
        const doctorSummaries: any[] = [];
        const actions: any[] = [];

        for (const doc of doctors) {
          let nextSlot: any = null;
          try {
            nextSlot = await this.availabilityService.findNextAvailableSlot(doc.id, todayIST);
          } catch (err: any) {
            this.logger.warn(`Could not fetch next slot for doctor ${doc.id}: ${err.message}`);
          }

          const docSummary = {
            id: doc.id,
            name: doc.fullName || 'Doctor',
            specialization: doc.specialization,
            experience: doc.experience ?? 0,
            consultationFee: doc.consultationFee ?? 500,
            qualification: doc.qualification || 'MBBS',
            clinic: doc.profileDetails || 'CareUp Healthcare Clinic',
            profileUrl: `/doctors/${doc.id}`,
            nextSlot: nextSlot
              ? {
                  date: nextSlot.date,
                  startTime: nextSlot.startTime,
                  endTime: nextSlot.endTime,
                }
              : null,
          };
          doctorSummaries.push(docSummary);

          // Action 1: Quick slot booking if available
          if (nextSlot) {
            actions.push({
              type: 'BOOK_DOCTOR_SLOT',
              label: `Book Dr. ${docSummary.name} (${nextSlot.date} at ${nextSlot.startTime})`,
              data: {
                doctorId: doc.id,
                doctorName: docSummary.name,
                date: nextSlot.date,
                startTime: nextSlot.startTime,
                fee: docSummary.consultationFee,
              },
            });
          }

          // Action 2: Direct link/action to view doctor profile
          actions.push({
            type: 'VIEW_DOCTOR_PROFILE',
            label: `View Dr. ${docSummary.name}'s Profile`,
            data: {
              doctorId: doc.id,
              doctorName: docSummary.name,
              profileUrl: `/doctors/${doc.id}`,
            },
          });
        }

        return {
          success: true,
          data: {
            symptoms: args.symptoms,
            foundExactSpecialist,
            requestedSpecialization: args.specialization || targetSpec,
            suggestedSpecialization: targetSpec,
            fallbackSpecialization: foundExactSpecialist ? null : 'general physician',
            triageResult: {
              specialization: targetSpec,
              explanation: triage.explanation,
              isEmergency: triage.isEmergency,
              emergencyNotice: triage.emergencyNotice,
              urgencyLevel: triage.urgencyLevel,
            },
            doctors: doctorSummaries,
          },
          actions,
        };
      },
    });

    // getMyAppointments
    this.register({
      name: 'getMyAppointments',
      description:
        'Fetches all appointments of the authenticated patient (upcoming and past).',
      permittedRoles: [Role.PATIENT],
      declaration: {
        name: 'getMyAppointments',
        description: 'Returns the list of appointments for the logged-in patient.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      execute: async (ctx) => {
        const appts = await this.appointmentService.getPatientAppointments(
          ctx.userId,
        );
        const list = Array.isArray(appts) ? appts : appts.data || [];
        return {
          success: true,
          data: this.permissionService.sanitizeToolOutput(list),
        };
      },
    });

    // getAvailableDoctors
    this.register({
      name: 'getAvailableDoctors',
      description:
        'Searches for verified doctors by specialization or general discovery.',
      permittedRoles: [Role.PATIENT],
      declaration: {
        name: 'getAvailableDoctors',
        description: 'Finds verified doctors available for booking.',
        parameters: {
          type: 'OBJECT',
          properties: {
            specialization: {
              type: 'STRING',
              description:
                'Optional specialization (e.g. Cardiology, Dermatology)',
            },
            search: {
              type: 'STRING',
              description: 'Optional doctor name search query',
            },
          },
        },
      },
      execute: async (ctx, args) => {
        const result = await this.doctorService.findAll({
          specialization: args?.specialization,
          search: args?.search,
          page: 1,
          limit: 10,
        });
        const sanitized = result.data.map((d: any) => ({
          id: d.id,
          name: d.fullName,
          specialization: d.specialization,
          experience: d.experience,
          consultationFee: d.consultationFee,
        }));
        return {
          success: true,
          data: sanitized,
        };
      },
    });

    // getAvailableSlots
    this.register({
      name: 'getAvailableSlots',
      description:
        'Fetches available booking time slots for a doctor on a given date (YYYY-MM-DD). If doctorId is not specified for a patient, uses their existing/latest appointment doctor.',
      permittedRoles: [Role.PATIENT],
      declaration: {
        name: 'getAvailableSlots',
        description: 'Returns available time slots for booking on a specific date.',
        parameters: {
          type: 'OBJECT',
          properties: {
            doctorId: {
              type: 'STRING',
              description: 'The UUID of the doctor (optional if patient has previous appointments)',
            },
            date: {
              type: 'STRING',
              description: 'The date in YYYY-MM-DD format',
            },
          },
          required: ['date'],
        },
      },
      execute: async (ctx, args) => {
        let doctorId = args?.doctorId;
        if (!doctorId) {
          const apptsRes = await this.appointmentService.getPatientAppointments(ctx.userId);
          const appts = Array.isArray(apptsRes) ? apptsRes : apptsRes?.data || [];
          if (appts.length > 0 && appts[0].doctor) {
            doctorId = appts[0].doctor.id || appts[0].doctorId;
          }
        }
        if (!doctorId || !args?.date) {
          throw new BadRequestException('doctorId and date are required');
        }
        const slots = await this.availabilityService.getAvailableSlots(
          doctorId,
          args.date,
        );
        const openSlots = slots.filter(
          (s) =>
            s.status === SlotStatus.AVAILABLE ||
            s.status === SlotStatus.CANCEL_AND_AVAILABLE,
        );
        return {
          success: true,
          data: {
            doctorId,
            date: args.date,
            slots: openSlots,
          },
        };
      },
    });

    // findNextAvailableSlot
    this.register({
      name: 'findNextAvailableSlot',
      description:
        'Finds the earliest next available free slot for a doctor across upcoming days (up to 30 days ahead). Use this when the user asks for next available slot, next free appointment, or when today/tomorrow is fully booked.',
      permittedRoles: [Role.PATIENT, Role.DOCTOR],
      declaration: {
        name: 'findNextAvailableSlot',
        description:
          'Finds the next free available appointment slot for a doctor across upcoming days.',
        parameters: {
          type: 'OBJECT',
          properties: {
            doctorId: {
              type: 'STRING',
              description:
                'Optional Doctor UUID. If omitted for patients, uses their current/latest appointment doctor.',
            },
            fromDate: {
              type: 'STRING',
              description:
                'Optional date in YYYY-MM-DD format from which to start searching. Defaults to today.',
            },
          },
        },
      },
      execute: async (ctx, args) => {
        let doctorId = args?.doctorId;
        let doctorName = '';

        if (!doctorId) {
          if (ctx.role === Role.DOCTOR) {
            const doc = await this.doctorService.getProfile(ctx.userId);
            doctorId = doc?.id;
            doctorName = doc?.fullName || 'Doctor';
          } else {
            const apptsRes = await this.appointmentService.getPatientAppointments(ctx.userId);
            const appts = Array.isArray(apptsRes) ? apptsRes : apptsRes?.data || [];
            if (appts.length > 0 && appts[0].doctor) {
              doctorId = appts[0].doctor.id || appts[0].doctorId;
              doctorName = appts[0].doctor.fullName || 'Doctor';
            }
          }
        }

        if (!doctorId) {
          return {
            success: false,
            error: 'Doctor not specified and no previous appointment doctor found. Please specify doctor name or ID.',
          };
        }

        if (!doctorName) {
          try {
            const docRes = await this.doctorService.findById(doctorId);
            const docData = docRes?.data || docRes;
            doctorName = docData?.fullName || 'Doctor';
          } catch {}
        }

        const startFrom = args?.fromDate || getTodayIST();
        const nextSlot = await this.availabilityService.findNextAvailableSlot(doctorId, startFrom);

        if (!nextSlot) {
          return {
            success: true,
            data: {
              found: false,
              doctorId,
              doctorName,
              message: `Doctor ${doctorName} ke paas agle 30 dino me koi free slot available nahi hai.`,
            },
          };
        }

        return {
          success: true,
          data: {
            found: true,
            doctorId,
            doctorName,
            date: nextSlot.date,
            startTime: nextSlot.startTime,
            endTime: nextSlot.endTime,
            schedulingType: nextSlot.schedulingType,
            availableCount: nextSlot.availableCount,
          },
        };
      },
    });

    // previewAppointmentBooking (Two-step safety - Section 8)
    this.register({
      name: 'previewAppointmentBooking',
      description:
        'Prepares a booking preview and requests explicit patient confirmation. Does NOT book directly.',
      permittedRoles: [Role.PATIENT],
      declaration: {
        name: 'previewAppointmentBooking',
        description:
          'Prepares booking confirmation card with doctor, date, time and fee.',
        parameters: {
          type: 'OBJECT',
          properties: {
            doctorId: { type: 'STRING', description: 'Doctor UUID' },
            date: { type: 'STRING', description: 'YYYY-MM-DD' },
            startTime: { type: 'STRING', description: 'HH:MM slot start time' },
          },
          required: ['doctorId', 'date', 'startTime'],
        },
      },
      execute: async (ctx, args) => {
        const docRes = await this.doctorService.findById(args.doctorId);
        const doctor: any = docRes?.data || docRes;
        if (!doctor) {
          throw new NotFoundException('Doctor not found');
        }

        // Verify slot is currently open
        const slots = await this.availabilityService.getAvailableSlots(
          args.doctorId,
          args.date,
        );
        const slot = slots.find(
          (s) =>
            s.startTime === args.startTime &&
            (s.status === SlotStatus.AVAILABLE ||
              s.status === SlotStatus.CANCEL_AND_AVAILABLE),
        );
        if (!slot) {
          return {
            success: false,
            error: `Selected slot ${args.startTime} is not available on ${args.date}. Please choose another slot.`,
          };
        }

        const doctorName = doctor.fullName || 'Doctor';
        const fee = doctor.consultationFee ?? 500;
        const summary = `Book appointment with Dr. ${doctorName} on ${args.date} at ${args.startTime}. Fee: Rs. ${fee}.`;

        const pending = this.sessionService.createPendingConfirmation(
          ctx.userId,
          args.conversationId || 'default',
          'BOOK_APPOINTMENT',
          {
            doctorId: doctor.id,
            doctorName,
            date: args.date,
            startTime: args.startTime,
            endTime: slot.endTime,
            fee,
          },
          summary,
        );

        return {
          success: true,
          requiresConfirmation: true,
          confirmationId: pending.id,
          expiresAt: pending.expiresAt.toISOString(),
          data: {
            doctor: doctorName,
            date: args.date,
            time: args.startTime,
            fee,
          },
          actions: [
            {
              type: 'CONFIRM_BOOKING',
              label: 'Confirm Booking',
              data: { confirmationId: pending.id },
            },
            {
              type: 'CANCEL',
              label: 'Cancel',
            },
          ],
        };
      },
    });

    // previewAppointmentReschedule
    this.register({
      name: 'previewAppointmentReschedule',
      description:
        'Prepares a reschedule preview and requests explicit patient confirmation.',
      permittedRoles: [Role.PATIENT],
      declaration: {
        name: 'previewAppointmentReschedule',
        description: 'Creates a preview card for rescheduling an appointment.',
        parameters: {
          type: 'OBJECT',
          properties: {
            appointmentId: {
              type: 'STRING',
              description: 'The appointment UUID to reschedule',
            },
            newDate: {
              type: 'STRING',
              description: 'New date in YYYY-MM-DD format',
            },
            newStartTime: {
              type: 'STRING',
              description: 'New start time in HH:MM format',
            },
          },
          required: ['appointmentId', 'newDate', 'newStartTime'],
        },
      },
      execute: async (ctx, args) => {
        const apptsRes = await this.appointmentService.getPatientAppointments(
          ctx.userId,
        );
        const appts: any[] = Array.isArray(apptsRes) ? apptsRes : apptsRes.data || [];
        const appt = appts.find((a) => a.id === args.appointmentId);
        if (!appt) {
          throw new NotFoundException('Appointment not found or not owned by you');
        }

        // Check new slot availability
        const slots = await this.availabilityService.getAvailableSlots(
          appt.doctorId,
          args.newDate,
        );
        const slot = slots.find(
          (s) =>
            s.startTime === args.newStartTime &&
            (s.status === SlotStatus.AVAILABLE ||
              s.status === SlotStatus.CANCEL_AND_AVAILABLE),
        );
        if (!slot) {
          return {
            success: false,
            error: `Selected slot ${args.newStartTime} on ${args.newDate} is not available.`,
          };
        }

        const doctorName = appt.doctor?.fullName || 'Doctor';
        const summary = `Reschedule appointment with Dr. ${doctorName} from ${appt.date} ${appt.startTime} to ${args.newDate} at ${args.newStartTime}.`;

        const pending = this.sessionService.createPendingConfirmation(
          ctx.userId,
          args.conversationId || 'default',
          'RESCHEDULE_APPOINTMENT',
          {
            appointmentId: appt.id,
            doctorName,
            oldDate: appt.date,
            oldTime: appt.startTime,
            newDate: args.newDate,
            newStartTime: args.newStartTime,
          },
          summary,
        );

        return {
          success: true,
          requiresConfirmation: true,
          confirmationId: pending.id,
          expiresAt: pending.expiresAt.toISOString(),
          data: {
            doctor: doctorName,
            oldDate: appt.date,
            oldTime: appt.startTime,
            newDate: args.newDate,
            newTime: args.newStartTime,
          },
          actions: [
            {
              type: 'CONFIRM_RESCHEDULE',
              label: 'Confirm Reschedule',
              data: { confirmationId: pending.id },
            },
            {
              type: 'CANCEL',
              label: 'Cancel',
            },
          ],
        };
      },
    });

    // previewAppointmentCancellation
    this.register({
      name: 'previewAppointmentCancellation',
      description:
        'Prepares appointment cancellation preview, calculates refund policy, and requests explicit patient confirmation.',
      permittedRoles: [Role.PATIENT],
      declaration: {
        name: 'previewAppointmentCancellation',
        description: 'Creates a cancellation preview with refund policy details.',
        parameters: {
          type: 'OBJECT',
          properties: {
            appointmentId: {
              type: 'STRING',
              description: 'The appointment UUID to cancel',
            },
            reason: {
              type: 'STRING',
              description: 'Optional cancellation reason',
            },
          },
          required: ['appointmentId'],
        },
      },
      execute: async (ctx, args) => {
        const apptsRes = await this.appointmentService.getPatientAppointments(
          ctx.userId,
        );
        const appts: any[] = Array.isArray(apptsRes) ? apptsRes : apptsRes.data || [];
        const appt = appts.find((a) => a.id === args.appointmentId);
        if (!appt) {
          throw new NotFoundException('Appointment not found or not owned by you');
        }

        if (appt.status === 'CANCELLED') {
          return {
            success: false,
            error: 'Yeh appointment pehle se hi cancel ho chuka hai.',
          };
        }

        const doctorName = appt.doctor?.fullName || 'Doctor';
        const summary = `Cancel appointment with Dr. ${doctorName} on ${appt.date} at ${appt.startTime}.`;

        const pending = this.sessionService.createPendingConfirmation(
          ctx.userId,
          args.conversationId || 'default',
          'CANCEL_APPOINTMENT',
          {
            appointmentId: appt.id,
            doctorName,
            date: appt.date,
            time: appt.startTime,
            reason: args.reason || 'Cancelled via AI Assistant',
          },
          summary,
        );

        return {
          success: true,
          requiresConfirmation: true,
          confirmationId: pending.id,
          expiresAt: pending.expiresAt.toISOString(),
          data: {
            doctor: doctorName,
            date: appt.date,
            time: appt.startTime,
          },
          actions: [
            {
              type: 'CONFIRM_CANCELLATION',
              label: 'Confirm Cancellation',
              data: { confirmationId: pending.id },
            },
            {
              type: 'CANCEL',
              label: 'Do not cancel',
            },
          ],
        };
      },
    });

    // getMyPrescriptions (Section 3E Data Privacy: high-level status only)
    this.register({
      name: 'getMyPrescriptions',
      description:
        'Checks high-level prescription availability for the authenticated patient without exposing confidential medical diagnoses.',
      permittedRoles: [Role.PATIENT],
      declaration: {
        name: 'getMyPrescriptions',
        description: 'Returns available prescription statuses for the patient.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      execute: async (ctx) => {
        const list = await this.prescriptionService.getPatientPrescriptions(
          ctx.userId,
        );
        // Data minimization: Return count and appointment dates only, NEVER medicine names or diagnoses
        const summary = list.map((p) => ({
          prescriptionId: p.id,
          date: p.appointment?.date || 'Available',
          doctor: p.doctor?.fullName || 'Doctor',
          status: 'Prescription Available',
        }));

        const actions = list.map((p) => ({
          type: 'EXPLAIN_PRESCRIPTION',
          label: `Dr. ${p.doctor?.fullName || 'Doctor'} ka prescription samjhao`,
          data: {
            prescriptionId: p.id,
            doctorName: p.doctor?.fullName || 'Doctor',
          },
        }));

        return {
          success: true,
          data: summary,
          actions,
        };
      },
    });

    // explainPrescriptionDetails (AI Prescription & Medication Explainer)
    this.register({
      name: 'explainPrescriptionDetails',
      description:
        'Explains and translates the patient’s doctor prescription into simple, easy-to-understand language. Explains each medicine name, purpose, dosage, frequency (morning/night), timing (empty stomach/after food), doctor advice, and follow-up checkup date.',
      permittedRoles: [Role.PATIENT],
      declaration: {
        name: 'explainPrescriptionDetails',
        description:
          'Decodes the patient prescription into an easy-to-understand medication timetable and home-care advice.',
        parameters: {
          type: 'OBJECT',
          properties: {
            prescriptionId: {
              type: 'STRING',
              description: 'Optional UUID of the prescription to explain.',
            },
            doctorName: {
              type: 'STRING',
              description: 'Optional doctor name to look up prescription.',
            },
          },
        },
      },
      execute: async (ctx, args) => {
        const list = await this.prescriptionService.getPatientPrescriptions(
          ctx.userId,
        );
        if (!list || list.length === 0) {
          return {
            success: true,
            data: {
              found: false,
              message: 'Aapka abhi tak koi prescription record nahi mila hai.',
            },
          };
        }

        // Find the target prescription
        let selected: any = null;
        if (args?.prescriptionId) {
          selected = list.find((p) => p.id === args.prescriptionId);
        }
        if (!selected && args?.doctorName) {
          const lowerDoc = args.doctorName.toLowerCase();
          selected = list.find((p) =>
            (p.doctor?.fullName || '').toLowerCase().includes(lowerDoc),
          );
        }
        if (!selected) {
          selected = list[0]; // default to most recent
        }

        const frequencyMap: Record<string, string> = {
          '1-0-1': 'Subah aur Raat (din me 2 baar)',
          '1-1-1': 'Subah, Dopahar aur Raat (din me 3 baar)',
          '1-0-0': 'Sirf Subah (din me 1 baar)',
          '0-0-1': 'Sirf Raat ko sone se pehle (din me 1 baar)',
          '0-1-0': 'Sirf Dopahar me (din me 1 baar)',
          'SOS': 'Sirf zaroorat padne par (takleef ya dard hone par)',
        };

        const timingMap: Record<string, string> = {
          'After Food': 'Khana khane ke baad',
          'Before Food': 'Khana khane se pehle',
          'Empty Stomach': 'Subah khali pet (nashte se 30 min pehle)',
          'At Bedtime': 'Raat ko sone se pehle',
        };

        const formattedMedicines = (selected.medicines || []).map(
          (m: any, idx: number) => ({
            itemNumber: idx + 1,
            medicineName: m.name,
            dosage: m.dosage || '1 Tablet',
            timing: timingMap[m.timing] || m.timing || 'Khana khane ke baad',
            frequency:
              frequencyMap[m.frequency] || m.frequency || 'Doctor ke bataye anusaar',
            duration: m.duration || 'Course poora karein',
            instructions: m.instructions || 'Paani ke sath lein',
          }),
        );

        return {
          success: true,
          data: {
            found: true,
            prescriptionId: selected.id,
            doctorName: selected.doctor?.fullName || 'Doctor',
            specialization: selected.doctor?.specialization || 'Consultant',
            date: selected.appointment?.date || 'Recent',
            diagnosis: selected.diagnosis || 'General Consultation',
            advice: selected.advice || 'Paryapt paani piyein aur aaraam karein.',
            followUpDate: selected.followUpDate || 'Jarurat padne par',
            medicines: formattedMedicines,
          },
        };
      },
    });

    // getMyPaymentStatus
    this.register({
      name: 'getMyPaymentStatus',
      description:
        'Checks payment and refund statuses for the authenticated patient.',
      permittedRoles: [Role.PATIENT],
      declaration: {
        name: 'getMyPaymentStatus',
        description: 'Returns payment transaction statuses.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      execute: async (ctx) => {
        const historyRes = await this.paymentService.getPatientPaymentHistory(
          ctx.userId,
        );
        const history: any[] = Array.isArray(historyRes)
          ? historyRes
          : historyRes.data || [];

        // Sanitize: remove razorpay order/payment IDs
        const sanitized = history.map((item: any) => ({
          appointmentDate: item.appointment?.date,
          doctorName: item.appointment?.doctor?.fullName,
          amount: item.amount,
          status: item.status,
          refundStatus: item.refund?.status || 'None',
        }));
        return {
          success: true,
          data: sanitized,
        };
      },
    });

    // getMyNotificationPreferences
    this.register({
      name: 'getMyNotificationPreferences',
      description: 'Checks notification channel preferences for the user.',
      permittedRoles: [Role.PATIENT, Role.DOCTOR],
      declaration: {
        name: 'getMyNotificationPreferences',
        description: 'Returns active notification channels (Email, SMS, WhatsApp).',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      execute: async (ctx) => {
        const prefs = await this.notificationService.getUserPreferences(
          ctx.userId,
        );
        return {
          success: true,
          data: prefs,
        };
      },
    });
  }

  /**
   * Executes a pending confirmation safely (Section 7 & 8).
   * Validates confirmationId ownership, expiry, and executes existing services.
   */
  async executeConfirmation(
    confirmationId: string,
    userId: string,
  ): Promise<ToolExecutionResult> {
    const pending = this.sessionService.getPendingConfirmation(
      confirmationId,
      userId,
    );
    if (!pending) {
      return {
        success: false,
        error:
          'Yeh confirmation invalid hai ya expire ho chuka hai (5 minute time limit). Kripya dobara request karein.',
      };
    }

    try {
      if (pending.actionType === 'BOOK_APPOINTMENT') {
        const payload = pending.actionPayload;
        // Revalidate availability immediately before booking
        const slots = await this.availabilityService.getAvailableSlots(
          payload.doctorId,
          payload.date,
        );
        const slot = slots.find(
          (s) =>
            s.startTime === payload.startTime &&
            (s.status === SlotStatus.AVAILABLE ||
              s.status === SlotStatus.CANCEL_AND_AVAILABLE),
        );
        if (!slot) {
          this.sessionService.clearPendingConfirmation(confirmationId);
          return {
            success: false,
            error:
              'Yeh slot abhi kisi aur ne book kar liya hai. Kripya doosra slot chunein.',
          };
        }

        const fee = Number(payload.fee ?? 0);
        if (fee > 0) {
          // Paid consultation: Create payment order to hold slot for 15 mins
          const order = await this.paymentService.createOrder(userId, {
            doctorId: payload.doctorId,
            date: payload.date,
            startTime: payload.startTime,
            endTime: payload.endTime || slot.endTime,
            idempotencyKey: `ai_book_${payload.doctorId}_${payload.date}_${payload.startTime}_${Date.now()}`,
          });

          this.sessionService.clearPendingConfirmation(confirmationId);

          const summaryText = `Aapka slot 15 minute ke liye reserve kar diya gaya hai. Kripya Rs. ${fee} ka payment complete karein taaki appointment confirm ho sake.`;

          return {
            success: true,
            requiresPayment: true,
            data: {
              requiresPayment: true,
              paymentOrder: order,
              doctor: payload.doctorName,
              fee,
              date: payload.date,
              time: payload.startTime,
              appointmentId: order.appointmentId,
              message: summaryText,
            },
            actions: [
              {
                type: 'PAY_NOW',
                label: `Pay Rs. ${fee} & Confirm`,
                data: {
                  orderData: order,
                  doctorName: payload.doctorName,
                  fee,
                  appointmentId: order.appointmentId,
                },
              },
            ],
          };
        }

        // Free consultation (fee === 0): Direct booking
        const bookedResponse = await this.appointmentService.bookAppointment(
          userId,
          {
            doctorId: payload.doctorId,
            date: payload.date,
            startTime: payload.startTime,
            endTime: payload.endTime || slot.endTime,
          },
        );

        const bookedData: any = (bookedResponse as any)?.data || bookedResponse;
        this.sessionService.clearPendingConfirmation(confirmationId);
        return {
          success: true,
          data: {
            message: `Aapka free consultation appointment Dr. ${payload.doctorName} ke saath ${payload.date} ko ${payload.startTime} par successfully book ho gaya hai!`,
            appointmentId: bookedData.id,
            tokenNumber: bookedData.tokenNumber,
          },
        };
      }

      if (pending.actionType === 'RESCHEDULE_APPOINTMENT') {
        const payload = pending.actionPayload;
        const resResponse = await this.appointmentService.rescheduleAppointment(
          userId,
          payload.appointmentId,
          {
            date: payload.newDate,
            startTime: payload.newStartTime,
          },
        );

        const resData: any = (resResponse as any)?.data || resResponse;
        const newApptId =
          resData?.newAppointment?.id || resData?.id || payload.appointmentId;

        this.sessionService.clearPendingConfirmation(confirmationId);
        return {
          success: true,
          data: {
            message: `Aapka appointment successfully reschedule ho gaya hai: ${payload.newDate} at ${payload.newStartTime}.`,
            appointmentId: newApptId,
          },
        };
      }

      if (pending.actionType === 'CANCEL_APPOINTMENT') {
        const payload = pending.actionPayload;
        await this.appointmentService.cancelAppointment(
          userId,
          payload.appointmentId,
          payload.reason,
        );

        this.sessionService.clearPendingConfirmation(confirmationId);
        return {
          success: true,
          data: {
            message: `Aapka appointment successfully cancel kar diya gaya hai.`,
            appointmentId: payload.appointmentId,
          },
        };
      }

      if (pending.actionType === 'SET_DOCTOR_AVAILABILITY') {
        const payload = pending.actionPayload;
        if (payload.shiftType === 'CUSTOM') {
          await this.availabilityService.createCustomOverride(userId, {
            date: payload.specificDate,
            startTime: payload.startTime,
            endTime: payload.endTime,
            slotDuration: payload.slotDuration || 15,
            schedulingType: payload.schedulingType || 'STREAM',
            maxPatients: payload.maxPatients,
          });
        } else {
          await this.availabilityService.createRecurring(userId, {
            daysOfWeek: payload.daysOfWeek,
            startTime: payload.startTime,
            endTime: payload.endTime,
            slotDuration: payload.slotDuration || 15,
            schedulingType: payload.schedulingType || 'STREAM',
            maxPatients: payload.maxPatients,
          });
        }

        this.sessionService.clearPendingConfirmation(confirmationId);
        const dayDesc = payload.daysOfWeek ? payload.daysOfWeek.join(', ') : payload.specificDate;
        return {
          success: true,
          data: {
            message: `Availability successfully set for ${dayDesc} (${payload.startTime} - ${payload.endTime}, ${payload.slotDuration || 15} mins/slot).`,
            actionType: 'SET_DOCTOR_AVAILABILITY',
          },
        };
      }

      if (pending.actionType === 'APPLY_DOCTOR_SHRINK') {
        const payload = pending.actionPayload;
        const result = await this.elasticSchedulingService.applyShrink(userId, {
          shiftId: payload.shiftId,
          shiftType: payload.shiftType,
          newStartTime: payload.newStartTime,
          newEndTime: payload.newEndTime,
          forceIfNoConflicts: true,
        });

        this.sessionService.clearPendingConfirmation(confirmationId);
        const conflictMsg =
          payload.conflictCount > 0
            ? `Shift has been shrunken to ${payload.newStartTime} - ${payload.newEndTime}. All ${payload.conflictCount} affected patient(s) have been automatically notified and sent reschedule requests with alternative slots.`
            : `Shift has been safely shrunken to ${payload.newStartTime} - ${payload.newEndTime} with no patient conflicts.`;

        return {
          success: true,
          data: {
            message: conflictMsg,
            actionType: 'APPLY_DOCTOR_SHRINK',
            result,
          },
        };
      }

      if (pending.actionType === 'APPLY_DOCTOR_EXPAND') {
        const payload = pending.actionPayload;
        const result = await this.elasticSchedulingService.expandSchedule(userId, {
          shiftId: payload.shiftId,
          shiftType: payload.shiftType,
          newStartTime: payload.newStartTime,
          newEndTime: payload.newEndTime,
        });

        this.sessionService.clearPendingConfirmation(confirmationId);
        return {
          success: true,
          data: {
            message: `Shift has been expanded to ${payload.newStartTime} - ${payload.newEndTime}. New consultation slots are now available!`,
            actionType: 'APPLY_DOCTOR_EXPAND',
            result,
          },
        };
      }

      return {
        success: false,
        error: 'Unsupported confirmation action.',
      };
    } catch (err: any) {
      this.logger.error(`Error executing confirmation ${confirmationId}:`, err);
      return {
        success: false,
        error: err.message || 'Operation failed. Please try again.',
      };
    }
  }
}
