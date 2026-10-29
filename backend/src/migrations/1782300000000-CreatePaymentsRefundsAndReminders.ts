import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentsRefundsAndReminders1782300000000 implements MigrationInterface {
  name = 'CreatePaymentsRefundsAndReminders1782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add payment columns to appointments table
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "paymentStatus" character varying(50) NOT NULL DEFAULT 'UNPAID',
      ADD COLUMN IF NOT EXISTS "pendingExpiresAt" TIMESTAMP NULL DEFAULT NULL
    `);

    // 2. Create payments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "appointmentId" uuid NOT NULL,
        "patientId" uuid NOT NULL,
        "doctorId" uuid NOT NULL,
        "provider" character varying(50) NOT NULL DEFAULT 'RAZORPAY',
        "orderId" character varying(255) NOT NULL,
        "paymentId" character varying(255) NULL,
        "signature" character varying(255) NULL,
        "amount" integer NOT NULL,
        "currency" character varying(10) NOT NULL DEFAULT 'INR',
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "method" character varying(50) NULL,
        "amountRefunded" integer NOT NULL DEFAULT 0,
        "idempotencyKey" character varying(255) NULL,
        "errorCode" character varying(100) NULL,
        "errorDescription" text NULL,
        "metadata" jsonb NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_orderId" UNIQUE ("orderId"),
        CONSTRAINT "UQ_payments_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "FK_payments_appointmentId" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_patientId" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_doctorId" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_appointmentId" ON "payments" ("appointmentId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_patientId" ON "payments" ("patientId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_doctorId" ON "payments" ("doctorId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_paymentId" ON "payments" ("paymentId")`);

    // 3. Create refunds table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refunds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "paymentId" uuid NOT NULL,
        "appointmentId" uuid NOT NULL,
        "patientId" uuid NOT NULL,
        "providerRefundId" character varying(255) NULL,
        "amount" integer NOT NULL,
        "currency" character varying(10) NOT NULL DEFAULT 'INR',
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "reason" text NULL,
        "idempotencyKey" character varying(255) NULL,
        "errorCode" character varying(100) NULL,
        "errorDescription" text NULL,
        "metadata" jsonb NULL,
        "processedAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refunds_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_refunds_providerRefundId" UNIQUE ("providerRefundId"),
        CONSTRAINT "UQ_refunds_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "FK_refunds_paymentId" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_refunds_appointmentId" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_refunds_patientId" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_refunds_paymentId" ON "refunds" ("paymentId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_refunds_appointmentId" ON "refunds" ("appointmentId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_refunds_patientId" ON "refunds" ("patientId")`);

    // 4. Create webhook_events table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" character varying(50) NOT NULL DEFAULT 'RAZORPAY',
        "eventId" character varying(255) NOT NULL,
        "eventType" character varying(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "errorMessage" text NULL,
        "processedAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_webhook_events_eventId" UNIQUE ("eventId")
      )
    `);

    // 5. Create reminder_jobs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reminder_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "appointmentId" uuid NOT NULL,
        "patientId" uuid NOT NULL,
        "doctorId" uuid NOT NULL,
        "type" character varying(50) NOT NULL,
        "targetTime" TIMESTAMP NOT NULL,
        "dedupKey" character varying(255) NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "maxAttempts" integer NOT NULL DEFAULT 3,
        "lastError" text NULL,
        "sentAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reminder_jobs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reminder_jobs_dedupKey" UNIQUE ("dedupKey"),
        CONSTRAINT "FK_reminder_jobs_appointmentId" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_reminder_jobs_status_targetTime" ON "reminder_jobs" ("status", "targetTime")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_reminder_jobs_appointmentId" ON "reminder_jobs" ("appointmentId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reminder_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refunds"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP COLUMN IF EXISTS "pendingExpiresAt",
      DROP COLUMN IF EXISTS "paymentStatus"
    `);
  }
}

