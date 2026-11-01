import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { Doctor } from '../../doctor/entities/doctor.entity';
import { Patient } from '../../patient/entities/patient.entity';
import { Appointment } from '../../appointment/entities/appointment.entity';

export interface PrescriptionMedicine {
  name: string;
  dosage: string; // e.g. '1 Tablet', '5 ml', '1 Capsule'
  frequency: string; // e.g. '1-0-1', '1-1-1', '1-0-0', '0-0-1', 'SOS'
  timing: string; // e.g. 'After Food', 'Before Food', 'Empty Stomach', 'At Bedtime'
  duration: string; // e.g. '3 Days', '5 Days', '7 Days', '10 Days', '14 Days'
  instructions?: string; // e.g. 'Take with warm water'
}

export interface PrescriptionVitals {
  bloodPressure?: string;
  pulse?: string;
  temperature?: string;
  weight?: string;
  spo2?: string;
}

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  appointmentId: string;

  @OneToOne(() => Appointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'varchar', length: 255 })
  diagnosis: string;

  @Column({ type: 'text', nullable: true, default: null })
  symptoms: string | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  vitals: PrescriptionVitals | null;

  @Column({ type: 'jsonb', default: '[]' })
  medicines: PrescriptionMedicine[];

  @Column({ type: 'text', nullable: true, default: null })
  labTests: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  advice: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  followUpDate: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
