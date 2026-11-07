import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Appointment } from './appointment.entity';
import { Doctor } from '../../doctor/entities/doctor.entity';
import { Patient } from '../../patient/entities/patient.entity';
import { RescheduleMethod } from '../enums/reschedule-method.enum';
import { RescheduleRequestStatus } from '../enums/reschedule-request-status.enum';
import { SchedulingType } from '../../common/enums/scheduling-type.enum';

@Entity('appointment_reschedule_requests')
@Index(['doctorId', 'status'])
@Index(['patientId', 'status'])
@Index(['proposedDate', 'proposedStartTime', 'status'])
export class AppointmentRescheduleRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  appointmentId: string;

  @ManyToOne(() => Appointment, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({
    type: 'varchar',
    length: 20,
    default: RescheduleMethod.SMART,
  })
  rescheduleMethod: RescheduleMethod;

  @Column({
    type: 'varchar',
    length: 20,
    default: RescheduleRequestStatus.PENDING,
  })
  status: RescheduleRequestStatus;

  @Column({ type: 'date' })
  originalDate: string; // YYYY-MM-DD

  @Column({ type: 'varchar', length: 5 })
  originalStartTime: string; // HH:MM

  @Column({ type: 'varchar', length: 5 })
  originalEndTime: string; // HH:MM

  @Column({ type: 'date' })
  proposedDate: string; // YYYY-MM-DD

  @Column({ type: 'varchar', length: 5 })
  proposedStartTime: string; // HH:MM

  @Column({ type: 'varchar', length: 5 })
  proposedEndTime: string; // HH:MM

  @Column({ type: 'int', nullable: true, default: null })
  proposedTokenNumber: number | null;

  @Column({
    type: 'varchar',
    length: 10,
    default: SchedulingType.STREAM,
  })
  proposedSchedulingType: SchedulingType;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  patientRespondedAt: Date | null;

  @Column({ type: 'text', nullable: true, default: null })
  doctorReason: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  patientNotes: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  refundStatus: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  refundId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

