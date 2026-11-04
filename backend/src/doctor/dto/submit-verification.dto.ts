import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

const CONSULTATION_TYPES = ['IN_PERSON', 'ONLINE', 'BOTH'] as const;

export class SubmitVerificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  degree: string; // MBBS, MD, MS, etc.

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  specialization: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  medicalRegistrationNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  registrationAuthority: string; // State Medical Council, etc.

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  @Type(() => Number)
  experience?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  clinicName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  practiceAddress?: string;

  @IsOptional()
  @IsIn(CONSULTATION_TYPES)
  consultationType?: string;
}
