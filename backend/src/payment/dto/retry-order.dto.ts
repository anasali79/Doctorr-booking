import { IsNotEmpty, IsUUID } from 'class-validator';

export class RetryOrderDto {
  @IsNotEmpty({ message: 'Appointment ID is required' })
  @IsUUID('4', { message: 'Invalid Appointment ID format' })
  appointmentId: string;
}

