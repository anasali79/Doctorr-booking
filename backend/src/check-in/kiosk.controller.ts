import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CheckInService } from './check-in.service';
import { KioskScanDto } from './dto/kiosk-scan.dto';

/**
 * Public kiosk and QR scan endpoints — no login required.
 * Provides appointment verification, direct check-in, and no-show actions.
 */
@Controller('kiosk')
export class KioskController {
  constructor(private readonly checkInService: CheckInService) {}

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
  noShow(@Param('id') id: string) {
    return this.checkInService.kioskDirectNoShow(id);
  }
}
