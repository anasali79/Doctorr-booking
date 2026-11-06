import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { DoctorVerification } from './entities/doctor-verification.entity';
import { Doctor } from './entities/doctor.entity';
import { VerificationStatus } from '../common/enums/verification-status.enum';
import { SubmitVerificationDto } from './dto/submit-verification.dto';

// Statuses that allow resubmission
const RESUBMITTABLE_STATUSES = [
  VerificationStatus.NOT_SUBMITTED,
  VerificationStatus.REJECTED,
  VerificationStatus.RESUBMISSION_REQUIRED,
];

@Injectable()
export class DoctorVerificationService {
  constructor(
    @InjectRepository(DoctorVerification)
    private readonly verificationRepo: Repository<DoctorVerification>,

    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
  ) {}

  async getVerificationStatus(userId: string) {
    const doctor = await this.findDoctorByUserIdOrFail(userId);

    const verification = await this.verificationRepo.findOne({
      where: { doctorId: doctor.id },
    });

    if (!verification) {
      return {
        message: 'Verification status retrieved successfully',
        data: {
          status: VerificationStatus.NOT_SUBMITTED,
          doctorId: doctor.id,
        },
      };
    }

    return {
      message: 'Verification status retrieved successfully',
      data: {
        status: verification.status,
        doctorId: doctor.id,
        fullName: verification.fullName,
        degree: verification.degree,
        specialization: verification.specialization,
        medicalRegistrationNumber: verification.medicalRegistrationNumber,
        registrationAuthority: verification.registrationAuthority,
        experience: verification.experience,
        clinicName: verification.clinicName,
        practiceAddress: verification.practiceAddress,
        consultationType: verification.consultationType,
        hasProfilePhoto: !!verification.profilePhotoPath,
        hasRegistrationCert: !!verification.registrationCertPath,
        hasDegreeCert: !!verification.degreeCertPath,
        hasSpecializationCert: !!verification.specializationCertPath,
        rejectionReason: verification.rejectionReason,
        submittedAt: verification.submittedAt,
        reviewedAt: verification.reviewedAt,
        createdAt: verification.createdAt,
        updatedAt: verification.updatedAt,
      },
    };
  }

  async submitVerification(
    userId: string,
    dto: SubmitVerificationDto,
    files: {
      profilePhoto?: Express.Multer.File;
      registrationCert?: Express.Multer.File;
      degreeCert?: Express.Multer.File;
      specializationCert?: Express.Multer.File;
    },
  ) {
    const doctor = await this.findDoctorByUserIdOrFail(userId);

    // Check for existing verification
    const existing = await this.verificationRepo.findOne({
      where: { doctorId: doctor.id },
    });

    if (existing && !RESUBMITTABLE_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        `Verification cannot be submitted in status: ${existing.status}. ` +
          'Only NOT_SUBMITTED, REJECTED, or RESUBMISSION_REQUIRED statuses allow (re)submission.',
      );
    }

    // Mandatory documents validation
    // On first submission, both are required
    // On resubmission, only validate if newly uploaded (existing ones are retained)
    const isFirstSubmission =
      !existing || existing.status === VerificationStatus.NOT_SUBMITTED;

    if (isFirstSubmission) {
      if (!files.registrationCert) {
        throw new BadRequestException(
          'Medical registration certificate is required',
        );
      }
      if (!files.degreeCert) {
        throw new BadRequestException(
          'Degree/qualification certificate is required',
        );
      }
    }

    // Build the update object
    const updateData: Partial<DoctorVerification> = {
      doctorId: doctor.id,
      status: VerificationStatus.PENDING,
      fullName: dto.fullName,
      degree: dto.degree,
      specialization: dto.specialization,
      medicalRegistrationNumber: dto.medicalRegistrationNumber,
      registrationAuthority: dto.registrationAuthority,
      experience: dto.experience ?? null,
      clinicName: dto.clinicName ?? null,
      practiceAddress: dto.practiceAddress ?? null,
      consultationType: dto.consultationType ?? null,
      rejectionReason: null,
      submittedAt: new Date(),
    };

    // Set file paths — retain existing if not re-uploaded
    if (files.profilePhoto) {
      // Clean up old file if exists
      if (existing?.profilePhotoPath)
        this.safeDeleteFile(existing.profilePhotoPath);
      updateData.profilePhotoPath = files.profilePhoto.path;
    } else if (existing?.profilePhotoPath) {
      updateData.profilePhotoPath = existing.profilePhotoPath;
    }

    if (files.registrationCert) {
      if (existing?.registrationCertPath)
        this.safeDeleteFile(existing.registrationCertPath);
      updateData.registrationCertPath = files.registrationCert.path;
    } else if (existing?.registrationCertPath) {
      updateData.registrationCertPath = existing.registrationCertPath;
    }

    if (files.degreeCert) {
      if (existing?.degreeCertPath)
        this.safeDeleteFile(existing.degreeCertPath);
      updateData.degreeCertPath = files.degreeCert.path;
    } else if (existing?.degreeCertPath) {
      updateData.degreeCertPath = existing.degreeCertPath;
    }

    if (files.specializationCert) {
      if (existing?.specializationCertPath)
        this.safeDeleteFile(existing.specializationCertPath);
      updateData.specializationCertPath = files.specializationCert.path;
    } else if (existing?.specializationCertPath) {
      updateData.specializationCertPath = existing.specializationCertPath;
    }

    let saved: DoctorVerification;
    if (existing) {
      Object.assign(existing, updateData);
      saved = await this.verificationRepo.save(existing);
    } else {
      saved = await this.verificationRepo.save(
        this.verificationRepo.create(updateData),
      );
    }

    return {
      message:
        'Verification submitted successfully. Admin review is in progress.',
      data: {
        status: saved.status,
        submittedAt: saved.submittedAt,
      },
    };
  }

  private async findDoctorByUserIdOrFail(userId: string): Promise<Doctor> {
    const doctor = await this.doctorRepo.findOne({ where: { userId } });
    if (!doctor) {
      throw new NotFoundException(
        'Doctor profile not found. Please complete your profile before submitting verification.',
      );
    }
    return doctor;
  }

  private safeDeleteFile(filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Non-critical — log and move on
    }
  }
}
