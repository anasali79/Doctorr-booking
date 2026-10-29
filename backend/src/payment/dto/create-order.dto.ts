import { IsNotEmpty, IsString, IsUUID, Matches, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsNotEmpty({ message: 'Doctor ID is required' })
  @IsUUID('4', { message: 'Invalid Doctor ID format' })
  doctorId: string;

  @IsNotEmpty({ message: 'Date is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date: string;

  @IsNotEmpty({ message: 'Start time is required' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Start time must be in HH:MM format' })
  startTime: string;

  @IsNotEmpty({ message: 'End time is required' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'End time must be in HH:MM format' })
  endTime: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

