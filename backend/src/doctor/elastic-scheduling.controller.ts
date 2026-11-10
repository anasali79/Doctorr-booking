import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { ElasticSchedulingService } from './elastic-scheduling.service';
import {
  ExpandScheduleDto,
  CheckShrinkConflictDto,
  ApplyShrinkDto,
  SmartReschedulePreviewDto,
  ApproveSmartRescheduleDto,
  ManualRescheduleDto,
  PatientRespondRescheduleDto,
  PatientChooseAlternativeDto,
  PatientCancelRescheduleDto,
} from './dto/elastic-scheduling.dto';

@Controller()
export class ElasticSchedulingController {
  constructor(
    private readonly elasticSchedulingService: ElasticSchedulingService,
  ) {}

  // ─── DOCTOR ELASTIC SCHEDULING ENDPOINTS ─────────────────────────────────────

  @Post('doctor/elastic-schedule/expand')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  @HttpCode(HttpStatus.OK)
  async expandSchedule(
    @CurrentUser() user: { id: string },
    @Body() dto: ExpandScheduleDto,
  ) {
    return this.elasticSchedulingService.expandSchedule(user.id, dto);
  }

  @Post('doctor/elastic-schedule/shrink/check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  @HttpCode(HttpStatus.OK)
  async checkShrinkConflicts(
    @CurrentUser() user: { id: string },
    @Body() dto: CheckShrinkConflictDto,
  ) {
    return this.elasticSchedulingService.checkShrinkConflicts(user.id, dto);
  }

  @Post('doctor/elastic-schedule/shrink/apply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  @HttpCode(HttpStatus.OK)
  async applyShrink(
    @CurrentUser() user: { id: string },
    @Body() dto: ApplyShrinkDto,
  ) {
    return this.elasticSchedulingService.applyShrink(user.id, dto);
  }

  @Post('doctor/elastic-schedule/smart-reschedule/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  @HttpCode(HttpStatus.OK)
  async smartReschedulePreview(
    @CurrentUser() user: { id: string },
    @Body() dto: SmartReschedulePreviewDto,
  ) {
    return this.elasticSchedulingService.smartReschedulePreview(user.id, dto);
  }

  @Post('doctor/elastic-schedule/smart-reschedule/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  @HttpCode(HttpStatus.OK)
  async approveSmartReschedule(
    @CurrentUser() user: { id: string },
    @Body() dto: ApproveSmartRescheduleDto,
  ) {
    return this.elasticSchedulingService.approveSmartReschedule(user.id, dto);
  }

  @Post('doctor/elastic-schedule/manual-reschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  @HttpCode(HttpStatus.OK)
  async manualReschedule(
    @CurrentUser() user: { id: string },
    @Body() dto: ManualRescheduleDto,
  ) {
    return this.elasticSchedulingService.manualReschedule(user.id, dto);
  }

  @Get('doctor/elastic-schedule/requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  async getDoctorRescheduleRequests(@CurrentUser() user: { id: string }) {
    const requests = await this.elasticSchedulingService.getDoctorRescheduleRequests(user.id);
    return {
      message: 'Reschedule requests retrieved successfully',
      data: requests,
    };
  }

  // ─── PATIENT RESCHEDULING ENDPOINTS ──────────────────────────────────────────

  @Get('patient/reschedule-requests/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  async getPatientPendingRescheduleRequests(@CurrentUser() user: { id: string }) {
    const requests = await this.elasticSchedulingService.getPatientPendingRescheduleRequests(user.id);
    return {
      message: 'Pending reschedule requests retrieved successfully',
      data: requests,
    };
  }

  @Get('patient/reschedule-requests/:id/alternatives')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  async getPatientRescheduleAlternatives(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const data = await this.elasticSchedulingService.getPatientRescheduleAlternatives(user.id, id);
    return {
      message: 'Available alternative slots retrieved successfully',
      data,
    };
  }

  @Post('patient/reschedule-requests/:id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @HttpCode(HttpStatus.OK)
  async patientAcceptReschedule(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PatientRespondRescheduleDto,
  ) {
    return this.elasticSchedulingService.patientAcceptReschedule(user.id, id, dto);
  }

  @Post('patient/reschedule-requests/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @HttpCode(HttpStatus.OK)
  async patientRejectReschedule(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PatientRespondRescheduleDto,
  ) {
    return this.elasticSchedulingService.patientRejectReschedule(user.id, id, dto);
  }

  @Post('patient/reschedule-requests/:id/choose-alternative')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @HttpCode(HttpStatus.OK)
  async patientChooseAlternative(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PatientChooseAlternativeDto,
  ) {
    return this.elasticSchedulingService.patientChooseAlternative(user.id, id, dto);
  }

  @Post('patient/reschedule-requests/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  @HttpCode(HttpStatus.OK)
  async patientCancelReschedule(
    @CurrentUser() user: { id: string },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: PatientCancelRescheduleDto,
  ) {
    return this.elasticSchedulingService.patientCancelReschedule(user.id, id, dto);
  }
}

