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
}

