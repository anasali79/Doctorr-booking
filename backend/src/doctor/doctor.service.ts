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

    const todayAppointments = allAppointments.filter(
      a => getDateStr(a.date) === todayStr && a.status !== AppointmentStatus.RESCHEDULED,
    );
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
}
