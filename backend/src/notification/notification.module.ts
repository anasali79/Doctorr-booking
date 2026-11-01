import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationWebhookController } from './notification-webhook.controller';
import { NotificationService } from './notification.service';
import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationScheduler } from './notification.scheduler';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { Patient } from '../patient/entities/patient.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { EmailModule } from '../email/email.module';
import { SocketsModule } from '../sockets/sockets.module';
import { EmailProvider } from './providers/email.provider';
import { InAppProvider } from './providers/in-app.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { SmsProvider } from './providers/sms.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      NotificationDelivery,
      Patient,
      Doctor,
    ]),
    EmailModule,
    forwardRef(() => SocketsModule),
  ],
  controllers: [NotificationController, NotificationWebhookController],
  providers: [
    NotificationService,
    NotificationDispatcher,
    NotificationScheduler,
    EmailProvider,
    InAppProvider,
    WhatsAppProvider,
    SmsProvider,
  ],
  exports: [
    NotificationService,
    NotificationDispatcher,
    NotificationScheduler,
    EmailProvider,
    InAppProvider,
    WhatsAppProvider,
    SmsProvider,
    TypeOrmModule,
  ],
})
export class NotificationModule {}
