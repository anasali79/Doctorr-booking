import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type AuditAction =
  | 'DOCTOR_APPROVED'
  | 'DOCTOR_REJECTED'
  | 'DOCTOR_SUSPENDED'
  | 'DOCTOR_RESUBMISSION_REQUESTED'
  | 'ADMIN_LOGIN';

@Entity('admin_audit_logs')
@Index(['adminId', 'createdAt'])
@Index(['targetId'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  adminId: string; // userId of the admin

  @Column({ type: 'varchar', length: 100 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 100, nullable: true })
  targetType: string | null; // e.g. 'Doctor'

  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
