import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Receptionist } from './entities/receptionist.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { CreateReceptionistDto } from './dto/create-receptionist.dto';
import { AppointmentService } from '../appointment/appointment.service';
import { CheckInService } from '../check-in/check-in.service';
import { RescheduleAppointmentDto } from '../appointment/dto/reschedule-appointment.dto';
import { AppointmentGateway } from '../sockets/appointment.gateway';
import { Appointment } from '../appointment/entities/appointment.entity';

@Injectable()
export class ReceptionistService {
  constructor(
    @InjectRepository(Receptionist)
    private readonly receptionistRepo: Repository<Receptionist>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @Inject(forwardRef(() => AppointmentService))
    private readonly appointmentService: AppointmentService,
    @Inject(forwardRef(() => CheckInService))
    private readonly checkInService: CheckInService,
    private readonly appointmentGateway: AppointmentGateway,
  ) {}

  private async getDoctorByUserId(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { userId } });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found.');
    }
    return doctor;
  }

  private async getActiveReceptionistByUserId(userId: string): Promise<Receptionist> {
    const receptionist = await this.receptionistRepo.findOne({
      where: { userId },
      relations: { doctor: { user: true }, user: true },
    });
    if (!receptionist) {
      throw new NotFoundException('Receptionist profile not found.');
    }
    if (!receptionist.isActive) {
      throw new ForbiddenException('Receptionist account is currently inactive. Contact your doctor.');
    }
    return receptionist;
  }

  // ─── DOCTOR MANAGEMENT OF RECEPTIONISTS ──────────────────────────────────────

  async createReceptionist(doctorUserId: string, dto: CreateReceptionistDto) {
    const doctor = await this.getDoctorByUserId(doctorUserId);
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('A user with this email address already exists.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepo.create({
      name: dto.fullName.trim(),
      email,
      password: hashedPassword,
      role: Role.RECEPTIONIST,
      isEmailVerified: true,
    });
    await this.userRepo.save(user);

    const receptionist = this.receptionistRepo.create({
      userId: user.id,
      doctorId: doctor.id,
      fullName: dto.fullName.trim(),
      phone: dto.phone?.trim() || null,
      deskNumber: dto.deskNumber?.trim() || null,
      isActive: true,
    });
    await this.receptionistRepo.save(receptionist);

    return {
      message: 'Receptionist onboarded successfully',
      data: {
        id: receptionist.id,
        userId: user.id,
        fullName: receptionist.fullName,
        email: user.email,
        phone: receptionist.phone,
        deskNumber: receptionist.deskNumber,
        isActive: receptionist.isActive,
        createdAt: receptionist.createdAt,
      },
    };
  }

  async getDoctorReceptionists(doctorUserId: string) {
    const doctor = await this.getDoctorByUserId(doctorUserId);

    const receptionists = await this.receptionistRepo.find({
      where: { doctorId: doctor.id },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });

    const data = receptionists.map((r) => ({
      id: r.id,
      userId: r.userId,
      fullName: r.fullName,
      email: r.user?.email || '',
      phone: r.phone,
      deskNumber: r.deskNumber,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));

    return { data };
  }

  async toggleReceptionist(doctorUserId: string, id: string) {
    const doctor = await this.getDoctorByUserId(doctorUserId);

    const receptionist = await this.receptionistRepo.findOne({
      where: { id, doctorId: doctor.id },
      relations: { user: true },
    });
    if (!receptionist) {
      throw new NotFoundException('Receptionist not found for this doctor.');
    }

    receptionist.isActive = !receptionist.isActive;
    await this.receptionistRepo.save(receptionist);

    return {
      message: `Receptionist has been ${receptionist.isActive ? 'activated' : 'deactivated'}.`,
      data: {
        id: receptionist.id,
        isActive: receptionist.isActive,
      },
    };
  }

  async deleteReceptionist(doctorUserId: string, id: string) {
    const doctor = await this.getDoctorByUserId(doctorUserId);

    const receptionist = await this.receptionistRepo.findOne({
      where: { id, doctorId: doctor.id },
    });
    if (!receptionist) {
      throw new NotFoundException('Receptionist not found for this doctor.');
    }

    // Delete user will cascade delete receptionist record
    await this.userRepo.delete(receptionist.userId);

    return {
      message: 'Receptionist removed successfully.',
    };
  }

  // ─── RECEPTIONIST ACTIONS & QUEUE ───────────────────────────────────────────

  async getReceptionistMe(userId: string) {
    const receptionist = await this.getActiveReceptionistByUserId(userId);

    return {
      data: {
        id: receptionist.id,
        fullName: receptionist.fullName,
        email: receptionist.user?.email,
        phone: receptionist.phone,
        deskNumber: receptionist.deskNumber,
        isActive: receptionist.isActive,
        doctor: {
          id: receptionist.doctor.id,
          fullName: receptionist.doctor.fullName,
          specialization: receptionist.doctor.specialization,
          consultationFee: receptionist.doctor.consultationFee,
          profileDetails: receptionist.doctor.profileDetails,
          phone: receptionist.doctor.phone,
          currentServingToken: receptionist.doctor.currentServingToken,
          email: receptionist.doctor.user?.email,
        },
      },
    };
  }

  async getDoctorQueueForReceptionist(userId: string, date?: string) {
    const receptionist = await this.getActiveReceptionistByUserId(userId);
    const doctor = receptionist.doctor;

    const res = await this.appointmentService.getDoctorAppointments(doctor.userId, date);

    return {
      doctor: {
        id: doctor.id,
        fullName: doctor.fullName,
        specialization: doctor.specialization,
        consultationFee: doctor.consultationFee,
        phone: doctor.phone,
        currentServingToken: doctor.currentServingToken,
      },
      data: res.data || [],
    };
  }

  async getDoctorAllAppointmentsForReceptionist(userId: string) {
    const receptionist = await this.getActiveReceptionistByUserId(userId);
    const doctor = receptionist.doctor;

    const appointments = await this.appointmentRepo.find({
      where: { doctorId: doctor.id },
      relations: { patient: true },
      order: { date: 'DESC', startTime: 'ASC' },
    });

    return {
      doctor: {
        id: doctor.id,
        fullName: doctor.fullName,
        specialization: doctor.specialization,
        consultationFee: doctor.consultationFee,
        phone: doctor.phone,
        currentServingToken: doctor.currentServingToken,
      },
      data: appointments,
    };
  }

  async handleAppointmentAction(userId: string, appointmentId: string, action: string) {
    const receptionist = await this.getActiveReceptionistByUserId(userId);
    const doctor = receptionist.doctor;

    switch (action) {
      case 'manual-check-in':
        return this.checkInService.manualCheckIn(doctor.userId, appointmentId);
      case 'start-consultation':
        return this.checkInService.startConsultation(doctor.userId, appointmentId);
      case 'complete':
        return this.checkInService.completeAppointment(doctor.userId, appointmentId);
      case 'no-show':
        return this.checkInService.markNoShow(doctor.userId, appointmentId);
      default:
        throw new BadRequestException(`Unknown queue action: ${action}`);
    }
  }

  async cancelAppointment(userId: string, appointmentId: string) {
    const receptionist = await this.getActiveReceptionistByUserId(userId);
    return this.appointmentService.cancelAppointmentByDoctor(
      receptionist.doctor.userId,
      appointmentId,
    );
  }

  async rescheduleAppointment(
    userId: string,
    appointmentId: string,
    dto: RescheduleAppointmentDto,
  ) {
    const receptionist = await this.getActiveReceptionistByUserId(userId);
    return this.appointmentService.rescheduleAppointmentByDoctor(
      receptionist.doctor.userId,
      appointmentId,
      dto,
    );
  }

  async createWalkIn(
    userId: string,
    dto: {
      fullName: string;
      phone: string;
      age?: number;
      gender?: string;
      reason?: string;
    },
  ) {
    const receptionist = await this.getActiveReceptionistByUserId(userId);
    return this.appointmentService.createWalkInAppointment(
      receptionist.doctor.userId,
      dto,
    );
  }
}
