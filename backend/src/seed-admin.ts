/**
 * Admin Seed Script — creates the initial admin account from environment variables.
 *
 * Usage: npm run seed:admin
 *
 * Required environment variables:
 *   ADMIN_EMAIL       — email for the admin account
 *   ADMIN_PASSWORD    — plain-text password (will be hashed)
 *   ADMIN_NAME        — display name for the admin
 *
 * This script is idempotent — if the admin already exists, it logs a message and exits.
 * Never hardcodes credentials.
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';

config();

import { User } from './users/entities/user.entity';
import { Doctor } from './doctor/entities/doctor.entity';
import { Patient } from './patient/entities/patient.entity';
import { RecurringAvailability } from './doctor/entities/recurring-availability.entity';
import { CustomAvailability } from './doctor/entities/custom-availability.entity';
import { Appointment } from './appointment/entities/appointment.entity';
import { Notification } from './notification/entities/notification.entity';
import { NotificationPreference } from './notification/entities/notification-preference.entity';
import { NotificationDelivery } from './notification/entities/notification-delivery.entity';
import { DoctorLeave } from './doctor/entities/leave.entity';
import { CheckInRequest } from './check-in/entities/check-in-request.entity';
import { Payment } from './payment/entities/payment.entity';
import { Refund } from './payment/entities/refund.entity';
import { WebhookEvent } from './payment/entities/webhook-event.entity';
import { ReminderJob } from './reminder/entities/reminder-job.entity';
import { Prescription } from './prescription/entities/prescription.entity';
import { DoctorVerification } from './doctor/entities/doctor-verification.entity';
import { AdminAuditLog } from './admin/entities/admin-audit-log.entity';
import { Role } from './common/enums/role.enum';

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'System Admin';

  if (!email || !password) {
    console.error(
      'ERROR: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.',
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('ERROR: ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const dataSourceOptions = process.env.DATABASE_URL
    ? {
        type: 'postgres' as const,
        url: process.env.DATABASE_URL,
        ssl:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
        entities: [
          User,
          Doctor,
          Patient,
          RecurringAvailability,
          CustomAvailability,
          Appointment,
          Notification,
          NotificationPreference,
          NotificationDelivery,
          DoctorLeave,
          CheckInRequest,
          Payment,
          Refund,
          WebhookEvent,
          ReminderJob,
          Prescription,
          DoctorVerification,
          AdminAuditLog,
        ],
        synchronize: false,
      }
    : {
        type: 'postgres' as const,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [
          User,
          Doctor,
          Patient,
          RecurringAvailability,
          CustomAvailability,
          Appointment,
          Notification,
          NotificationPreference,
          NotificationDelivery,
          DoctorLeave,
          CheckInRequest,
          Payment,
          Refund,
          WebhookEvent,
          ReminderJob,
          Prescription,
          DoctorVerification,
          AdminAuditLog,
        ],
        synchronize: false,
      };

  const dataSource = new DataSource(dataSourceOptions);

  try {
    await dataSource.initialize();
    console.log('Database connected.');

    const userRepo = dataSource.getRepository(User);

    // Check if admin already exists
    const existing = await userRepo.findOne({ where: { email } });
    if (existing) {
      if (existing.role === Role.ADMIN) {
        console.log(`Admin account already exists: ${email}`);
      } else {
        console.error(
          `ERROR: A non-admin user with email ${email} already exists.`,
        );
        process.exit(1);
      }
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = userRepo.create({
      name,
      email,
      password: hashedPassword,
      role: Role.ADMIN,
    });

    await userRepo.save(admin);
    console.log(`✅ Admin account created: ${email}`);
  } catch (err) {
    console.error('Failed to seed admin:', err);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

seedAdmin();
