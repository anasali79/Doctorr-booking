import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationAndResetPasswordToUsers1782360000000 implements MigrationInterface {
  name = 'AddEmailVerificationAndResetPasswordToUsers1782360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "isEmailVerified" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "emailVerificationToken" character varying(255),
      ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "resetPasswordToken" character varying(255),
      ADD COLUMN IF NOT EXISTS "resetPasswordExpires" TIMESTAMP;
    `);

    // Existing users in the database (e.g. seeded demo doctors/patients/admin)
    // should remain verified so existing test accounts are not locked out.
    await queryRunner.query(`
      UPDATE "users" SET "isEmailVerified" = true WHERE "isEmailVerified" IS NOT TRUE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "resetPasswordExpires",
      DROP COLUMN IF EXISTS "resetPasswordToken",
      DROP COLUMN IF EXISTS "emailVerificationExpires",
      DROP COLUMN IF EXISTS "emailVerificationToken",
      DROP COLUMN IF EXISTS "isEmailVerified";
    `);
  }
}

