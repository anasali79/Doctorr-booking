import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { DeliveryStatus } from '../enums/delivery-status.enum';
import { NotificationEventType } from '../enums/notification-event-type.enum';
import { Notification } from './notification.entity';
import { Appointment } from '../../appointment/entities/appointment.entity';

@Entity('notification_deliveries')
@Index(['status', 'nextRetryAt'])
@Index(['recipientId'])
@Index(['appointmentId'])
@Index(['channel'])
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  notificationId: string | null;

  @ManyToOne(() => Notification, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'notificationId' })
  notification?: Notification | null;

  @Column({ type: 'varchar', length: 100 })
  eventType: NotificationEventType;

  @Column({ type: 'uuid' })
  recipientId: string;

  @Column({ type: 'varchar', length: 50 })
  recipientRole: string; // 'PATIENT' | 'DOCTOR' | 'ADMIN'

  @Column({ type: 'varchar', length: 50 })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 255 })
  destination: string; // email address, E.164 phone number, or userId

  @Column({ type: 'uuid', nullable: true })
  appointmentId: string | null;

  @ManyToOne(() => Appointment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'appointmentId' })
  appointment?: Appointment | null;

  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  refundId: string | null;

  @Column({ type: 'varchar', length: 100 })
  templateId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerMessageId: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  idempotencyKey: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  failedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

