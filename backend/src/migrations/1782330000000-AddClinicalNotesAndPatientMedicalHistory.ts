import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClinicalNotesAndPatientMedicalHistory1782330000000
  implements MigrationInterface
{
  name = 'AddClinicalNotesAndPatientMedicalHistory1782330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "allergies" text;`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "medicalHistory" text;`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "currentMedication" text;`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "bloodGroup" character varying(10);`,
    );

    await queryRunner.query(
      `ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "clinicalNotes" text;`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reasonForVisit" text;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP COLUMN IF EXISTS "reasonForVisit";`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP COLUMN IF EXISTS "clinicalNotes";`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP COLUMN IF EXISTS "bloodGroup";`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP COLUMN IF EXISTS "currentMedication";`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP COLUMN IF EXISTS "medicalHistory";`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" DROP COLUMN IF EXISTS "allergies";`,
    );
  }
}
