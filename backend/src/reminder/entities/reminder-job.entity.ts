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
import { Appointment } from '../../appointment/entities/appointment.entity';
import { ReminderJobStatus } from '../enums/reminder-job-status.enum';
import { ReminderJobType } from '../enums/reminder-job-type.enum';

@Entity('reminder_jobs')
@Index(['status', 'targetTime'])
@Index(['appointmentId'])
export class ReminderJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  appointmentId: string;

  @ManyToOne(() => Appointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @Column({ type: 'uuid' })
  patientId: string;

  @Column({ type: 'uuid' })
  doctorId: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  type: ReminderJobType;

  @Column({ type: 'timestamp' })
  targetTime: Date;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  dedupKey: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: ReminderJobStatus.PENDING,
  })
  status: ReminderJobStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'int', default: 3 })
  maxAttempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

