import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class AiChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500, { message: 'Message is too long. Maximum allowed is 500 characters.' })
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  confirmationId?: string;

  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;

  @IsOptional()
  @IsIn(['auto', 'hi', 'en'])
  languagePreference?: 'auto' | 'hi' | 'en' = 'auto';
}

