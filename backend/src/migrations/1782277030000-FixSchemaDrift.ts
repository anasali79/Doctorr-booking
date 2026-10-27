import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixSchemaDrift1782277030000 implements MigrationInterface {
  name = 'FixSchemaDrift1782277030000';

  public async up(q: QueryRunner): Promise<void> {
    // P0-1: doctors.consultationHours column exists in DB but not in entity
    await q.query(`ALTER TABLE "doctors" DROP COLUMN IF EXISTS "consultationHours"`);

    // P0-2: appointments.tokenNumber is NOT NULL but booking code can set it to null (STREAM mode)
    await q.query(`ALTER TABLE "appointments" ALTER COLUMN "tokenNumber" DROP NOT NULL`);
    await q.query(`ALTER TABLE "appointments" ALTER COLUMN "tokenNumber" DROP DEFAULT`);

    // P0-2b: notifications.note column is in entity but missing from migration
    await q.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "note" text`);
  }

  public async down(): Promise<void> {
    // Intentionally left empty — these fixes are forward-only
  }
}
