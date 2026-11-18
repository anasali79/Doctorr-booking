import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DoctorVerificationGuard } from '../common/guards/doctor-verification.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { ReceptionistService } from './receptionist.service';
import { CreateReceptionistDto } from './dto/create-receptionist.dto';
import { RescheduleAppointmentDto } from '../appointment/dto/reschedule-appointment.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceptionistController {
  constructor(private readonly receptionistService: ReceptionistService) {}

  // ═════════════════════════════════════════════════════════════════════════════
  // DOCTOR ENDPOINTS: Onboard & Manage Receptionists
  // ═════════════════════════════════════════════════════════════════════════════

  @Post('doctor/receptionists')
  @UseGuards(DoctorVerificationGuard)
  @Roles(Role.DOCTOR)
  createReceptionist(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateReceptionistDto,
  ) {
    return this.receptionistService.createReceptionist(user.id, dto);
  }

  @Get('doctor/receptionists')
  @UseGuards(DoctorVerificationGuard)
  @Roles(Role.DOCTOR)
  getDoctorReceptionists(@CurrentUser() user: { id: string }) {
    return this.receptionistService.getDoctorReceptionists(user.id);
  }

  @Patch('doctor/receptionists/:id/toggle')
  @UseGuards(DoctorVerificationGuard)
  @Roles(Role.DOCTOR)
  toggleReceptionist(
    @CurrentUser() user: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () => new BadRequestException('Invalid receptionist ID format'),
      }),
    )
    id: string,
  ) {
    return this.receptionistService.toggleReceptionist(user.id, id);
  }

  @Delete('doctor/receptionists/:id')
  @UseGuards(DoctorVerificationGuard)
  @Roles(Role.DOCTOR)
  deleteReceptionist(
    @CurrentUser() user: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () => new BadRequestException('Invalid receptionist ID format'),
      }),
    )
    id: string,
  ) {
    return this.receptionistService.deleteReceptionist(user.id, id);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // RECEPTIONIST PORTAL ENDPOINTS
  // ═════════════════════════════════════════════════════════════════════════════

  @Get('receptionist/me')
  @Roles(Role.RECEPTIONIST)
  getReceptionistMe(@CurrentUser() user: { id: string }) {
    return this.receptionistService.getReceptionistMe(user.id);
  }

  @Get('receptionist/queue')
  @Roles(Role.RECEPTIONIST)
  getDoctorQueueForReceptionist(
    @CurrentUser() user: { id: string },
    @Query('date') date?: string,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.receptionistService.getDoctorQueueForReceptionist(user.id, date, doctorId);
  }

  @Get('receptionist/appointments')
  @Roles(Role.RECEPTIONIST)
  getDoctorAllAppointmentsForReceptionist(
    @CurrentUser() user: { id: string },
    @Query('doctorId') doctorId?: string,
  ) {
    return this.receptionistService.getDoctorAllAppointmentsForReceptionist(user.id, doctorId);
  }

  @Post('receptionist/appointments/:id/action')
  @Roles(Role.RECEPTIONIST)
  handleAppointmentAction(
    @CurrentUser() user: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () => new BadRequestException('Invalid appointment ID format'),
      }),
    )
    id: string,
    @Query('action') action: string,
  ) {
    const validActions = ['manual-check-in', 'start-consultation', 'complete', 'no-show'];
    if (!action || !validActions.includes(action)) {
      throw new BadRequestException('Invalid appointment queue action');
    }
    return this.receptionistService.handleAppointmentAction(user.id, id, action);
  }

  @Patch('receptionist/appointments/:id/cancel')
  @Roles(Role.RECEPTIONIST)
  cancelAppointment(
    @CurrentUser() user: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () => new BadRequestException('Invalid appointment ID format'),
      }),
    )
    id: string,
  ) {
    return this.receptionistService.cancelAppointment(user.id, id);
  }

  @Patch('receptionist/appointments/:id/reschedule')
  @Roles(Role.RECEPTIONIST)
  rescheduleAppointment(
    @CurrentUser() user: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () => new BadRequestException('Invalid appointment ID format'),
      }),
    )
    id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.receptionistService.rescheduleAppointment(user.id, id, dto);
  }

  @Post('receptionist/appointments/walk-in')
  @Roles(Role.RECEPTIONIST)
  createWalkIn(
    @CurrentUser() user: { id: string },
    @Body()
    dto: {
      fullName: string;
      phone: string;
      age?: number;
      gender?: string;
      reason?: string;
      doctorId?: string;
    },
  ) {
    return this.receptionistService.createWalkIn(user.id, dto);
  }
}
