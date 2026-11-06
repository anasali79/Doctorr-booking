import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { DoctorVerification } from '../doctor/entities/doctor-verification.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { EmailService } from '../email/email.service';
import { VerificationStatus } from '../common/enums/verification-status.enum';
import { Role } from '../common/enums/role.enum';
import * as bcrypt from 'bcryptjs';

describe('AdminService & Doctor Verification Workflow', () => {
  let service: AdminService;
  let userRepo: any;
  let doctorRepo: any;
  let verificationRepo: any;
  let auditLogRepo: any;
  let emailService: any;
  let jwtService: any;
  let dataSource: any;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
    };
    doctorRepo = {
      count: jest.fn().mockResolvedValue(10),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    verificationRepo = {
      count: jest.fn().mockResolvedValue(2),
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };
    auditLogRepo = {
      save: jest.fn().mockResolvedValue({ id: 'log-1' }),
      create: jest.fn((dto) => dto),
    };
    emailService = {
      sendDoctorVerificationStatusEmail: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-admin-token'),
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          save: jest
            .fn()
            .mockImplementation((_entity, val) => Promise.resolve(val)),
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Doctor), useValue: doctorRepo },
        {
          provide: getRepositoryToken(Patient),
          useValue: { count: jest.fn().mockResolvedValue(50) },
        },
        {
          provide: getRepositoryToken(Appointment),
          useValue: { count: jest.fn().mockResolvedValue(100) },
        },
        {
          provide: getRepositoryToken(DoctorVerification),
          useValue: verificationRepo,
        },
        { provide: getRepositoryToken(AdminAuditLog), useValue: auditLogRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: EmailService, useValue: emailService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('Admin Authentication', () => {
    it('should reject login if user is not ADMIN', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        email: 'doc@careup.app',
        role: Role.DOCTOR,
        password: 'hashed-password',
      });

      await expect(
        service.login('doc@careup.app', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login if password does not match', async () => {
      const hashed = await bcrypt.hash('correctPassword', 10);
      userRepo.findOne.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@careup.app',
        role: Role.ADMIN,
        password: hashed,
      });

      await expect(
        service.login('admin@careup.app', 'wrongPassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should login successfully and return token + user payload', async () => {
      const hashed = await bcrypt.hash('secretPass123', 10);
      userRepo.findOne.mockResolvedValue({
        id: 'admin-1',
        name: 'System Admin',
        email: 'admin@careup.app',
        role: Role.ADMIN,
        password: hashed,
      });

      const res = await service.login('admin@careup.app', 'secretPass123');
      expect(res.token).toEqual('mock-jwt-admin-token');
      expect(res.user).toEqual({
        id: 'admin-1',
        name: 'System Admin',
        email: 'admin@careup.app',
        role: Role.ADMIN,
      });
      expect(auditLogRepo.save).toHaveBeenCalled();
    });
  });

  describe('Admin Dashboard', () => {
    it('should return real aggregated database statistics', async () => {
      const res = await service.getDashboard();
      expect(res.data).toEqual({
        totalDoctors: 10,
        pendingVerifications: 2,
        approvedDoctors: 2,
        rejectedDoctors: 2,
        suspendedDoctors: 2,
        totalPatients: 50,
        totalAppointments: 100,
      });
    });
  });

  describe('Doctor Approval Workflow', () => {
    it('should approve a pending doctor and update audit logs', async () => {
      doctorRepo.findOne.mockResolvedValue({
        id: 'doc-uuid-1',
        userId: 'user-doc-1',
        fullName: 'Dr. Jane Doe',
        user: { email: 'jane@doc.com' },
      });
      verificationRepo.findOne.mockResolvedValue({
        id: 'ver-uuid-1',
        doctorId: 'doc-uuid-1',
        status: VerificationStatus.PENDING,
      });

      const res = await service.approveDoctor('admin-uuid', 'doc-uuid-1');
      expect(res.data.status).toBe(VerificationStatus.APPROVED);
    });

    it('should fail if doctor is already approved', async () => {
      doctorRepo.findOne.mockResolvedValue({ id: 'doc-1', user: {} });
      verificationRepo.findOne.mockResolvedValue({
        id: 'ver-1',
        doctorId: 'doc-1',
        status: VerificationStatus.APPROVED,
      });

      await expect(service.approveDoctor('admin-1', 'doc-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject a doctor with mandatory reason', async () => {
      doctorRepo.findOne.mockResolvedValue({
        id: 'doc-1',
        userId: 'u-1',
        fullName: 'Dr. John',
        user: { email: 'john@doc.com' },
      });
      verificationRepo.findOne.mockResolvedValue({
        id: 'ver-1',
        doctorId: 'doc-1',
        status: VerificationStatus.PENDING,
      });

      const res = await service.rejectDoctor(
        'admin-1',
        'doc-1',
        'Invalid medical registration certificate',
      );
      expect(res.data.status).toBe(VerificationStatus.REJECTED);
      expect(res.data.reason).toBe('Invalid medical registration certificate');
    });

    it('should throw error when rejecting without reason', async () => {
      await expect(
        service.rejectDoctor('admin-1', 'doc-1', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should suspend an approved doctor with mandatory reason', async () => {
      doctorRepo.findOne.mockResolvedValue({
        id: 'doc-1',
        userId: 'u-1',
        fullName: 'Dr. John',
        user: { email: 'john@doc.com' },
      });
      verificationRepo.findOne.mockResolvedValue({
        id: 'ver-1',
        doctorId: 'doc-1',
        status: VerificationStatus.APPROVED,
      });

      const res = await service.suspendDoctor(
        'admin-1',
        'doc-1',
        'License expired',
      );
      expect(res.data.status).toBe(VerificationStatus.SUSPENDED);
    });
  });
});
