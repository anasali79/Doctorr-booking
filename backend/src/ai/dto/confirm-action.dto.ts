import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';

export class ConfirmActionDto {
  @IsString()
  @IsNotEmpty()
  confirmationId: string;

  @IsBoolean()
  confirmed: boolean;
}

