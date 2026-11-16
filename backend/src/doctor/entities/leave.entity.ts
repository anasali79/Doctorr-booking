import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { LeaveStatus } from '../../common/enums/leave-status.enum';

@Entity('doctor_leaves')
export class DoctorLeave {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  // Format: "YYYY-MM-DD" e.g. "2026-07-10" (Start date of leave)
  @Column({ type: 'date' })
  date: string;

  // Format: "YYYY-MM-DD" (End date of leave, optional / equal to date for 1 day)
  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: LeaveStatus.PENDING,
  })
  status: LeaveStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
