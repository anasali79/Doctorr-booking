import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppointmentRescheduleRequestsTable1782370000000
  implements MigrationInterface
{
  name = 'CreateAppointmentRescheduleRequestsTable1782370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appointment_reschedule_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "appointmentId" uuid NOT NULL,
        "doctorId" uuid NOT NULL,
        "patientId" uuid NOT NULL,
        "rescheduleMethod" character varying(20) NOT NULL DEFAULT 'SMART',
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "originalDate" date NOT NULL,
        "originalStartTime" character varying(5) NOT NULL,
        "originalEndTime" character varying(5) NOT NULL,
        "proposedDate" date NOT NULL,
        "proposedStartTime" character varying(5) NOT NULL,
        "proposedEndTime" character varying(5) NOT NULL,
        "proposedTokenNumber" integer,
        "proposedSchedulingType" character varying(10) NOT NULL DEFAULT 'STREAM',
        "expiresAt" TIMESTAMP NOT NULL,
        "patientRespondedAt" TIMESTAMP,
        "doctorReason" text,
        "patientNotes" text,
        "refundStatus" character varying(50),
        "refundId" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_appointment_reschedule_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reschedule_requests_appointment" FOREIGN KEY ("appointmentId")
          REFERENCES "appointments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reschedule_requests_doctor" FOREIGN KEY ("doctorId")
          REFERENCES "doctors"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reschedule_requests_patient" FOREIGN KEY ("patientId")
          REFERENCES "patients"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reschedule_requests_doctor_status"
      ON "appointment_reschedule_requests" ("doctorId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reschedule_requests_patient_status"
      ON "appointment_reschedule_requests" ("patientId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reschedule_requests_proposed_slot"
      ON "appointment_reschedule_requests" ("proposedDate", "proposedStartTime", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "appointment_reschedule_requests"`);
  }
}

