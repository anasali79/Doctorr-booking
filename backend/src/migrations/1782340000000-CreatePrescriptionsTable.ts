import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrescriptionsTable1782340000000 implements MigrationInterface {
  name = 'CreatePrescriptionsTable1782340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prescriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "appointmentId" uuid NOT NULL,
        "doctorId" uuid NOT NULL,
        "patientId" uuid NOT NULL,
        "diagnosis" character varying(255) NOT NULL,
        "symptoms" text,
        "vitals" jsonb,
        "medicines" jsonb NOT NULL DEFAULT '[]',
        "labTests" text,
        "advice" text,
        "followUpDate" character varying(100),
        "notes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_prescription_appointment" UNIQUE ("appointmentId"),
        CONSTRAINT "PK_prescriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_prescription_appointment" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_prescription_doctor" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_prescription_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prescription_doctor" ON "prescriptions" ("doctorId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prescription_patient" ON "prescriptions" ("patientId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescription_patient";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescription_doctor";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prescriptions";`);
  }
}
