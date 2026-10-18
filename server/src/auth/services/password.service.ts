import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from '../schemas/user.schema';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { EmailService } from '../email.service';

@Injectable()
export class PasswordService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) { }

  async forgotPassword(
    emailInput: string,
  ): Promise<{ message: string }> {
    const message =
      'If an account exists for this email, a password reset link will be sent.';

    const email = emailInput.trim().toLowerCase();

    const user = await this.userModel
      .findOne({ email })
      .exec();

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
            refreshTokenHash: 1,
            refreshTokenExpiresAt: 1,
          },
        }
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
