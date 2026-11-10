import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
import { AiToolRegistryService } from './services/ai-tool-registry.service';
import { AiSessionService } from './services/ai-session.service';
import { AiPermissionService } from './services/ai-permission.service';
import { GeminiClientService } from './services/gemini-client.service';
import { AppointmentModule } from '../appointment/appointment.module';
import { DoctorModule } from '../doctor/doctor.module';
import { PaymentModule } from '../payment/payment.module';
import { PrescriptionModule } from '../prescription/prescription.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => AppointmentModule),
    forwardRef(() => DoctorModule),
    forwardRef(() => PaymentModule),
    forwardRef(() => PrescriptionModule),
    forwardRef(() => NotificationModule),
  ],
  controllers: [AiController],
  providers: [
    AiService,
    AiOrchestratorService,
    AiToolRegistryService,
    AiSessionService,
    AiPermissionService,
    GeminiClientService,
  ],
  exports: [AiService, AiToolRegistryService, GeminiClientService],
})
export class AiModule {}

