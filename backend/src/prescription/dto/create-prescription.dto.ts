import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PrescriptionMedicineDto {
  @IsString()
  @IsNotEmpty({ message: 'Medicine name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Dosage is required (e.g. 1 Tablet)' })
  dosage: string;

  @IsString()
  @IsNotEmpty({ message: 'Frequency is required (e.g. 1-0-1)' })
  frequency: string;

  @IsString()
  @IsNotEmpty({ message: 'Timing is required (e.g. After Food)' })
  timing: string;

  @IsString()
  @IsNotEmpty({ message: 'Duration is required (e.g. 5 Days)' })
  duration: string;

  @IsString()
  @IsOptional()
  instructions?: string;
}

export class PrescriptionVitalsDto {
  @IsString()
  @IsOptional()
  bloodPressure?: string;

  @IsString()
  @IsOptional()
  pulse?: string;

  @IsString()
  @IsOptional()
  temperature?: string;

  @IsString()
  @IsOptional()
  weight?: string;

  @IsString()
  @IsOptional()
  spo2?: string;
}

export class CreatePrescriptionDto {
  @IsUUID('4', { message: 'Invalid appointment ID format' })
  @IsNotEmpty()
  appointmentId: string;

  @IsString()
  @IsNotEmpty({ message: 'Diagnosis is required' })
  diagnosis: string;

  @IsString()
  @IsOptional()
  symptoms?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PrescriptionVitalsDto)
  vitals?: PrescriptionVitalsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  medicines: PrescriptionMedicineDto[];

  @IsString()
  @IsOptional()
  labTests?: string;

  @IsString()
  @IsOptional()
  advice?: string;

  @IsString()
  @IsOptional()
  followUpDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

