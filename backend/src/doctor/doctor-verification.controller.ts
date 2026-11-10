import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { extname } from 'path';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { DoctorVerificationService } from './doctor-verification.service';
import { SubmitVerificationDto } from './dto/submit-verification.dto';

// Allowed MIME types for document uploads
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function getUploadDir(): string {
  const baseDir =
    process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
  const uploadDir = path.join(baseDir, 'verification-docs');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch {
    // Directory may have been created concurrently
  }
  return uploadDir;
}

@Controller('doctor/verification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR)
export class DoctorVerificationController {
  constructor(
    private readonly verificationService: DoctorVerificationService,
  ) {}

  @Get('status')
  getStatus(@CurrentUser() user: { id: string }) {
    return this.verificationService.getVerificationStatus(user.id);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profilePhoto', maxCount: 1 },
        { name: 'registrationCert', maxCount: 1 },
        { name: 'degreeCert', maxCount: 1 },
        { name: 'specializationCert', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_req, _file, cb) => cb(null, getUploadDir()),
          filename: (_req, file, cb) => {
            const safeBaseName = path.basename(file.originalname);
            const safeExt = extname(safeBaseName).toLowerCase().replace(/[^a-z0-9.]/g, '');
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${uniqueSuffix}${safeExt}`);
          },
        }),
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: (_req, file, cb) => {
          if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(
              new BadRequestException(
                `Invalid file type: ${file.mimetype}. Only PDF, JPG, and PNG are allowed.`,
              ),
              false,
            );
          }
        },
      },
    ),
  )
  submitVerification(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitVerificationDto,
    @UploadedFiles()
    files: {
      profilePhoto?: Express.Multer.File[];
      registrationCert?: Express.Multer.File[];
      degreeCert?: Express.Multer.File[];
      specializationCert?: Express.Multer.File[];
    },
  ) {
    return this.verificationService.submitVerification(user.id, dto, {
      profilePhoto: files.profilePhoto?.[0],
      registrationCert: files.registrationCert?.[0],
      degreeCert: files.degreeCert?.[0],
      specializationCert: files.specializationCert?.[0],
    });
  }
}
