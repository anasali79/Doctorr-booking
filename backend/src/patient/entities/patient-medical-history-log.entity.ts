import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from '../../users/entities/user.entity';

@Entity('patient_medical_history_logs')
@Index(['patientId', 'createdAt'])
export class PatientMedicalHistoryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  changedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'changedByUserId' })
  changedByUser: User | null;

  @Column({ type: 'varchar', length: 50 })
  changedByRole: string; // 'DOCTOR' | 'PATIENT' | 'ADMIN'

  @Column({ type: 'varchar', length: 255 })
  changedByName: string; // e.g. "Dr. Sarah Khan" or "Rahul Sharma (Patient)"

  @Column({ type: 'varchar', length: 100 })
  fieldName: string; // 'allergies' | 'medicalHistory' | 'currentMedication' | 'bloodGroup' | 'basicHealthInfo'

  @Column({ type: 'varchar', length: 150, nullable: true })
  fieldLabel: string | null;

  @Column({ type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ type: 'text', nullable: true })
  newValue: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  changeReason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
