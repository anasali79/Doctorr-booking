import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '../enums/role.enum';

/**
 * AdminGuard — allows only users with Role.ADMIN.
 * Must be used after JwtAuthGuard so req.user is populated.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Access denied: Authentication required');
    }

    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Access denied: Admin privileges required');
    }

    return true;
  }
}
