import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  inAppEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  whatsappEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  smsEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  remindersEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  paymentAlertsEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  refundAlertsEnabled?: boolean;

  // Tolerant optional fields so clients that pass metadata never 400
  @IsOptional()
  id?: string;

  @IsOptional()
  userId?: string;

  @IsOptional()
  createdAt?: any;

  @IsOptional()
  updatedAt?: any;
}
