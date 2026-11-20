import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { Patient } from './entities/patient.entity';
import { PatientMedicalHistoryLog } from './entities/patient-medical-history-log.entity';
import { AppointmentModule } from '../appointment/appointment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, PatientMedicalHistoryLog]),
    AppointmentModule,
  ],
  controllers: [PatientController],
  providers: [PatientService],
  exports: [PatientService, TypeOrmModule],
})
export class PatientModule {}
