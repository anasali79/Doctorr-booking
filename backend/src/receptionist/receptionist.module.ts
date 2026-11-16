import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Receptionist } from './entities/receptionist.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { User } from '../users/entities/user.entity';
import { DoctorVerification } from '../doctor/entities/doctor-verification.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { ReceptionistController } from './receptionist.controller';
import { ReceptionistService } from './receptionist.service';
import { AppointmentModule } from '../appointment/appointment.module';
import { CheckInModule } from '../check-in/check-in.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receptionist, Doctor, User, DoctorVerification, Appointment]),
    forwardRef(() => AppointmentModule),
    forwardRef(() => CheckInModule),
  ],
  controllers: [ReceptionistController],
  providers: [ReceptionistService],
  exports: [ReceptionistService, TypeOrmModule],
})
export class ReceptionistModule {}
