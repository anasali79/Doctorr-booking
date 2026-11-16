import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorLeave } from './entities/leave.entity';
import { Doctor } from './entities/doctor.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { LeaveStatus } from '../common/enums/leave-status.enum';
import { CreateLeaveDto, UpdateLeaveDto } from './dto/leave.dto';
import { getTodayIST } from '../common/utils/appointment.utils';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(DoctorLeave)
    private readonly leaveRepo: Repository<DoctorLeave>,

    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,

    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
  ) {}

  private async findDoctorByUserIdOrFail(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { userId } });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found. Please create your profile first.');
    }
    return doctor;
  }

  async getLeaves(userId: string): Promise<DoctorLeave[]> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);
    return this.leaveRepo.find({
      where: { doctorId: doctor.id },
      order: { date: 'DESC' },
    });
  }

  async createLeave(userId: string, dto: CreateLeaveDto): Promise<DoctorLeave> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);
    const todayStr = getTodayIST();
    const startDate = dto.date;
    const endDate = dto.endDate || dto.date;

    // Past date check
    if (startDate < todayStr) {
      throw new BadRequestException('Cannot apply leave for a past date');
    }

    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be earlier than start date');
    }

    // Overlapping leave check: look for pending or approved leaves
    const overlapping = await this.leaveRepo
      .createQueryBuilder('leave')
      .where('leave.doctorId = :doctorId', { doctorId: doctor.id })
      .andWhere('leave.status IN (:...statuses)', {
        statuses: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      })
      .andWhere(
        'leave.date <= :endDate AND COALESCE(leave.endDate, leave.date) >= :startDate',
        { startDate, endDate },
      )
      .getOne();

    if (overlapping) {
      const existingRange =
        overlapping.endDate && overlapping.endDate !== overlapping.date
          ? `${overlapping.date} to ${overlapping.endDate}`
          : overlapping.date;
      throw new BadRequestException(
        `A leave is already ${overlapping.status.toLowerCase()} for ${existingRange}.`,
      );
    }

    // Existing appointments check in [startDate, endDate]
    const hasAppointments = await this.appointmentRepo
      .createQueryBuilder('appointment')
      .where('appointment.doctorId = :doctorId', { doctorId: doctor.id })
      .andWhere('appointment.date >= :startDate AND appointment.date <= :endDate', {
        startDate,
        endDate,
      })
      .andWhere('appointment.status NOT IN (:...statuses)', {
        statuses: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED],
      })
      .getOne();

    if (hasAppointments) {
      throw new BadRequestException(
        'Cannot apply leave. Appointments are already booked in this date range. Please cancel or reschedule existing appointments first.',
      );
    }

    const leave = this.leaveRepo.create({
      doctorId: doctor.id,
      date: startDate,
      endDate,
      reason: dto.reason ?? null,
      status: LeaveStatus.PENDING,
    });

    return this.leaveRepo.save(leave);
  }

  async updateLeave(userId: string, id: string, dto: UpdateLeaveDto): Promise<DoctorLeave> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);
    const leave = await this.leaveRepo.findOne({ where: { id } });
    if (!leave) {
      throw new NotFoundException(`Leave with ID ${id} not found`);
    }

    if (leave.doctorId !== doctor.id) {
      throw new ForbiddenException('Access denied: You can only update your own leave');
    }

    const todayStr = getTodayIST();
    const startDate = dto.date || leave.date;
    const endDate =
      dto.endDate !== undefined ? dto.endDate || startDate : leave.endDate || leave.date;

    if (startDate < todayStr) {
      throw new BadRequestException('Cannot apply leave for a past date');
    }

    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be earlier than start date');
    }

    // Overlap check excluding current leave
    const overlapping = await this.leaveRepo
      .createQueryBuilder('leave')
      .where('leave.doctorId = :doctorId AND leave.id != :id', {
        doctorId: doctor.id,
        id: leave.id,
      })
      .andWhere('leave.status IN (:...statuses)', {
        statuses: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      })
      .andWhere(
        'leave.date <= :endDate AND COALESCE(leave.endDate, leave.date) >= :startDate',
        { startDate, endDate },
      )
      .getOne();

    if (overlapping) {
      throw new BadRequestException('A leave is already pending or approved for these dates');
    }

    leave.date = startDate;
    leave.endDate = endDate;
    if (dto.reason !== undefined) {
      leave.reason = dto.reason ?? null;
    }
    // If updating a previously rejected leave, move it back to pending
    if (leave.status === LeaveStatus.REJECTED) {
      leave.status = LeaveStatus.PENDING;
      leave.rejectionReason = null;
    }

    return this.leaveRepo.save(leave);
  }

  async deleteLeave(userId: string, id: string): Promise<void> {
    const doctor = await this.findDoctorByUserIdOrFail(userId);
    const leave = await this.leaveRepo.findOne({ where: { id } });
    if (!leave) {
      throw new NotFoundException(`Leave with ID ${id} not found`);
    }

    if (leave.doctorId !== doctor.id) {
      throw new ForbiddenException('Access denied: You can only delete your own leave');
    }

    await this.leaveRepo.remove(leave);
  }
}
