import { IsNotEmpty, IsUUID, IsOptional, IsInt, Min, IsString } from 'class-validator';

export class CreateRefundDto {
  @IsNotEmpty({ message: 'Appointment ID is required' })
  @IsUUID('4', { message: 'Invalid Appointment ID format' })
  appointmentId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid Payment ID format' })
  paymentId?: string;

  @IsOptional()
  @IsInt({ message: 'Refund amount must be an integer (in paise)' })
  @Min(100, { message: 'Minimum refund amount is 100 paise (₹1.00)' })
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

