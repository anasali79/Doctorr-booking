import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';
import { Doctor } from './entities/doctor.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { Appointment } from '../appointment/entities/appointment.entity';
import { AppointmentModule } from '../appointment/appointment.module';
import { User } from '../users/entities/user.entity';
import { Patient } from '../patient/entities/patient.entity';
import { DoctorLeave } from './entities/leave.entity';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { DoctorVerification } from './entities/doctor-verification.entity';
import { DoctorVerificationService } from './doctor-verification.service';
import { DoctorVerificationController } from './doctor-verification.controller';
import { DoctorVerificationGuard } from '../common/guards/doctor-verification.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Doctor,
      RecurringAvailability,
      CustomAvailability,
      Appointment,
      User,
      Patient,
      DoctorLeave,
      DoctorVerification,
    ]),
    forwardRef(() => AppointmentModule),
  ],
  controllers: [
    AvailabilityController,
    LeaveController,
    DoctorController,
    DoctorVerificationController,
  ],
  providers: [
    DoctorService,
    AvailabilityService,
    LeaveService,
    DoctorVerificationService,
    DoctorVerificationGuard,
  ],
  exports: [
    DoctorService,
    AvailabilityService,
    LeaveService,
    DoctorVerificationService,
    DoctorVerificationGuard,
  ],
})
export class DoctorModule {}
