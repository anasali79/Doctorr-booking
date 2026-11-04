import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Doctor } from '../../doctor/entities/doctor.entity';
import { VerificationStatus } from '../../common/enums/verification-status.enum';

@Entity('doctor_verifications')
export class DoctorVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  doctorId: string;

  @OneToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({
    type: 'varchar',
    length: 50,
    default: VerificationStatus.NOT_SUBMITTED,
  })
  status: VerificationStatus;

  // ─── Personal & Professional Information ───────────────────────────────────

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  fullName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  degree: string | null; // MBBS, MD, MS, etc.

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  specialization: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  medicalRegistrationNumber: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  registrationAuthority: string | null; // State Medical Council

  @Column({ type: 'int', nullable: true, default: null })
  experience: number | null;

  // ─── Practice Information ───────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  clinicName: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  practiceAddress: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  consultationType: string | null;

  // ─── Documents (stored as opaque IDs; actual files on disk) ────────────────

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  profilePhotoPath: string | null; // optional

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  registrationCertPath: string | null; // mandatory

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  degreeCertPath: string | null; // mandatory

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  specializationCertPath: string | null; // optional

  // ─── Review Information ─────────────────────────────────────────────────────

  @Column({ type: 'text', nullable: true, default: null })
  rejectionReason: string | null;

  @Column({ type: 'uuid', nullable: true, default: null })
  reviewedByAdminId: string | null; // userId of the admin who reviewed

  @Column({ type: 'timestamp', nullable: true, default: null })
  reviewedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  submittedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
