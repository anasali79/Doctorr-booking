import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { DoctorService } from './doctor.service';
import {
  CreateDoctorProfileDto,
  UpdateDoctorProfileDto,
} from './dto/doctor-profile.dto';
import { DoctorDiscoveryQueryDto } from './dto/doctor-discovery-query.dto';
import { AvailabilityService } from './availability.service';
import { GetSlotsQueryDto, NextAvailableQueryDto } from './dto/availability.dto';
import { AppointmentService } from '../appointment/appointment.service';
import { RescheduleAppointmentDto } from '../appointment/dto/reschedule-appointment.dto';

@Controller('doctor')
export class DoctorController {
  constructor(
    private readonly doctorService: DoctorService,
    private readonly availabilityService: AvailabilityService,
    @Inject(forwardRef(() => AppointmentService))
    private readonly appointmentService: AppointmentService,
  ) {}

  @Get()
  findAll(@Query() query: DoctorDiscoveryQueryDto) {
    return this.doctorService.findAll(query);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  createProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateDoctorProfileDto,
  ) {
    return this.doctorService.createProfile(user.id, dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  getProfile(@CurrentUser() user: { id: string }) {
    return this.doctorService.getProfile(user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateDoctorProfileDto,
  ) {
    return this.doctorService.updateProfile(user.id, dto);
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  async getDashboard(
    @CurrentUser() user: { id: string; email: string; role: string },
  ) {
    return this.doctorService.getDashboard(user.id);
  }

  @Get('appointments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  getDoctorAppointments(
    @CurrentUser() user: { id: string },
    @Query('date') date?: string,
  ) {
    return this.appointmentService.getDoctorAppointments(user.id, date);
  }

  @Patch('appointments/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  cancelAppointmentByDoctor(
    @CurrentUser() user: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException('Invalid appointment ID format'),
      }),
    )
    id: string,
  ) {
    return this.appointmentService.cancelAppointmentByDoctor(user.id, id);
  }

  @Patch('appointments/:id/reschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  rescheduleAppointmentByDoctor(
    @CurrentUser() user: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException('Invalid appointment ID format'),
      }),
    )
    id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentService.rescheduleAppointmentByDoctor(user.id, id, dto);
  }

  // ─── Doctor Patients Directory & Clinical History ─────────────────────────────

  @Get('patients')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  getDoctorPatients(
    @CurrentUser() user: { id: string },
    @Query('search') search?: string,
  ) {
    return this.doctorService.getDoctorPatients(user.id, search);
  }

  @Get('patients/:patientId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  getDoctorPatientRecord(
    @CurrentUser() user: { id: string },
    @Param('patientId') patientId: string,
  ) {
    return this.doctorService.getDoctorPatientRecord(user.id, patientId);
  }

  @Patch('appointments/:id/clinical-notes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  saveClinicalNotes(
    @CurrentUser() user: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException('Invalid appointment ID format'),
      }),
    )
    id: string,
    @Body() body: { notes: string; reasonForVisit?: string },
  ) {
    if (!body || typeof body.notes !== 'string') {
      throw new BadRequestException('Clinical notes text is required');
    }
    return this.doctorService.saveAppointmentClinicalNotes(
      user.id,
      id,
      body.notes,
      body.reasonForVisit,
    );
  }

  @Patch('patients/:patientId/medical-record')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  updatePatientMedicalRecord(
    @CurrentUser() user: { id: string },
    @Param('patientId') patientId: string,
    @Body()
    body: {
      allergies?: string;
      medicalHistory?: string;
      currentMedication?: string;
      bloodGroup?: string;
      basicHealthInfo?: string;
    },
  ) {
    return this.doctorService.updatePatientMedicalRecordByDoctor(
      user.id,
      patientId,
      body,
    );
  }

  // ─── Next Available Appointment (Public) ────────────────────────────────────
  // GET /api/doctor/:doctorId/next-available?searchWindow=30
  @Get(':doctorId/next-available')
  async getNextAvailable(
    @Param(
      'doctorId',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException(
            'Invalid doctor ID format. Expected a valid UUID.',
          ),
      }),
    )
    doctorId: string,
    @Query() query: NextAvailableQueryDto,
  ) {
    const result =
      await this.availabilityService.getNextAvailableAppointment(
        doctorId,
        query.searchWindow,
      );
    return {
      message: result.message,
      data: result,
    };
  }

  @Get(':doctorId/slots')
  async getSlots(
    @Param(
      'doctorId',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException(
            'Invalid doctor ID format. Expected a valid UUID.',
          ),
      }),
    )
    doctorId: string,
    @Query() query: GetSlotsQueryDto,
  ) {
    const slots = await this.availabilityService.getAvailableSlots(
      doctorId,
      query.date,
      query.duration,
    );
    if ((slots as any).onLeave) {
      return {
        message: (slots as any).message || `Doctor is on leave on ${query.date}`,
        onLeave: true,
        data: [],
      };
    }
    return {
      message: 'Available slots retrieved successfully',
      data: slots,
    };
  }

  @Get(':id')
  findById(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException(
            'Invalid doctor ID format. Expected a valid UUID.',
          ),
      }),
    )
    id: string,
  ) {
    return this.doctorService.findById(id);
  }
}
