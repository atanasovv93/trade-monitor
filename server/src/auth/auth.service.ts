
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from './email.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtExpiresIn: string;

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.jwtExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
  }


async onModuleInit(): Promise<void> {
  const adminEmail = this.configService
    .get<string>('ADMIN_EMAIL')
    ?.trim()
    .toLowerCase();

  const adminPassword =
    this.configService.get<string>('ADMIN_PASSWORD');

  if (!adminEmail || !adminPassword) {
    this.logger.warn(
      'Default admin was not initialized: ADMIN_EMAIL or ADMIN_PASSWORD is missing.',
    );
    return;
  }

  if (Buffer.byteLength(adminPassword, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must not exceed 72 bytes.');
  }

  const existingAdmin = await this.userModel
    .findOne({ email: adminEmail })
    .exec();

  if (existingAdmin) {
    if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      await existingAdmin.save();

      this.logger.log(
        `Existing account ${adminEmail} promoted to admin.`,
      );
    } else {
      this.logger.log('Default admin already exists.');
    }

    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  try {
    await this.userModel.create({
      email: adminEmail,
      passwordHash,
      role: 'admin',
      isActive: true,
    });

    this.logger.log('Default admin created successfully.');
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      this.logger.warn(
        'Admin account was created by another process.',
      );
      return;
    }

    throw error;
  }
}


  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.userModel
      .findOne({ email })
      .exec();

    if (existingUser) {
      throw new ConflictException('Email is already registered.');
    }

    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new BadRequestException(
        'Password must not exceed 72 bytes.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.userModel.create({
        email,
        passwordHash,
        role: 'user',
        isActive: true,
      });

      return {
        message: 'Registration successful.',
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        },
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException('Email is already registered.');
      }

      this.logger.error('User registration failed.');

      throw new InternalServerErrorException(
        'Unable to register user.',
      );
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.userModel
      .findOne({ email })
      .select('+passwordHash')
      .exec();

    if (
      !user ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive.');
    }

    const secret = this.configService.get<string>('JWT_SECRET');

    if (!secret) {
      this.logger.error('JWT_SECRET is not configured.');

      throw new InternalServerErrorException(
        'Authentication is not configured.',
      );
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      {
        secret,
        expiresIn: '15m',
      },
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: '15m',
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  }

  async forgotPassword(
    emailInput: string,
  ): Promise<{ message: string }> {
    const message =
      'If an account exists for this email, a password reset link will be sent.';

    const email = emailInput.trim().toLowerCase();

    const user = await this.userModel
      .findOne({ email })
      .exec();

    // Ne otkrivame dali email adresata e registrirana.
    if (!user || !user.isActive) {
      return { message };
    }

    const token = randomBytes(32).toString('hex');

    const tokenHash = createHash('sha256')
      .update(token)
      .digest('hex');

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = new Date(
      Date.now() + 15 * 60 * 1000,
    );

    await user.save();

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:4200';

    const resetUrl =
      `${frontendUrl.replace(/\/$/, '')}` +
      `/reset-password?token=${encodeURIComponent(token)}`;

    await this.emailService.sendPasswordResetEmail(
      user.email,
      resetUrl,
    );

    return { message };
  }

  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    if (Buffer.byteLength(dto.newPassword, 'utf8') > 72) {
      throw new BadRequestException(
        'Password must not exceed 72 bytes.',
      );
    }

    const tokenHash = createHash('sha256')
      .update(dto.token)
      .digest('hex');

    const user = await this.userModel
      .findOne({
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
        isActive: true,
      })
      .select('+passwordResetTokenHash +passwordResetExpiresAt')
      .exec();

    if (!user) {
      throw new UnauthorizedException(
        'Invalid or expired password reset link.',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      12,
    );

    // Tokenot se proveruva povtorno pri atomickoto azuriranje.
    // So toa sprechuvame istiot token da se iskoristi dvapati.
    const result = await this.userModel
      .updateOne(
        {
          _id: user._id,
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: { $gt: new Date() },
          isActive: true,
        },
        {
          $set: { passwordHash },
          $unset: {
            passwordResetTokenHash: 1,
            passwordResetExpiresAt: 1,
          },
        },
      )
      .exec();

    if (result.modifiedCount !== 1) {
      throw new UnauthorizedException(
        'Invalid or expired password reset link.',
      );
    }

    return {
      message: 'Password reset successful. You can now log in.',
    };
  }
}
