import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { User } from '../users/entities/user.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { DoctorVerification } from '../doctor/entities/doctor-verification.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { VerificationStatus } from '../common/enums/verification-status.enum';
import { Role } from '../common/enums/role.enum';
import { EmailService } from '../email/email.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,

    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,

    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,

    @InjectRepository(DoctorVerification)
    private readonly verificationRepo: Repository<DoctorVerification>,

    @InjectRepository(AdminAuditLog)
    private readonly auditLogRepo: Repository<AdminAuditLog>,

    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Admin Authentication ───────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: object }> {
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user || user.role !== Role.ADMIN) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        adminId: user.id,
        action: 'ADMIN_LOGIN',
        targetType: null,
        targetId: null,
        reason: null,
        metadata: { email },
      }),
    );

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // ─── Admin Dashboard ────────────────────────────────────────────────────────

  async getDashboard() {
    const [
      totalDoctors,
      pendingVerifications,
      approvedDoctors,
      rejectedDoctors,
      suspendedDoctors,
      totalPatients,
      totalAppointments,
    ] = await Promise.all([
      this.doctorRepo.count(),
      this.verificationRepo.count({
        where: { status: VerificationStatus.PENDING },
      }),
      this.verificationRepo.count({
        where: { status: VerificationStatus.APPROVED },
      }),
      this.verificationRepo.count({
        where: { status: VerificationStatus.REJECTED },
      }),
      this.verificationRepo.count({
        where: { status: VerificationStatus.SUSPENDED },
      }),
      this.patientRepo.count(),
      this.appointmentRepo.count(),
    ]);

    return {
      message: 'Admin dashboard retrieved successfully',
      data: {
        totalDoctors,
        pendingVerifications,
        approvedDoctors,
        rejectedDoctors,
        suspendedDoctors,
        totalPatients,
        totalAppointments,
      },
    };
  }

  // ─── Doctor Management ──────────────────────────────────────────────────────

  async listDoctors(params: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }) {
    const { page, limit, status, search } = params;

    const qb = this.doctorRepo
      .createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.user', 'user')
      .leftJoinAndMapOne(
        'doctor.verification',
        DoctorVerification,
        'verification',
        'verification.doctorId = doctor.id',
      )
      .orderBy('doctor.createdAt', 'DESC');

    if (search) {
      qb.andWhere(
        '(doctor.fullName ILIKE :search OR user.email ILIKE :search OR verification.medicalRegistrationNumber ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      if (status === 'NOT_SUBMITTED') {
        // Doctors who have no verification record OR status is NOT_SUBMITTED
        qb.andWhere(
          '(verification.id IS NULL OR verification.status = :status)',
          { status: VerificationStatus.NOT_SUBMITTED },
        );
      } else {
        qb.andWhere('verification.status = :status', { status });
      }
    }

    const total = await qb.getCount();
    const offset = (page - 1) * limit;
    const doctors = await qb.skip(offset).take(limit).getRawAndEntities();

    // Map to response — verification is in raw due to leftJoinAndMapOne limitation
    const verifications = await this.verificationRepo.find({
      where: doctors.entities.map((d) => ({ doctorId: d.id })),
    });
    const verificationMap = new Map(verifications.map((v) => [v.doctorId, v]));

    return {
      message: 'Doctors retrieved successfully',
      data: doctors.entities.map((d) => ({
        id: d.id,
        userId: d.userId,
        fullName: d.fullName,
        specialization: d.specialization,
        email: (d as any).user?.email || null,
        verification: verificationMap.get(d.id)
          ? this.toVerificationSummary(verificationMap.get(d.id)!)
          : { status: VerificationStatus.NOT_SUBMITTED },
        createdAt: d.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDoctorDetails(doctorId: string) {
    const doctor = await this.doctorRepo.findOne({
      where: { id: doctorId },
      relations: { user: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const verification = await this.verificationRepo.findOne({
      where: { doctorId },
    });

    return {
      message: 'Doctor details retrieved successfully',
      data: {
        id: doctor.id,
        userId: doctor.userId,
        fullName: doctor.fullName,
        specialization: doctor.specialization,
        qualification: doctor.qualification,
        experience: doctor.experience,
        consultationFee: Number(doctor.consultationFee),
        email: doctor.user?.email || null,
        createdAt: doctor.createdAt,
        verification: verification
          ? this.toVerificationDetail(verification)
          : null,
      },
    };
  }

  async approveDoctor(adminId: string, doctorId: string) {
    const { doctor, verification } =
      await this.findDoctorAndVerificationOrFail(doctorId);

    if (verification.status === VerificationStatus.APPROVED) {
      throw new ConflictException('Doctor is already approved');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      verification.status = VerificationStatus.APPROVED;
      verification.reviewedByAdminId = adminId;
      verification.reviewedAt = new Date();
      verification.rejectionReason = null;
      await queryRunner.manager.save(DoctorVerification, verification);

      await queryRunner.manager.save(AdminAuditLog, {
        adminId,
        action: 'DOCTOR_APPROVED',
        targetType: 'Doctor',
        targetId: doctor.id,
        reason: null,
        metadata: { doctorUserId: doctor.userId },
      });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Send approval notification email (fire and forget)
    this.sendVerificationStatusEmail(doctor, 'approved').catch(() => {});

    return {
      message: 'Doctor approved successfully',
      data: { doctorId: doctor.id, status: VerificationStatus.APPROVED },
    };
  }

  async rejectDoctor(adminId: string, doctorId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    const { doctor, verification } =
      await this.findDoctorAndVerificationOrFail(doctorId);

    if (verification.status === VerificationStatus.SUSPENDED) {
      throw new BadRequestException(
        'Cannot reject a suspended doctor. Manage suspension separately.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      verification.status = VerificationStatus.REJECTED;
      verification.rejectionReason = reason.trim();
      verification.reviewedByAdminId = adminId;
      verification.reviewedAt = new Date();
      await queryRunner.manager.save(DoctorVerification, verification);

      await queryRunner.manager.save(AdminAuditLog, {
        adminId,
        action: 'DOCTOR_REJECTED',
        targetType: 'Doctor',
        targetId: doctor.id,
        reason: reason.trim(),
        metadata: { doctorUserId: doctor.userId },
      });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    this.sendVerificationStatusEmail(doctor, 'rejected', reason).catch(
      () => {},
    );

    return {
      message: 'Doctor rejected successfully',
      data: {
        doctorId: doctor.id,
        status: VerificationStatus.REJECTED,
        reason,
      },
    };
  }

  async requestResubmission(adminId: string, doctorId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException(
        'Reason for resubmission request is required',
      );
    }

    const { doctor, verification } =
      await this.findDoctorAndVerificationOrFail(doctorId);

    if (
      ![VerificationStatus.PENDING, VerificationStatus.REJECTED].includes(
        verification.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot request resubmission for a doctor with status: ${verification.status}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      verification.status = VerificationStatus.RESUBMISSION_REQUIRED;
      verification.rejectionReason = reason.trim();
      verification.reviewedByAdminId = adminId;
      verification.reviewedAt = new Date();
      await queryRunner.manager.save(DoctorVerification, verification);

      await queryRunner.manager.save(AdminAuditLog, {
        adminId,
        action: 'DOCTOR_RESUBMISSION_REQUESTED',
        targetType: 'Doctor',
        targetId: doctor.id,
        reason: reason.trim(),
        metadata: { doctorUserId: doctor.userId },
      });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    this.sendVerificationStatusEmail(
      doctor,
      'resubmission_required',
      reason,
    ).catch(() => {});

    return {
      message: 'Resubmission requested successfully',
      data: {
        doctorId: doctor.id,
        status: VerificationStatus.RESUBMISSION_REQUIRED,
      },
    };
  }

  async suspendDoctor(adminId: string, doctorId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Suspension reason is required');
    }

    const { doctor, verification } =
      await this.findDoctorAndVerificationOrFail(doctorId);

    if (verification.status === VerificationStatus.SUSPENDED) {
      throw new ConflictException('Doctor is already suspended');
    }

    if (verification.status !== VerificationStatus.APPROVED) {
      throw new BadRequestException('Only approved doctors can be suspended');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      verification.status = VerificationStatus.SUSPENDED;
      verification.rejectionReason = reason.trim();
      verification.reviewedByAdminId = adminId;
      verification.reviewedAt = new Date();
      await queryRunner.manager.save(DoctorVerification, verification);

      await queryRunner.manager.save(AdminAuditLog, {
        adminId,
        action: 'DOCTOR_SUSPENDED',
        targetType: 'Doctor',
        targetId: doctor.id,
        reason: reason.trim(),
        metadata: { doctorUserId: doctor.userId },
      });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    this.sendVerificationStatusEmail(doctor, 'suspended', reason).catch(
      () => {},
    );

    return {
      message: 'Doctor suspended successfully',
      data: {
        doctorId: doctor.id,
        status: VerificationStatus.SUSPENDED,
      },
    };
  }

  // ─── Secure Document Retrieval ──────────────────────────────────────────────

  async getDocumentPath(
    adminId: string,
    doctorId: string,
    field: string,
  ): Promise<string> {
    const allowedFields = [
      'registrationCertPath',
      'degreeCertPath',
      'specializationCertPath',
      'profilePhotoPath',
    ] as const;

    if (!allowedFields.includes(field as any)) {
      throw new BadRequestException('Invalid document type requested');
    }

    const verification = await this.verificationRepo.findOne({
      where: { doctorId },
    });

    if (!verification) {
      throw new NotFoundException(
        'No verification record found for this doctor',
      );
    }

    const path = verification[field as keyof DoctorVerification] as
      | string
      | null;
    if (!path) {
      throw new NotFoundException('Requested document was not uploaded');
    }

    return path;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async findDoctorAndVerificationOrFail(doctorId: string) {
    const doctor = await this.doctorRepo.findOne({
      where: { id: doctorId },
      relations: { user: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const verification = await this.verificationRepo.findOne({
      where: { doctorId },
    });

    if (!verification) {
      throw new NotFoundException(
        'No verification submission found for this doctor. The doctor has not submitted credentials yet.',
      );
    }

    return { doctor, verification };
  }

  private toVerificationSummary(v: DoctorVerification) {
    return {
      status: v.status,
      submittedAt: v.submittedAt,
      reviewedAt: v.reviewedAt,
    };
  }

  private toVerificationDetail(v: DoctorVerification) {
    return {
      id: v.id,
      status: v.status,
      fullName: v.fullName,
      degree: v.degree,
      specialization: v.specialization,
      medicalRegistrationNumber: v.medicalRegistrationNumber,
      registrationAuthority: v.registrationAuthority,
      experience: v.experience,
      clinicName: v.clinicName,
      practiceAddress: v.practiceAddress,
      consultationType: v.consultationType,
      hasProfilePhoto: !!v.profilePhotoPath,
      hasRegistrationCert: !!v.registrationCertPath,
      hasDegreeCert: !!v.degreeCertPath,
      hasSpecializationCert: !!v.specializationCertPath,
      rejectionReason: v.rejectionReason,
      reviewedAt: v.reviewedAt,
      submittedAt: v.submittedAt,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }

  private async sendVerificationStatusEmail(
    doctor: Doctor & { user?: User },
    status: 'approved' | 'rejected' | 'suspended' | 'resubmission_required',
    reason?: string,
  ) {
    try {
      if (!doctor.user?.email) return;
      await this.emailService.sendDoctorVerificationStatusEmail(
        doctor.user.email,
        doctor.fullName,
        status,
        reason,
      );
    } catch {
      // Email failures should never break the main operation
    }
  }
}
