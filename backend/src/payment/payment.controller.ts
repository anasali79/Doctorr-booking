import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  async createOrder(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateOrderDto,
  ) {
    return this.paymentService.createOrder(user.id, dto);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  async verifyPayment(
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentService.verifyPayment(user.id, dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RequestWithRawBody,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    if (!signature) {
      throw new BadRequestException('Webhook signature missing');
    }
    return this.paymentService.handleWebhook(rawBody, signature);
  }

  @Post('refund')
  @UseGuards(JwtAuthGuard)
  async createRefund(
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: CreateRefundDto,
  ) {
    return this.paymentService.createRefund(user.id, user.role, dto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT)
  async getPaymentHistory(@CurrentUser() user: { id: string }) {
    return this.paymentService.getPatientPaymentHistory(user.id);
  }
}

