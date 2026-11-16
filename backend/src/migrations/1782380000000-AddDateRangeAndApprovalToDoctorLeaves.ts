import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDateRangeAndApprovalToDoctorLeaves1782380000000
  implements MigrationInterface
{
  name = 'AddDateRangeAndApprovalToDoctorLeaves1782380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop existing unique constraint on (doctorId, date) so range and resubmission are flexible
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" DROP CONSTRAINT IF EXISTS "UQ_doctor_leaves_doctor_date";
    `);

    // 2. Add endDate column (nullable, defaults to date if single day)
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" ADD COLUMN IF NOT EXISTS "endDate" date;
    `);

    // 3. Add status column: PENDING | APPROVED | REJECTED
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" ADD COLUMN IF NOT EXISTS "status" character varying(20) NOT NULL DEFAULT 'PENDING';
    `);

    // 4. Add rejectionReason column
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" ADD COLUMN IF NOT EXISTS "rejectionReason" text;
    `);

    // 5. Add approvedAt and approvedBy
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP;
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" ADD COLUMN IF NOT EXISTS "approvedBy" uuid;
    `);

    // 6. Migrate existing rows: mark as APPROVED and set endDate = date
    await queryRunner.query(`
      UPDATE "doctor_leaves"
      SET "endDate" = "date"
      WHERE "endDate" IS NULL;
    `);

    await queryRunner.query(`
      UPDATE "doctor_leaves"
      SET "status" = 'APPROVED'
      WHERE "status" = 'PENDING' AND "createdAt" < NOW() - INTERVAL '1 minute';
    `);

    // 7. Add index for querying status and doctor leaves
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_doctor_leaves_status" ON "doctor_leaves" ("status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_doctor_leaves_doctor_dates" ON "doctor_leaves" ("doctorId", "date", "endDate");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_doctor_leaves_doctor_dates";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_doctor_leaves_status";
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" DROP COLUMN IF EXISTS "approvedBy";
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" DROP COLUMN IF EXISTS "approvedAt";
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" DROP COLUMN IF EXISTS "rejectionReason";
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" DROP COLUMN IF EXISTS "status";
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" DROP COLUMN IF EXISTS "endDate";
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_leaves" ADD CONSTRAINT "UQ_doctor_leaves_doctor_date" UNIQUE ("doctorId", "date");
    `);
  }
}
