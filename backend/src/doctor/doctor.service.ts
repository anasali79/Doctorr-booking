import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, In } from 'typeorm';
import { Doctor } from './entities/doctor.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Patient } from '../patient/entities/patient.entity';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { getTodayIST } from '../common/utils/appointment.utils';
import {
  CreateDoctorProfileDto,
  UpdateDoctorProfileDto,
} from './dto/doctor-profile.dto';
import { DoctorDiscoveryQueryDto } from './dto/doctor-discovery-query.dto';
import {
  isValidSpecialization,
  normalizeSpecialization,
  VALID_SPECIALIZATIONS,
} from './constants/specializations';

function mapRecurringToConsultationHours(recurring: RecurringAvailability[]): Record<string, { start: string; end: string }[]> {
  const hours: Record<string, { start: string; end: string }[]> = {};
  for (const slot of recurring) {
    const day = slot.dayOfWeek.toLowerCase();
    if (!hours[day]) {
      hours[day] = [];
    }
    hours[day].push({
      start: slot.startTime,
      end: slot.endTime,
    });
  }
  return hours;
}

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    @InjectRepository(RecurringAvailability)
    private readonly recurringRepository: Repository<RecurringAvailability>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async createProfile(userId: string, dto: CreateDoctorProfileDto) {
    const existing = await this.doctorRepository.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Doctor profile already exists');
    }

    const profile = this.doctorRepository.create({ userId, ...dto });
    const saved = await this.doctorRepository.save(profile);
    return this.toResponse(saved, []);
  }

  async getProfile(userId: string) {
    const profile = await this.findByUserIdOrFail(userId);
    const recurring = await this.recurringRepository.find({ where: { doctorId: profile.id } });
    return this.toResponse(profile, recurring);
  }

  async updateProfile(userId: string, dto: UpdateDoctorProfileDto) {
    const profile = await this.findByUserIdOrFail(userId);
    Object.assign(profile, dto);
    const saved = await this.doctorRepository.save(profile);
    const recurring = await this.recurringRepository.find({ where: { doctorId: profile.id } });
    return this.toResponse(profile, recurring);
  }

  /**
   * P0-5: Real doctor dashboard with stats computed from appointments table
   */
  async getDashboard(userId: string) {
    const doctor = await this.findByUserIdOrFail(userId);
    const todayStr = getTodayIST();

    // Get all appointments for this doctor
    const allAppointments = await this.appointmentRepository.find({
      where: { doctorId: doctor.id },
      relations: { patient: true },
    });

    const getDateStr = (val: any) => {
      if (!val) return '';
      if (typeof val === 'string') return val.split('T')[0];
      if (val instanceof Date) {
        const year = val.getFullYear();
        const month = String(val.getMonth() + 1).padStart(2, '0');
        const day = String(val.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return String(val).split('T')[0];
    };

    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();

    // Check each appointment: if CONFIRMED and slot end time has elapsed on todayStr (or past date), auto-mark NO_SHOW
    for (const a of allAppointments) {
      const aDate = getDateStr(a.date);
      if (a.status === AppointmentStatus.CONFIRMED) {
        let isPastTime = false;
        if (aDate === todayStr) {
          const [endH, endM] = (a.endTime || a.startTime).split(':').map(Number);
          const endMinutes = (endH || 0) * 60 + (endM || 0);
          isPastTime = currentMinutes > endMinutes;
        }
        if (aDate < todayStr || isPastTime) {
          a.status = AppointmentStatus.NO_SHOW;
          this.appointmentRepository.update(a.id, { status: AppointmentStatus.NO_SHOW }).catch(() => {});
        }
      }
    }

    const todayAppointments = allAppointments.filter(
      a => getDateStr(a.date) === todayStr && a.status !== AppointmentStatus.RESCHEDULED,
    );

    // Ensure sequential real tokens for today's appointments
    const sortedToday = todayAppointments.sort((a, b) => a.startTime.localeCompare(b.startTime));
    sortedToday.forEach((appt, idx) => {
      if (!appt.tokenNumber || appt.tokenNumber <= 0) {
        appt.tokenNumber = idx + 1;
        this.appointmentRepository.update(appt.id, { tokenNumber: idx + 1 }).catch(() => {});
      }
    });

    const upcoming = allAppointments.filter(
      a =>
        getDateStr(a.date) >= todayStr &&
        [AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_CONSULTATION].includes(a.status),
    );
    const completed = allAppointments.filter(a => a.status === AppointmentStatus.COMPLETED);
    const cancelled = allAppointments.filter(a => a.status === AppointmentStatus.CANCELLED);
    const noShow = allAppointments.filter(a => a.status === AppointmentStatus.NO_SHOW);

    // Unique patient IDs
    const uniquePatients = new Set(allAppointments.map(a => a.patientId).filter(Boolean));

    return {
      message: 'Doctor dashboard retrieved successfully',
      data: {
        doctorId: doctor.id,
        stats: {
          today: todayAppointments.length,
          upcoming: upcoming.length,
          completed: completed.length,
          cancelled: cancelled.length,
          noShow: noShow.length,
          totalPatients: uniquePatients.size,
        },
        todayAppointments: todayAppointments
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map(appt => ({
            id: appt.id,
            date: appt.date,
            startTime: appt.startTime,
            endTime: appt.endTime,
            status: appt.status,
            tokenNumber: appt.tokenNumber,
            queuePosition: appt.queuePosition,
            estimatedWaitTime: appt.estimatedWaitTime,
            checkedInAt: appt.checkedInAt,
            patient: appt.patient ? {
              id: appt.patient.id,
              fullName: appt.patient.fullName,
              age: appt.patient.age,
              gender: appt.patient.gender,
              phone: appt.patient.phone,
            } : null,
          })),
      },
    };
  }

  async findAll(query: DoctorDiscoveryQueryDto) {
    if (query.specialization && !isValidSpecialization(query.specialization)) {
      throw new BadRequestException(
        `Invalid specialization. Valid values: ${this.getSpecializationList().join(', ')}`,
      );
    }

    const qb = this.doctorRepository.createQueryBuilder('doctor');

    if (query.specialization) {
      qb.andWhere('LOWER(doctor.specialization) = :specialization', {
        specialization: normalizeSpecialization(query.specialization),
      });
    }

    if (query.search) {
      this.applyPartialNameSearch(qb, query.search);
    }

    qb.orderBy('doctor.fullName', 'ASC');

    const doctors = await qb.getMany();

    // Fetch recurring slots for all matching doctors to perform dynamic availability checks
    const doctorIds = doctors.map((d) => d.id);
    const slotsByDoctor: Record<string, RecurringAvailability[]> = {};
    if (doctorIds.length > 0) {
      const recurringSlots = await this.recurringRepository.find({
        where: { doctorId: In(doctorIds) },
      });
      for (const slot of recurringSlots) {
        if (!slotsByDoctor[slot.doctorId]) {
          slotsByDoctor[slot.doctorId] = [];
        }
        slotsByDoctor[slot.doctorId].push(slot);
      }
    }

    const filtered = doctors.filter((doctor) => {
      const slots = slotsByDoctor[doctor.id] || [];
      const hasSlots = slots.length > 0;
      if (query.availability === undefined) {
        return true;
      }
      return query.availability ? hasSlots : !hasSlots;
    });

    const total = filtered.length;
    const page = query.page;
    const limit = query.limit;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      message:
        total === 0
          ? 'No doctors found matching your criteria'
          : 'Doctors retrieved successfully',
      data: paginated.map((doctor) =>
        this.toDiscoverySummary(doctor, slotsByDoctor[doctor.id] || []),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string) {
    const doctor = await this.doctorRepository.findOne({ where: { id } });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    const recurring = await this.recurringRepository.find({ where: { doctorId: doctor.id } });

    return {
      message: 'Doctor details retrieved successfully',
      data: this.toDiscoveryDetail(doctor, recurring),
    };
  }

  getSpecializationList() {
    return [...VALID_SPECIALIZATIONS];
  }

  private applyPartialNameSearch(
    qb: SelectQueryBuilder<Doctor>,
    search: string,
  ) {
    const terms = search.split(/\s+/).filter(Boolean);

    terms.forEach((term, index) => {
      const param = `searchTerm${index}`;
      qb.andWhere(`doctor.fullName ILIKE :${param}`, {
        [param]: `%${this.escapeLikePattern(term)}%`,
      });
    });
  }

  private escapeLikePattern(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&');
  }

  private toDiscoverySummary(doctor: Doctor, recurring: RecurringAvailability[]) {
    return {
      id: doctor.id,
      fullName: doctor.fullName,
      specialization: doctor.specialization,
      experience: doctor.experience,
      consultationFee: Number(doctor.consultationFee),
      availabilityStatus: recurring.length > 0 ? 'available' : 'unavailable',
    };
  }

  private toDiscoveryDetail(doctor: Doctor, recurring: RecurringAvailability[]) {
    return {
      ...this.toDiscoverySummary(doctor, recurring),
      qualification: doctor.qualification,
      consultationHours: mapRecurringToConsultationHours(recurring),
      profileDetails: doctor.profileDetails,
      allowFutureBooking: doctor.allowFutureBooking,
      maxFutureBookingDays: doctor.maxFutureBookingDays,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    };
  }

  private async findByUserIdOrFail(userId: string): Promise<Doctor> {
    const profile = await this.doctorRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }
    return profile;
  }

  private toResponse(profile: Doctor, recurring: RecurringAvailability[]) {
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      specialization: profile.specialization,
      experience: profile.experience,
      qualification: profile.qualification,
      consultationFee: Number(profile.consultationFee),
      consultationHours: mapRecurringToConsultationHours(recurring),
      profileDetails: profile.profileDetails,
      allowFutureBooking: profile.allowFutureBooking,
      maxFutureBookingDays: profile.maxFutureBookingDays,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  // ─── DOCTOR PATIENTS & MEDICAL RECORD MANAGEMENT ──────────────────────────

  /**
   * Retrieves all unique patients who have booked consultations with this doctor.
   * Includes complete patient demographics, medical history tags, and consultation statistics.
   */
  async getDoctorPatients(userId: string, search?: string) {
    const doctor = await this.findByUserIdOrFail(userId);

    const appointments = await this.appointmentRepository.find({
      where: { doctorId: doctor.id },
      order: { date: 'DESC', startTime: 'DESC' },
      relations: { patient: true },
    });

    // Group appointments by unique patientId
    const patientMap = new Map<string, {
      patient: Patient;
      appointments: Appointment[];
    }>();

    for (const appt of appointments) {
      if (!appt.patient || !appt.patientId) continue;
      if (!patientMap.has(appt.patientId)) {
        patientMap.set(appt.patientId, {
          patient: appt.patient,
          appointments: [],
        });
      }
      patientMap.get(appt.patientId)!.appointments.push(appt);
    }

    const today = getTodayIST();
    const result: Array<{
      id: string;
      fullName: string;
      age: number;
      gender: string;
      phone: string;
      address: string | null;
      basicHealthInfo: string | null;
      allergies: string | null;
      medicalHistory: string | null;
      currentMedication: string | null;
      bloodGroup: string | null;
      createdAt: Date;
      totalAppointments: number;
      completedVisits: number;
      cancelledVisits: number;
      lastVisit: {
        id: string;
        date: string;
        startTime: string;
        status: string;
        clinicalNotes: string | null;
        tokenNumber: number | null;
        reasonForVisit: string | null;
      } | null;
      nextAppointment: {
        id: string;
        date: string;
        startTime: string;
        tokenNumber: number | null;
      } | null;
      recentClinicalNotes: Array<{
        appointmentId: string;
        date: string;
        notes: string;
      }>;
    }> = [];

    for (const [_, data] of patientMap.entries()) {
      const p = data.patient;
      const appts = data.appointments;

      const completed = appts.filter((a) => a.status === AppointmentStatus.COMPLETED).length;
      const cancelled = appts.filter((a) => a.status === AppointmentStatus.CANCELLED).length;
      const lastAppt = appts[0] || null;

      // Find earliest future confirmed appointment
      const upcoming = appts
        .filter((a) => a.date >= today && [AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_CONSULTATION].includes(a.status))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0] || null;

      // Collect clinical notes written by this doctor
      const notesHistory = appts
        .filter((a) => !!a.clinicalNotes && a.clinicalNotes.trim().length > 0)
        .map((a) => ({
          appointmentId: a.id,
          date: a.date,
          notes: a.clinicalNotes!,
        }));

      result.push({
        id: p.id,
        fullName: p.fullName,
        age: p.age,
        gender: p.gender,
        phone: p.phone,
        address: p.address,
        basicHealthInfo: p.basicHealthInfo,
        allergies: p.allergies,
        medicalHistory: p.medicalHistory,
        currentMedication: p.currentMedication,
        bloodGroup: p.bloodGroup,
        createdAt: p.createdAt,
        totalAppointments: appts.length,
        completedVisits: completed,
        cancelledVisits: cancelled,
        lastVisit: lastAppt ? {
          id: lastAppt.id,
          date: lastAppt.date,
          startTime: lastAppt.startTime,
          status: lastAppt.status,
          clinicalNotes: lastAppt.clinicalNotes || null,
          tokenNumber: lastAppt.tokenNumber,
          reasonForVisit: lastAppt.reasonForVisit || null,
        } : null,
        nextAppointment: upcoming ? {
          id: upcoming.id,
          date: upcoming.date,
          startTime: upcoming.startTime,
          tokenNumber: upcoming.tokenNumber,
        } : null,
        recentClinicalNotes: notesHistory.slice(0, 5),
      });
    }

    // Filter by search query if provided
    let filtered = result;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = result.filter((item) =>
        item.fullName.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        (item.allergies && item.allergies.toLowerCase().includes(q)) ||
        (item.medicalHistory && item.medicalHistory.toLowerCase().includes(q)) ||
        (item.basicHealthInfo && item.basicHealthInfo.toLowerCase().includes(q)) ||
        (item.bloodGroup && item.bloodGroup.toLowerCase().includes(q))
      );
    }

    // Sort by last visit date descending
    filtered.sort((a, b) => {
      const dateA = a.lastVisit?.date || '';
      const dateB = b.lastVisit?.date || '';
      return dateB.localeCompare(dateA);
    });

    return {
      success: true,
      count: filtered.length,
      data: filtered,
    };
  }

  /**
   * Retrieves full medical record & complete consultation history of a specific patient for this doctor.
   */
  async getDoctorPatientRecord(userId: string, patientId: string) {
    const doctor = await this.findByUserIdOrFail(userId);

    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient record not found');
    }

    const appointments = await this.appointmentRepository.find({
      where: { doctorId: doctor.id, patientId: patient.id },
      order: { date: 'DESC', startTime: 'DESC' },
    });

    const completedVisits = appointments.filter(
      (a) => a.status === AppointmentStatus.COMPLETED,
    ).length;

    const allClinicalNotes = appointments
      .filter((a) => !!a.clinicalNotes && a.clinicalNotes.trim().length > 0)
      .map((a) => ({
        appointmentId: a.id,
        date: a.date,
        time: a.startTime,
        tokenNumber: a.tokenNumber,
        notes: a.clinicalNotes,
        reasonForVisit: a.reasonForVisit || null,
      }));

    return {
      success: true,
      data: {
        patient: {
          id: patient.id,
          fullName: patient.fullName,
          age: patient.age,
          gender: patient.gender,
          phone: patient.phone,
          address: patient.address,
          basicHealthInfo: patient.basicHealthInfo,
          allergies: patient.allergies,
          medicalHistory: patient.medicalHistory,
          currentMedication: patient.currentMedication,
          bloodGroup: patient.bloodGroup,
          registeredAt: patient.createdAt,
        },
        stats: {
          totalVisits: appointments.length,
          completedVisits,
          lastVisitDate: appointments[0]?.date || null,
        },
        appointments: appointments.map((a) => ({
          id: a.id,
          date: a.date,
          startTime: a.startTime,
          endTime: a.endTime,
          status: a.status,
          tokenNumber: a.tokenNumber,
          paymentStatus: a.paymentStatus,
          clinicalNotes: a.clinicalNotes || null,
          reasonForVisit: a.reasonForVisit || null,
          checkedInAt: a.checkedInAt,
          completedAt: a.completedAt,
        })),
        allClinicalNotes,
      },
    };
  }

  /**
   * Saves or appends clinical consultation notes for a specific appointment.
   */
  async saveAppointmentClinicalNotes(
    userId: string,
    appointmentId: string,
    notes: string,
    reasonForVisit?: string,
  ) {
    const doctor = await this.findByUserIdOrFail(userId);

    const appointment = await this.appointmentRepository.findOne({
      where: { id: appointmentId },
      relations: { patient: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.doctorId !== doctor.id) {
      throw new BadRequestException('Unauthorized: You are not the consulting doctor for this appointment');
    }

    appointment.clinicalNotes = notes;
    if (reasonForVisit !== undefined) {
      appointment.reasonForVisit = reasonForVisit;
    }

    const saved = await this.appointmentRepository.save(appointment);

    return {
      success: true,
      message: 'Clinical notes saved successfully',
      data: {
        id: saved.id,
        clinicalNotes: saved.clinicalNotes,
        reasonForVisit: saved.reasonForVisit,
        updatedAt: saved.updatedAt,
      },
    };
  }

  /**
   * Updates patient clinical profile / allergies / conditions from the doctor consultation view.
   */
  async updatePatientMedicalRecordByDoctor(
    userId: string,
    patientId: string,
    dto: {
      allergies?: string;
      medicalHistory?: string;
      currentMedication?: string;
      bloodGroup?: string;
      basicHealthInfo?: string;
    },
  ) {
    await this.findByUserIdOrFail(userId);

    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Patient record not found');
    }

    if (dto.allergies !== undefined) patient.allergies = dto.allergies;
    if (dto.medicalHistory !== undefined) patient.medicalHistory = dto.medicalHistory;
    if (dto.currentMedication !== undefined) patient.currentMedication = dto.currentMedication;
    if (dto.bloodGroup !== undefined) patient.bloodGroup = dto.bloodGroup;
    if (dto.basicHealthInfo !== undefined) patient.basicHealthInfo = dto.basicHealthInfo;

    const saved = await this.patientRepository.save(patient);

    return {
      success: true,
      message: 'Patient medical record updated successfully',
      data: saved,
    };
  }
}
