import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReceptionistsTable1782390000000 implements MigrationInterface {
  name = 'CreateReceptionistsTable1782390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add RECEPTIONIST to the users role enum
    await queryRunner.query(`
      ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'RECEPTIONIST'
    `);

    // 2. Create receptionists table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "receptionists" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "doctorId" uuid NOT NULL,
        "fullName" character varying(255) NOT NULL,
        "phone" character varying(20),
        "deskNumber" character varying(50),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_receptionists_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_receptionists" PRIMARY KEY ("id")
      )
    `);

    // 3. Add FK from receptionists to users
    await queryRunner.query(`
      ALTER TABLE "receptionists"
        ADD CONSTRAINT "FK_receptionists_user"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // 4. Add FK from receptionists to doctors
    await queryRunner.query(`
      ALTER TABLE "receptionists"
        ADD CONSTRAINT "FK_receptionists_doctor"
        FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE
    `);

    // 5. Add index for faster doctor lookup
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_receptionists_doctorId" ON "receptionists"("doctorId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_receptionists_doctorId"`);
    await queryRunner.query(`ALTER TABLE "receptionists" DROP CONSTRAINT IF EXISTS "FK_receptionists_doctor"`);
    await queryRunner.query(`ALTER TABLE "receptionists" DROP CONSTRAINT IF EXISTS "FK_receptionists_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "receptionists"`);
  }
}
