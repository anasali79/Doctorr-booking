import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminRoleAndVerificationSystem1782350000000 implements MigrationInterface {
  name = 'AddAdminRoleAndVerificationSystem1782350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add ADMIN to the users role enum
    await queryRunner.query(`
      ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'ADMIN'
    `);

    // 2. Create doctor_verifications table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctorId" uuid NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'NOT_SUBMITTED',
        "fullName" character varying(255),
        "degree" character varying(100),
        "specialization" character varying(255),
        "medicalRegistrationNumber" character varying(100),
        "registrationAuthority" character varying(255),
        "experience" integer,
        "clinicName" character varying(255),
        "practiceAddress" text,
        "consultationType" character varying(50),
        "profilePhotoPath" character varying(500),
        "registrationCertPath" character varying(500),
        "degreeCertPath" character varying(500),
        "specializationCertPath" character varying(500),
        "rejectionReason" text,
        "reviewedByAdminId" uuid,
        "reviewedAt" TIMESTAMP,
        "submittedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_doctor_verifications_doctorId" UNIQUE ("doctorId"),
        CONSTRAINT "PK_doctor_verifications" PRIMARY KEY ("id")
      )
    `);

    // 3. Add FK from doctor_verifications to doctors
    await queryRunner.query(`
      ALTER TABLE "doctor_verifications"
        ADD CONSTRAINT "FK_doctor_verifications_doctor"
        FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE
    `);

    // 4. Create admin_audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "adminId" uuid NOT NULL,
        "action" character varying(100) NOT NULL,
        "targetType" character varying(100),
        "targetId" uuid,
        "reason" text,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // 5. Indexes for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_adminId_createdAt"
        ON "admin_audit_logs" ("adminId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_targetId"
        ON "admin_audit_logs" ("targetId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_doctor_verifications_status"
        ON "doctor_verifications" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_doctor_verifications_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_admin_audit_logs_targetId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_admin_audit_logs_adminId_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_logs"`);
    await queryRunner.query(`
      ALTER TABLE "doctor_verifications"
        DROP CONSTRAINT IF EXISTS "FK_doctor_verifications_doctor"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_verifications"`);
    // Note: PostgreSQL enum values cannot be removed without recreating the type
  }
}
