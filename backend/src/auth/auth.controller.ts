import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private extractClientOrigin(req: Request): string | undefined {
    const origin = req.headers['origin'] as string | undefined;
    if (origin && !origin.includes('onrender.com') && !origin.includes(':3001')) {
      return origin.trim().replace(/\/+$/, '');
    }
    const referer = req.headers['referer'] as string | undefined;
    if (referer) {
      try {
        const u = new URL(referer);
        if (!u.hostname.includes('onrender.com') && u.port !== '3001') {
          return `${u.protocol}//${u.host}`.replace(/\/+$/, '');
        }
      } catch {}
    }
    return undefined;
  }

  private getFrontendBaseUrl(req?: Request): string {
    const extracted = req ? this.extractClientOrigin(req) : undefined;
    if (extracted) return extracted;

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

  @Post('signup')
  async signup(
    @Body() signupDto: SignupDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const clientOrigin = this.extractClientOrigin(req);
    const result = await this.authService.signup(signupDto, clientOrigin);

    return res.status(HttpStatus.CREATED).json({
      message: result.message,
      requiresVerification: result.requiresVerification,
      user: result.user,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res() res: Response) {
    const result = await this.authService.login(loginDto);

    const isProd = process.env.NODE_ENV === 'production';
    // Save JWT in HTTP-only cookie
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(HttpStatus.OK).json({
      message: result.message,
      user: result.user,
      token: result.token,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res() res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    // Clear the token cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });
    return res
      .status(HttpStatus.OK)
      .json({ message: 'Logged out successfully' });
  }

  @Get('verify-email')
  async verifyEmailGet(
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const acceptsHtml = req.headers['accept']?.includes('text/html');
    if (acceptsHtml) {
      const frontendUrl = this.getFrontendBaseUrl(req);
      return res.redirect(302, `${frontendUrl}/verify-email?token=${encodeURIComponent(token || '')}`);
    }
    const result = await this.authService.verifyEmail(token);
    return res.status(HttpStatus.OK).json(result);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmailPost(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body() resendDto: ResendVerificationDto,
    @Req() req: Request,
  ) {
    const clientOrigin = this.extractClientOrigin(req);
    return this.authService.resendVerification(resendDto, clientOrigin);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotDto: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    const clientOrigin = this.extractClientOrigin(req);
    return this.authService.forgotPassword(forgotDto, clientOrigin);
  }

  @Get('reset-password')
  async resetPasswordGet(
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = this.getFrontendBaseUrl(req);
    return res.redirect(302, `${frontendUrl}/reset-password?token=${encodeURIComponent(token || '')}`);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetDto: ResetPasswordDto,
    @Req() req: Request,
  ) {
    const clientOrigin = this.extractClientOrigin(req);
    return this.authService.resetPassword(resetDto, clientOrigin);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: any) {
    return { user };
  }
}
