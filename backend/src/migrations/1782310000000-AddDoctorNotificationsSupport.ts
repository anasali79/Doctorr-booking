import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDoctorNotificationsSupport1782310000000 implements MigrationInterface {
  name = 'AddDoctorNotificationsSupport1782310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Make patientId nullable
    await queryRunner.query(`
      ALTER TABLE "notifications" ALTER COLUMN "patientId" DROP NOT NULL
    `);

    // 2. Add doctorId column if not exists
    await queryRunner.query(`
      ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "doctorId" uuid
    `);

    // 3. Add foreign key to doctors table
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_notifications_doctorId'
        ) THEN
          ALTER TABLE "notifications"
            ADD CONSTRAINT "FK_notifications_doctorId"
            FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // 4. Index on doctorId
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_doctorId"
      ON "notifications" ("doctorId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_notifications_doctorId"
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_notifications_doctorId"
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications" DROP COLUMN IF EXISTS "doctorId"
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications" ALTER COLUMN "patientId" SET NOT NULL
    `);
  }
}

