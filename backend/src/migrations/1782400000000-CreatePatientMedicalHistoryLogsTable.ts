import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePatientMedicalHistoryLogsTable1782400000000
  implements MigrationInterface
{
  name = 'CreatePatientMedicalHistoryLogsTable1782400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_medical_history_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "patientId" uuid NOT NULL,
        "changedByUserId" uuid,
        "changedByRole" character varying(50) NOT NULL,
        "changedByName" character varying(255) NOT NULL,
        "fieldName" character varying(100) NOT NULL,
        "fieldLabel" character varying(150),
        "oldValue" text,
        "newValue" text,
        "changeReason" character varying(500),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_patient_medical_history_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_patient_medical_history_logs_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_patient_medical_history_logs_user" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_patient_medical_history_logs_patient_created"
      ON "patient_medical_history_logs" ("patientId", "createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_patient_medical_history_logs_patient_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_medical_history_logs"`);
  }
}
