import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorVerification } from '../../doctor/entities/doctor-verification.entity';
import { VerificationStatus } from '../enums/verification-status.enum';
import { Role } from '../enums/role.enum';

/**
 * DoctorVerificationGuard — blocks doctor access to protected functionality
 * unless their verification status is APPROVED.
 *
 * Must be used after JwtAuthGuard + RolesGuard(Role.DOCTOR).
 */
@Injectable()
export class DoctorVerificationGuard implements CanActivate {
  constructor(
    @InjectRepository(DoctorVerification)
    private readonly verificationRepo: Repository<DoctorVerification>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();

    // Only applies to doctors; pass through for other roles
    if (!user || user.role !== Role.DOCTOR) {
      return true;
    }

    // Look up verification via the doctor's userId.
    // We JOIN through doctor -> verification using userId match.
    const verification = await this.verificationRepo
      .createQueryBuilder('v')
      .innerJoin('v.doctor', 'd')
      .where('d.userId = :userId', { userId: user.id })
      .getOne();

    if (!verification || verification.status !== VerificationStatus.APPROVED) {
      throw new ForbiddenException(
        'Access denied: Your account is pending admin verification. ' +
          'Please complete the verification process and wait for approval.',
      );
    }

    return true;
  }
}
