import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
  StreamableFile,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Admin Auth ─────────────────────────────────────────────────────────────

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email: string; password: string },
    @Res() res: Response,
  ) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }

    const result = await this.adminService.login(body.email, body.password);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('admin_token', result.token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    return res.status(HttpStatus.OK).json({
      message: 'Admin login successful',
      user: result.user,
      token: result.token,
    });
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res() res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('admin_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });
    return res
      .status(HttpStatus.OK)
      .json({ message: 'Admin logged out successfully' });
  }

  // ─── Admin Dashboard ────────────────────────────────────────────────────────

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getDashboard() {
    return this.adminService.getDashboard();
  }

  // ─── Doctor Management ──────────────────────────────────────────────────────

  @Get('doctors')
  @UseGuards(JwtAuthGuard, AdminGuard)
  listDoctors(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listDoctors({
      page: Math.max(1, parseInt(page) || 1),
      limit: Math.min(100, parseInt(limit) || 20),
      status,
      search,
    });
  }

  @Get('doctors/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getDoctorDetails(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException('Invalid doctor ID format'),
      }),
    )
    id: string,
  ) {
    return this.adminService.getDoctorDetails(id);
  }

  @Patch('doctors/:id/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  approveDoctor(
    @CurrentUser() admin: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException('Invalid doctor ID format'),
      }),
    )
    id: string,
  ) {
    return this.adminService.approveDoctor(admin.id, id);
  }

  @Patch('doctors/:id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  rejectDoctor(
    @CurrentUser() admin: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException('Invalid doctor ID format'),
      }),
    )
    id: string,
    @Body() body: { reason: string },
  ) {
    return this.adminService.rejectDoctor(admin.id, id, body.reason);
  }

  @Patch('doctors/:id/request-resubmission')
  @UseGuards(JwtAuthGuard, AdminGuard)
  requestResubmission(
    @CurrentUser() admin: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException('Invalid doctor ID format'),
      }),
    )
    id: string,
    @Body() body: { reason: string },
  ) {
    return this.adminService.requestResubmission(admin.id, id, body.reason);
  }

  @Patch('doctors/:id/suspend')
  @UseGuards(JwtAuthGuard, AdminGuard)
  suspendDoctor(
    @CurrentUser() admin: { id: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException('Invalid doctor ID format'),
      }),
    )
    id: string,
    @Body() body: { reason: string },
  ) {
    return this.adminService.suspendDoctor(admin.id, id, body.reason);
  }

  // ─── Secure Document Access ─────────────────────────────────────────────────

  @Get('doctors/:doctorId/documents/:field')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getDocument(
    @CurrentUser() admin: { id: string },
    @Param('doctorId') doctorId: string,
    @Param('field') field: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const filePath = await this.adminService.getDocumentPath(
      admin.id,
      doctorId,
      field,
    );

    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('Document file not found on server');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    return new StreamableFile(createReadStream(filePath));
  }
}
