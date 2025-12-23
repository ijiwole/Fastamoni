import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    
    const code = await this.usersService.generateEmailVerificationCode(user.id);
    // Non-blocking: never fail registration because SMTP is flaky
    this.emailService
      .sendVerificationCode(
        user.email,
        `${user.firstName} ${user.lastName}`,
        code,
      )
      .catch((error) => {
        this.logger.error('Failed to send verification email (non-blocking)', error);
      });
    
    return this.buildAuthResponse(user);
  }

  async resendVerificationCode(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    
    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }
    
    const code = await this.usersService.generateEmailVerificationCode(user.id);
    this.emailService
      .sendVerificationCode(user.email, `${user.firstName} ${user.lastName}`, code)
      .catch((error) => {
        this.logger.error('Failed to send verification email (non-blocking)', error);
      });
    
    return { message: 'Verification code sent successfully' };
  }

  async verifyEmail(userId: string, dto: VerifyEmailDto) {
    const verified = await this.usersService.verifyEmailCode(
      userId,
      dto.code,
    );
    
    if (!verified) {
      throw new BadRequestException(
        'Invalid or expired verification code',
      );
    }
    
    return { message: 'Email verified successfully' };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await this.usersService.validatePassword(user, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Block login until email is verified; resend code
    if (!user.isEmailVerified) {
      const code = await this.usersService.generateEmailVerificationCode(user.id);
      this.emailService
        .sendVerificationCode(user.email, `${user.firstName} ${user.lastName}`, code)
        .catch((error) => {
          this.logger.error('Failed to send verification email (non-blocking)', error);
        });
      throw new UnauthorizedException(
        'Email not verified. A new verification code has been sent to your email.',
      );
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);
    const {
      passwordHash,
      transactionPinHash,
      emailVerificationCode,
      emailVerificationCodeExpires,
      ...safeUser
    } = user;
    return { accessToken: token, user: safeUser };
  }
}

