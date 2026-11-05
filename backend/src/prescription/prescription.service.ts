import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription } from './entities/prescription.entity';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { Doctor } from '../doctor/entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { Role } from '../common/enums/role.enum';
import { AppointmentGateway, SOCKET_EVENTS } from '../sockets/appointment.gateway';

@Injectable()
export class PrescriptionService {
  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @Optional()
    private readonly appointmentGateway?: AppointmentGateway,
  ) {}

  private async getDoctorByUserId(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { userId } });
    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found. Please create your profile first.',
      );
    }
    return doctor;
  }

  private async getPatientByUserId(userId: string): Promise<Patient> {
    const patient = await this.patientRepo.findOne({ where: { userId } });
    if (!patient) {
      throw new NotFoundException(
        'Patient profile not found. Please create your profile first.',
      );
    }
    return patient;
  }

  /**
   * Doctor creates or updates a prescription for an appointment
   */
  async createOrUpdate(
    userId: string,
    dto: CreatePrescriptionDto,
  ): Promise<Prescription> {
    const doctor = await this.getDoctorByUserId(userId);

    const appointment = await this.appointmentRepo.findOne({
      where: { id: dto.appointmentId },
      relations: { doctor: true, patient: { user: true } },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    if (appointment.doctorId !== doctor.id) {
      throw new ForbiddenException(
        'You are not authorized to issue a prescription for this appointment.',
      );
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot issue a prescription for a cancelled appointment.',
      );
    }

    // Check if prescription already exists for this appointment
    let prescription = await this.prescriptionRepo.findOne({
      where: { appointmentId: appointment.id },
    });

    const isUpdate = !!prescription;

    if (!prescription) {
      prescription = this.prescriptionRepo.create({
        appointmentId: appointment.id,
        doctorId: doctor.id,
        patientId: appointment.patientId,
      });
    }

    // Assign clinical fields
    prescription.diagnosis = dto.diagnosis.trim();
    prescription.symptoms = dto.symptoms?.trim() || null;
    prescription.vitals = dto.vitals || null;
    prescription.medicines = Array.isArray(dto.medicines) ? dto.medicines : [];
    prescription.labTests = dto.labTests?.trim() || null;
    prescription.advice = dto.advice?.trim() || null;
    prescription.followUpDate = dto.followUpDate?.trim() || null;
    prescription.notes = dto.notes?.trim() || null;

    const savedPrescription = await this.prescriptionRepo.save(prescription);

    // Sync appointment clinical notes
    const clinicalSummary = [
      `Diagnosis: ${dto.diagnosis.trim()}`,
      dto.advice ? `Advice: ${dto.advice.trim()}` : null,
      dto.followUpDate ? `Follow-up: ${dto.followUpDate.trim()}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    appointment.clinicalNotes = clinicalSummary;

    // If appointment is currently in consultation, mark completed
    if (appointment.status === AppointmentStatus.IN_CONSULTATION) {
      appointment.status = AppointmentStatus.COMPLETED;
      appointment.completedAt = new Date();
    }

    await this.appointmentRepo.save(appointment);

    this.appointmentGateway?.emitAppointmentEvent(SOCKET_EVENTS.COMPLETED, {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      status: appointment.status,
      updatedAt: new Date().toISOString(),
    });

    return this.getPrescriptionById(savedPrescription.id, userId, Role.DOCTOR);
  }

  /**
   * Get prescription for a specific appointment
   */
  async getByAppointment(
    appointmentId: string,
    userId: string,
    role: Role | string,
  ): Promise<Prescription> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { appointmentId },
      relations: {
        doctor: { user: true },
        patient: { user: true },
        appointment: true,
      },
    });

    if (!prescription) {
      throw new NotFoundException(
        'No prescription found for this appointment.',
      );
    }

    this.checkAccess(prescription, userId, role);

    return prescription;
  }

  /**
   * Get prescription by its ID
   */
  async getPrescriptionById(
    id: string,
    userId: string,
    role: Role | string,
  ): Promise<Prescription> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id },
      relations: {
        doctor: { user: true },
        patient: { user: true },
        appointment: true,
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found.');
    }

    this.checkAccess(prescription, userId, role);

    return prescription;
  }

  /**
   * Get all prescriptions for the logged-in patient
   */
  async getPatientPrescriptions(userId: string): Promise<Prescription[]> {
    const patient = await this.getPatientByUserId(userId);
    return this.prescriptionRepo.find({
      where: { patientId: patient.id },
      relations: {
        doctor: true,
        appointment: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all prescriptions issued by the logged-in doctor
   */
  async getDoctorPrescriptions(userId: string): Promise<Prescription[]> {
    const doctor = await this.getDoctorByUserId(userId);
    return this.prescriptionRepo.find({
      where: { doctorId: doctor.id },
      relations: {
        patient: true,
        appointment: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  private checkAccess(
    prescription: Prescription,
    userId: string,
    role: Role | string,
  ): void {
    if (role === Role.DOCTOR) {
      if (prescription.doctor?.userId !== userId && prescription.doctorId !== userId) {
        throw new ForbiddenException(
          'You are not authorized to view this prescription.',
        );
      }
      return;
    }

    if (role === Role.PATIENT) {
      if (prescription.patient?.userId !== userId && prescription.patientId !== userId) {
        throw new ForbiddenException(
          'You are not authorized to view this prescription.',
        );
      }
      return;
    }

    throw new ForbiddenException('Access denied.');
  }
}
