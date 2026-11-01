import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationDeliveriesAndPreferences1782320000000
  implements MigrationInterface
{
  name = 'CreateNotificationDeliveriesAndPreferences1782320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add phone column to doctors table
    await queryRunner.query(`
      ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "phone" character varying(20) DEFAULT NULL;
    `);

    // 2. Create notification_preferences table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "emailEnabled" boolean NOT NULL DEFAULT true,
        "inAppEnabled" boolean NOT NULL DEFAULT true,
        "whatsappEnabled" boolean NOT NULL DEFAULT true,
        "smsEnabled" boolean NOT NULL DEFAULT true,
        "remindersEnabled" boolean NOT NULL DEFAULT true,
        "paymentAlertsEnabled" boolean NOT NULL DEFAULT true,
        "refundAlertsEnabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_preferences_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_preferences_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_notification_preferences_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    // 3. Create notification_deliveries table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "notificationId" uuid NULL,
        "eventType" character varying(100) NOT NULL,
        "recipientId" uuid NOT NULL,
        "recipientRole" character varying(50) NOT NULL,
        "channel" character varying(50) NOT NULL,
        "destination" character varying(255) NOT NULL,
        "appointmentId" uuid NULL,
        "paymentId" uuid NULL,
        "refundId" uuid NULL,
        "templateId" character varying(100) NOT NULL,
        "providerMessageId" character varying(255) NULL,
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "errorCode" character varying(100) NULL,
        "errorMessage" text NULL,
        "retryCount" integer NOT NULL DEFAULT 0,
        "maxRetries" integer NOT NULL DEFAULT 3,
        "nextRetryAt" TIMESTAMP NULL,
        "idempotencyKey" character varying(255) NOT NULL,
        "payload" jsonb NULL,
        "sentAt" TIMESTAMP NULL,
        "deliveredAt" TIMESTAMP NULL,
        "failedAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_deliveries_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_deliveries_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "FK_notification_deliveries_notificationId" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_notification_deliveries_appointmentId" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE
      );
    `);

    // 4. Create indices on notification_deliveries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_deliveries_status_nextRetryAt"
      ON "notification_deliveries" ("status", "nextRetryAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_deliveries_recipientId"
      ON "notification_deliveries" ("recipientId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_deliveries_appointmentId"
      ON "notification_deliveries" ("appointmentId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_deliveries_channel"
      ON "notification_deliveries" ("channel");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_deliveries" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences" CASCADE;`);
    await queryRunner.query(`ALTER TABLE "doctors" DROP COLUMN IF EXISTS "phone";`);
  }
}

