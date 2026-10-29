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
import { Payment } from './payment.entity';
import { Appointment } from '../../appointment/entities/appointment.entity';
import { Patient } from '../../patient/entities/patient.entity';
import { RefundStatus } from '../enums/refund-status.enum';

@Entity('refunds')
@Index(['paymentId'])
@Index(['appointmentId'])
@Index(['patientId'])
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => Payment, (payment) => payment.refunds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column({ type: 'uuid' })
  appointmentId: string;

  @ManyToOne(() => Appointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerRefundId: string | null;

  // Minor units: e.g. 50000 paise = 500.00 INR
  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: RefundStatus.PENDING,
  })
  status: RefundStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', nullable: true })
  errorDescription: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

