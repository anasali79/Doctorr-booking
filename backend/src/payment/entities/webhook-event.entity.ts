import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { WebhookEventStatus } from '../enums/webhook-event-status.enum';

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, default: 'RAZORPAY' })
  provider: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  eventId: string;

  @Column({ type: 'varchar', length: 100 })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({
    type: 'varchar',
    length: 50,
    default: WebhookEventStatus.PENDING,
  })
  status: WebhookEventStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

