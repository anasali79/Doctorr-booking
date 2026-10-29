import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Appointment } from '../../appointment/entities/appointment.entity';
import { Patient } from '../../patient/entities/patient.entity';
import { Doctor } from '../../doctor/entities/doctor.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { Refund } from './refund.entity';

@Entity('payments')
@Index(['patientId'])
@Index(['doctorId'])
@Index(['appointmentId'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'varchar', length: 50, default: 'RAZORPAY' })
  provider: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  orderId: string;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signature: string | null;

  // Minor units: e.g. 50000 paise = 500.00 INR
  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  method: string | null;

  // Cumulative refunded amount in minor units
  @Column({ type: 'integer', default: 0 })
  amountRefunded: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', nullable: true })
  errorDescription: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @OneToMany(() => Refund, (refund) => refund.payment)
  refunds: Refund[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

