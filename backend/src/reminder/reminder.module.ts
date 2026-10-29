import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReminderService } from './reminder.service';
import { Appointment } from '../appointment/entities/appointment.entity';
import { ReminderJob } from './entities/reminder-job.entity';
import { NotificationModule } from '../notification/notification.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, ReminderJob]),
    NotificationModule,
    EmailModule,
  ],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class ReminderModule {}
