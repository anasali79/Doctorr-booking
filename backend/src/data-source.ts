import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { User } from './users/entities/user.entity';
import { Doctor } from './doctor/entities/doctor.entity';
import { Patient } from './patient/entities/patient.entity';
import { RecurringAvailability } from './doctor/entities/recurring-availability.entity';
import { CustomAvailability } from './doctor/entities/custom-availability.entity';
import { Appointment } from './appointment/entities/appointment.entity';
import { Notification } from './notification/entities/notification.entity';
import { DoctorLeave } from './doctor/entities/leave.entity';
import { CheckInRequest } from './check-in/entities/check-in-request.entity';
import { Payment } from './payment/entities/payment.entity';
import { Refund } from './payment/entities/refund.entity';
import { WebhookEvent } from './payment/entities/webhook-event.entity';
import { ReminderJob } from './reminder/entities/reminder-job.entity';

config();

const shared: DataSourceOptions = {
  type: 'postgres',
  entities: [
    User,
    Doctor,
    Patient,
    RecurringAvailability,
    CustomAvailability,
    Appointment,
    Notification,
    DoctorLeave,
    CheckInRequest,
    Payment,
    Refund,
    WebhookEvent,
    ReminderJob,
  ],
  migrations: ['dist/migrations/*.js'],
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
};

export default new DataSource(
  process.env.DATABASE_URL
    ? { ...shared, url: process.env.DATABASE_URL }
    : {
      ...shared,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
);
