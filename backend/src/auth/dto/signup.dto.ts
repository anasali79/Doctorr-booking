import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

// Only DOCTOR and PATIENT are allowed for public self-registration.
// ADMIN accounts are created exclusively via the secure seed script.
const PUBLIC_ROLES = [Role.DOCTOR, Role.PATIENT] as const;
type PublicRole = (typeof PUBLIC_ROLES)[number];

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100, { message: 'name must be at most 100 characters' })
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(PUBLIC_ROLES, { message: 'role must be DOCTOR or PATIENT' })
  role: PublicRole;
}
