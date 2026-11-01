import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard)
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  /**
   * Doctor creates or updates a prescription for an appointment
   * POST /api/prescriptions
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  async createPrescription(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePrescriptionDto,
  ) {
    const prescription = await this.prescriptionService.createOrUpdate(
      user.id,
      dto,
    );
    return {
      message: 'Prescription issued successfully',
      data: prescription,
    };
  }

  /**
   * Get prescription for a specific appointment
   * GET /api/prescriptions/appointment/:appointmentId
   */
  @Get('appointment/:appointmentId')
  async getByAppointment(
    @CurrentUser() user: { id: string; role: Role },
    @Param(
      'appointmentId',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () => new Error('Invalid appointment ID format'),
      }),
    )
    appointmentId: string,
  ) {
    const prescription = await this.prescriptionService.getByAppointment(
      appointmentId,
      user.id,
      user.role,
    );
    return {
      message: 'Prescription retrieved successfully',
      data: prescription,
    };
  }

  /**
   * Patient views all their prescriptions
   * GET /api/prescriptions/my-prescriptions
   */
  @Get('my-prescriptions')
  @UseGuards(RolesGuard)
  @Roles(Role.PATIENT)
  async getMyPrescriptions(@CurrentUser() user: { id: string }) {
    const list = await this.prescriptionService.getPatientPrescriptions(user.id);
    return {
      message: 'Prescriptions retrieved successfully',
      data: list,
    };
  }

  /**
   * Doctor views all prescriptions they have issued
   * GET /api/prescriptions/doctor-prescriptions
   */
  @Get('doctor-prescriptions')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR)
  async getDoctorPrescriptions(@CurrentUser() user: { id: string }) {
    const list = await this.prescriptionService.getDoctorPrescriptions(user.id);
    return {
      message: 'Doctor prescriptions retrieved successfully',
      data: list,
    };
  }

  /**
   * Get a prescription by ID
   * GET /api/prescriptions/:id
   */
  @Get(':id')
  async getById(
    @CurrentUser() user: { id: string; role: Role },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () => new Error('Invalid prescription ID format'),
      }),
    )
    id: string,
  ) {
    const prescription = await this.prescriptionService.getPrescriptionById(
      id,
      user.id,
      user.role,
    );
    return {
      message: 'Prescription retrieved successfully',
      data: prescription,
    };
  }
}
