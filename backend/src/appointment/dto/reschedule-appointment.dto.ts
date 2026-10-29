import {
  IsOptional,
  IsString,
  Matches,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';

// Cross-field: endTime must be after startTime
@ValidatorConstraint({ name: 'isEndAfterStart', async: false })
class IsEndAfterStart implements ValidatorConstraintInterface {
  validate(_: string, args: ValidationArguments) {
    const obj = args.object as RescheduleAppointmentDto;
    const start = obj.startTime || obj.newStartTime;
    const end = obj.endTime || obj.newEndTime;
    if (!start || !end) return true;
    return end > start;
  }
  defaultMessage() {
    return 'endTime must be after startTime';
  }
}

export class RescheduleAppointmentDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'date must be in YYYY-MM-DD format, e.g. "2026-06-20"',
  })
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:MM format (24-hour), e.g. "10:00"',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:MM format (24-hour), e.g. "10:15"',
  })
  @Validate(IsEndAfterStart)
  endTime?: string;

  // Aliases for compatibility
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'newDate must be in YYYY-MM-DD format, e.g. "2026-06-20"',
  })
  newDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'newStartTime must be in HH:MM format (24-hour), e.g. "10:00"',
  })
  newStartTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'newEndTime must be in HH:MM format (24-hour), e.g. "10:15"',
  })
  newEndTime?: string;
}
