import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prescription } from './entities/prescription.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { PrescriptionService } from './prescription.service';
import { PrescriptionController } from './prescription.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prescription,
      Appointment,
      Doctor,
      Patient,
    ]),
  ],
  controllers: [PrescriptionController],
  providers: [PrescriptionService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
