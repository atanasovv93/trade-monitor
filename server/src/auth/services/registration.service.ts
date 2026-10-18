import {
  Injectable,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from '../schemas/user.schema';
import { RegisterDto } from '../dto/register.dto';
import { EmailService } from '../email.service';

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly emailService: EmailService,
  ) {}

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

      try {
        await this.emailService.sendWelcomeEmail(user.email);
        this.logger.log('Welcome email sent successfully.');
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        this.logger.warn(
          `User registered, but welcome email failed: ${errorMessage}`,
        );
      }

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
}
