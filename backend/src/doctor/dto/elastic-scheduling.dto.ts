import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SchedulingType } from '../../common/enums/scheduling-type.enum';

export enum ShiftType {
  RECURRING = 'RECURRING',
  CUSTOM = 'CUSTOM',
}

export class ExpandScheduleDto {
  @IsEnum(ShiftType)
  @IsNotEmpty()
  shiftType: ShiftType;

  @IsUUID('4')
  @IsNotEmpty()
  shiftId: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'newStartTime must be in HH:MM format',
  })
  newStartTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'newEndTime must be in HH:MM format',
  })
  newEndTime: string;
}

export class CheckShrinkConflictDto {
  @IsEnum(ShiftType)
  @IsNotEmpty()
  shiftType: ShiftType;

  @IsUUID('4')
  @IsNotEmpty()
  shiftId: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'newStartTime must be in HH:MM format',
  })
  newStartTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'newEndTime must be in HH:MM format',
  })
  newEndTime: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  newMaxPatients?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  newSlotDuration?: number;
}

export class ApplyShrinkDto {
  @IsEnum(ShiftType)
  @IsNotEmpty()
  shiftType: ShiftType;

  @IsUUID('4')
  @IsNotEmpty()
  shiftId: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'newStartTime must be in HH:MM format',
  })
  newStartTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'newEndTime must be in HH:MM format',
  })
  newEndTime: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  newMaxPatients?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  newSlotDuration?: number;

  @IsBoolean()
  @IsOptional()
  forceIfNoConflicts?: boolean;
}

export class ShrinkShiftContextDto {
  @IsEnum(ShiftType)
  @IsNotEmpty()
  shiftType: ShiftType;

  @IsUUID('4')
  @IsNotEmpty()
  shiftId: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'newStartTime must be in HH:MM format',
  })
  newStartTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'newEndTime must be in HH:MM format',
  })
  newEndTime: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  newMaxPatients?: number;

  @IsOptional()
  @IsString()
  dateOrDay?: string;
}

export class SmartReschedulePreviewDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  appointmentIds: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ShrinkShiftContextDto)
  shrinkContext?: ShrinkShiftContextDto;
}

export class RescheduleProposalItemDto {
  @IsUUID('4')
  @IsNotEmpty()
  appointmentId: string;

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'proposedDate must be YYYY-MM-DD',
  })
  proposedDate: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'proposedStartTime must be in HH:MM format',
  })
  proposedStartTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'proposedEndTime must be in HH:MM format',
  })
  proposedEndTime: string;

  @IsEnum(SchedulingType)
  @IsOptional()
  proposedSchedulingType?: SchedulingType;

  @IsString()
  @IsOptional()
  doctorReason?: string;
}

export class ApproveSmartRescheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RescheduleProposalItemDto)
  proposals: RescheduleProposalItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ShrinkShiftContextDto)
  shrinkContext?: ShrinkShiftContextDto;
}

export class ManualRescheduleDto {
  @IsUUID('4')
  @IsNotEmpty()
  appointmentId: string;

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'proposedDate must be YYYY-MM-DD',
  })
  proposedDate: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'proposedStartTime must be in HH:MM format',
  })
  proposedStartTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'proposedEndTime must be in HH:MM format',
  })
  proposedEndTime: string;

  @IsString()
  @IsOptional()
  doctorReason?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShrinkShiftContextDto)
  shrinkContext?: ShrinkShiftContextDto;
}

export class PatientRespondRescheduleDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class PatientChooseAlternativeDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'date must be YYYY-MM-DD',
  })
  date: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:MM format',
  })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:MM format',
  })
  endTime: string;

  @IsString()
  @IsOptional()
  patientNotes?: string;
}

export class PatientCancelRescheduleDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

