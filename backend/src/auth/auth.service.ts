import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async signup(signupDto: SignupDto, clientOrigin?: string) {
    const { name, email, password, role } = signupDto;

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(email.toLowerCase().trim());
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate cryptographic email verification token (24-hour expiry)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create user (unverified by default)
    const user = await this.usersService.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    // Send Verification Email via EmailService
    this.emailService
      .sendVerificationEmail(user.email, user.name, verificationToken, clientOrigin)
      .catch((err) => console.error('Failed to send verification email:', err));

    // Notice: Do NOT issue JWT token until email is verified!
    return {
      message: 'Registration successful! A verification link has been sent to your email. Please verify your account before logging in.',
      requiresVerification: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.usersService.findByEmail(email.toLowerCase().trim());
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Block unverified users from logging in
    if (!user.isEmailVerified) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Your email address is not verified. Please check your inbox for the verification link.',
        email: user.email,
      });
    }

    // Generate token
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const user = await this.usersService.findByEmailVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification link.');
    }

    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Verification link has expired. Please request a new one.');
    }

    // Mark as verified and remove one-time token
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await this.usersService.save(user);

    // Send welcome email now that account is confirmed
    this.emailService
      .sendWelcomeEmail(user.email, user.name, user.role)
      .catch((err) => console.error('Failed to send welcome email:', err));

    return {
      message: 'Email verified successfully! You can now log in to your account.',
      email: user.email,
    };
  }

  async resendVerification(dto: ResendVerificationDto, clientOrigin?: string) {
    const { email } = dto;
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.usersService.findByEmail(email.toLowerCase().trim());
    if (!user) {
      return {
        message: 'If an account exists with this email, a verification link has been sent.',
      };
    }

    if (user.isEmailVerified) {
      return {
        message: 'This email is already verified. You can log in.',
        alreadyVerified: true,
      };
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.usersService.save(user);

    this.emailService
      .sendVerificationEmail(user.email, user.name, verificationToken, clientOrigin)
      .catch((err) => console.error('Failed to resend verification email:', err));

    return {
      message: 'A fresh verification email has been sent. Please check your inbox.',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto, clientOrigin?: string) {
    const { email } = dto;
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.usersService.findByEmail(email.toLowerCase().trim());
    if (!user) {
      // Safe generic message to avoid email enumeration
      return {
        message: 'If an account exists with this email, we have sent a password reset link.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
    await this.usersService.save(user);

    this.emailService
      .sendPasswordResetEmail(user.email, user.name, resetToken, clientOrigin)
      .catch((err) => console.error('Failed to send password reset email:', err));

    return {
      message: 'If an account exists with this email, we have sent a password reset link.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, clientOrigin?: string) {
    const { token, newPassword } = dto;
    if (!token || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    const user = await this.usersService.findByResetPasswordToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired password reset link.');
    }

    if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Password reset link has expired. Please request a new one.');
    }

    // Hash and update password
    const saltRounds = 10;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.usersService.save(user);

    this.emailService
      .sendPasswordResetSuccessEmail(user.email, user.name, clientOrigin)
      .catch((err) => console.error('Failed to send password reset success email:', err));

    return {
      message: 'Password reset successfully! You can now log in with your new password.',
    };
  }

  private generateToken(sub: string, email: string, role: string): string {
    return this.jwtService.sign({ sub, email, role });
  }
}
