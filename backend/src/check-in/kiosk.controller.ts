import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckInService } from './check-in.service';
import { KioskScanDto } from './dto/kiosk-scan.dto';

/**
 * Clinic kiosk terminal and QR scan endpoints.
 * Sensitive administrative/terminal actions (such as direct no-show marking)
 * require a valid terminal authorization key.
 */
@Controller('kiosk')
export class KioskController {
  constructor(
    private readonly checkInService: CheckInService,
    private readonly configService: ConfigService,
  ) {}

  private verifyTerminalAuthorization(kioskKey?: string): void {
    const configuredKey = this.configService.get<string>('KIOSK_SECRET_KEY') || 'careup_kiosk_terminal_2026';
    if (!kioskKey || kioskKey !== configuredKey) {
      throw new UnauthorizedException('Access denied: Unauthorized clinic kiosk terminal');
    }
  }

  @Post('scan')
  scan(@Body() dto: KioskScanDto) {
    return this.checkInService.requestCheckInFromKiosk(dto.appointmentId);
  }

  @Get('appointment/:id')
  getAppointment(@Param('id') id: string) {
    return this.checkInService.getAppointmentForKiosk(id);
  }

  @Post('appointment/:id/check-in')
  checkIn(@Param('id') id: string) {
    return this.checkInService.kioskDirectCheckIn(id);
  }

  @Post('appointment/:id/no-show')
  noShow(
    @Param('id') id: string,
    @Headers('x-kiosk-key') kioskKey?: string,
  ) {
    this.verifyTerminalAuthorization(kioskKey);
    return this.checkInService.kioskDirectNoShow(id);
  }
}
