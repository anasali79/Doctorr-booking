import { Controller, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getRoot() {
    return {
      message: 'CareUp Backend API is running',
      status: 'ok',
      apiBase: '/api',
      routes: {
        auth: '/api/auth/signup | /api/auth/login | /api/auth/logout',
        doctor: '/api/doctor | /api/doctor/:id | /api/doctor/profile',
        patient: '/api/patient/profile',
      },
    };
  }

  private getFrontendBaseUrl(): string {
    const configuredFrontend =
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('CLIENT_BASE_URL');
    if (configuredFrontend) {
      return configuredFrontend.trim().replace(/\/+$/, '');
    }

    const clientUrls = (this.configService.get<string>('CLIENT_URL') || '')
      .split(',')
      .map((u) => u.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const vercelUrl = clientUrls.find((u) => u.includes('vercel.app'));
    const localUrl = clientUrls.find((u) => u.includes('3000')) || 'http://localhost:3000';

    if (isProd && vercelUrl) {
      return vercelUrl;
    }
    return localUrl || vercelUrl || 'https://doctorbook-five.vercel.app';
  }

  @Get('reset-password')
  redirectToResetPassword(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.getFrontendBaseUrl();
    const target = `${frontendUrl}/reset-password?token=${encodeURIComponent(token || '')}`;
    return res.redirect(302, target);
  }

  @Get('verify-email')
  redirectToVerifyEmail(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.getFrontendBaseUrl();
    const target = `${frontendUrl}/verify-email?token=${encodeURIComponent(token || '')}`;
    return res.redirect(302, target);
  }
}
