import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class VerifyPaymentDto {
  @IsNotEmpty({ message: 'Order ID is required' })
  @IsString()
  orderId: string;

  @IsNotEmpty({ message: 'Payment ID is required' })
  @IsString()
  paymentId: string;

  @IsNotEmpty({ message: 'Payment signature is required' })
  @IsString()
  signature: string;

  @IsNotEmpty({ message: 'Appointment ID is required' })
  @IsUUID('4', { message: 'Invalid Appointment ID format' })
  appointmentId: string;
}

