import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Refund } from './entities/refund.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { RazorpayService } from './providers/razorpay.service';
import { EmailModule } from '../email/email.module';
import { NotificationModule } from '../notification/notification.module';
import { SocketsModule } from '../sockets/sockets.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { DoctorModule } from '../doctor/doctor.module';
import { ReminderModule } from '../reminder/reminder.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Refund,
      WebhookEvent,
      Appointment,
      Doctor,
      Patient,
    ]),
    EmailModule,
    NotificationModule,
    SocketsModule,
    forwardRef(() => AppointmentModule),
    forwardRef(() => DoctorModule),
    forwardRef(() => ReminderModule),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, RazorpayService],
  exports: [PaymentService, RazorpayService],
})
export class PaymentModule {}

