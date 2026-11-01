import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  Query,
  Logger,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { DeliveryStatus } from './enums/delivery-status.enum';

@Controller('webhooks')
export class NotificationWebhookController {
  private readonly logger = new Logger(NotificationWebhookController.name);

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Main Vonage Messages & SMS Delivery Status Webhook
   * Endpoint: POST /webhooks/status
   * Configured in Vonage Application "Status URL" and Sandbox Status Webhook
   */
  @Post('status')
  @HttpCode(HttpStatus.OK)
  async handleStatusWebhook(
    @Body() body: any,
    @Query() query: any,
    @Res() res: Response,
  ) {
    await this.processStatusPayload({ ...query, ...body });
    return res.status(HttpStatus.OK).json({ status: 'ok' });
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  handleStatusGet(@Res() res: Response) {
    return res.status(HttpStatus.OK).send('OK');
  }

  /**
   * Main Vonage Inbound Messages Webhook (Replies, Inbound WhatsApp/SMS)
   * Endpoint: POST /webhooks/inbound
   * Configured in Vonage Application "Inbound URL" and Sandbox Inbound Webhook
   */
  @Post('inbound')
  @HttpCode(HttpStatus.OK)
  async handleInboundWebhook(
    @Body() body: any,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const payload = { ...query, ...body };
    const from = payload.from || payload.msisdn;
    const to = payload.to;
    const text = payload.text || payload.body;
    const channel = payload.channel || 'sms';
    const messageUuid = payload.message_uuid || payload.messageId;

    this.logger.log(
      `Inbound message received via ${channel}: from=${from}, to=${to}, uuid=${messageUuid}, text="${text || ''}"`,
    );

    return res.status(HttpStatus.OK).json({ status: 'ok' });
  }

  @Get('inbound')
  @HttpCode(HttpStatus.OK)
  handleInboundGet(@Res() res: Response) {
    return res.status(HttpStatus.OK).send('OK');
  }

  // ─── ALIAS PATHS FOR FLEXIBILITY (/webhooks/vonage/*) ──────────────────────

  @Post('vonage/status')
  @HttpCode(HttpStatus.OK)
  async handleVonageStatusAlias(@Body() body: any, @Query() query: any, @Res() res: Response) {
    await this.processStatusPayload({ ...query, ...body });
    return res.status(HttpStatus.OK).json({ status: 'ok' });
  }

  @Post('vonage/inbound')
  @HttpCode(HttpStatus.OK)
  async handleVonageInboundAlias(@Body() body: any, @Query() query: any, @Res() res: Response) {
    return this.handleInboundWebhook(body, query, res);
  }

  @Post('vonage/sms')
  @HttpCode(HttpStatus.OK)
  async handleVonageSmsAlias(@Body() body: any, @Query() query: any, @Res() res: Response) {
    await this.processStatusPayload({ ...query, ...body });
    return res.status(HttpStatus.OK).json({ status: 'ok' });
  }

  @Post('vonage/whatsapp')
  @HttpCode(HttpStatus.OK)
  async handleVonageWhatsAppAlias(@Body() body: any, @Query() query: any, @Res() res: Response) {
    await this.processStatusPayload({ ...query, ...body });
    return res.status(HttpStatus.OK).json({ status: 'ok' });
  }

  // ─── INTERNAL STATUS PROCESSOR ─────────────────────────────────────────────

  private async processStatusPayload(payload: any): Promise<void> {
    this.logger.debug(`Processing Vonage status payload: ${JSON.stringify(payload)}`);

    // Match either Messages API (message_uuid) or SMS API (messageId / message-id)
    const providerMessageId =
      payload.message_uuid ||
      payload.messageId ||
      payload['message-id'];

    const rawStatus = (payload.status || '').toLowerCase();
    const channel = payload.channel || (payload.message_uuid ? 'whatsapp' : 'sms');
    const errCode = payload['err-code'] || payload.error?.type || payload.error?.title;

    if (!providerMessageId) {
      this.logger.debug('No message ID found in status webhook payload, skipping persistence.');
      return;
    }

    try {
      const delivery = await this.deliveryRepo.findOne({
        where: { providerMessageId: String(providerMessageId) },
      });

      if (!delivery) {
        this.logger.debug(`No delivery record found matching message ID ${providerMessageId}`);
        return;
      }

      if (rawStatus === 'delivered' || rawStatus === 'read') {
        delivery.status = DeliveryStatus.DELIVERED;
        delivery.deliveredAt = delivery.deliveredAt || new Date();
      } else if (rawStatus === 'submitted' || rawStatus === 'accepted' || rawStatus === 'buffered') {
        if (delivery.status !== DeliveryStatus.DELIVERED) {
          delivery.status = DeliveryStatus.SENT;
          delivery.sentAt = delivery.sentAt || new Date();
        }
      } else if (
        rawStatus === 'rejected' ||
        rawStatus === 'undeliverable' ||
        rawStatus === 'failed' ||
        rawStatus === 'expired'
      ) {
        delivery.status = DeliveryStatus.FAILED;
        delivery.errorCode = errCode ? `VONAGE_${errCode}` : `VONAGE_${rawStatus.toUpperCase()}`;
        delivery.errorMessage =
          payload.error?.detail || payload.error?.title || `Vonage delivery reported ${rawStatus}`;
        delivery.failedAt = new Date();
        delivery.nextRetryAt = null;
      }

      await this.deliveryRepo.save(delivery);
      this.logger.log(
        `Updated ${channel.toUpperCase()} delivery ${delivery.id} status to ${delivery.status} via webhook (ID: ${providerMessageId})`,
      );
    } catch (err: any) {
      this.logger.error(`Error updating delivery from Vonage webhook: ${err.message}`, err.stack);
    }
  }
}
