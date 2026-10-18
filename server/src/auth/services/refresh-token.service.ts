import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class RefreshTokenService {
  private readonly refreshTokenLifetimeMs =
    7 * 24 * 60 * 60 * 1000;

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }

  private tokensMatch(
    storedHash: string,
    receivedHash: string,
  ): boolean {
    const stored = Buffer.from(storedHash, 'hex');
    const received = Buffer.from(receivedHash, 'hex');

    return (
      stored.length === received.length &&
      timingSafeEqual(stored, received)
    );
  }

  async createRefreshToken(userId: string): Promise<string> {
    const randomSecret = randomBytes(64).toString('hex');
    const refreshToken = `${userId}.${randomSecret}`;

    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshTokenExpiresAt = new Date(
      Date.now() + this.refreshTokenLifetimeMs,
    );

    const result = await this.userModel.updateOne(
      { _id: userId, isActive: true },
      {
        $set: {
          refreshTokenHash,
          refreshTokenExpiresAt,
        },
      },
    ).exec();

    if (result.matchedCount !== 1) {
      throw new UnauthorizedException('Unable to create refresh token.');
    }

    return refreshToken;
  }

  async rotateRefreshToken(
    refreshToken: string,
  ): Promise<{ userId: string; refreshToken: string }> {
    if (typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const separatorIndex = refreshToken.indexOf('.');
    if (separatorIndex < 1) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const userId = refreshToken.slice(0, separatorIndex);

    if (!isValidObjectId(userId)) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.userModel
      .findById(userId)
      .select('+refreshTokenHash +refreshTokenExpiresAt')
      .exec();

    if (
      !user ||
      !user.isActive ||
      !user.refreshTokenHash ||
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const receivedHash = this.hashToken(refreshToken);

    if (!this.tokensMatch(user.refreshTokenHash, receivedHash)) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const newRandomSecret = randomBytes(64).toString('hex');
    const newRefreshToken = `${userId}.${newRandomSecret}`;
    const newHash = this.hashToken(newRefreshToken);
    const newExpiry = new Date(
      Date.now() + this.refreshTokenLifetimeMs,
    );

    // Atomic conditional update: prevents reuse of an already rotated token.
    const result = await this.userModel.updateOne(
      {
        _id: userId,
        isActive: true,
        refreshTokenHash: user.refreshTokenHash,
        refreshTokenExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          refreshTokenHash: newHash,
          refreshTokenExpiresAt: newExpiry,
        },
      },
    ).exec();

    if (result.modifiedCount !== 1) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    return {
      userId,
      refreshToken: newRefreshToken,
    };
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    if (!isValidObjectId(userId)) {
      return;
    }

    await this.userModel.updateOne(
      { _id: userId },
      {
        $unset: {
          refreshTokenHash: 1,
          refreshTokenExpiresAt: 1,
        },
      },
    ).exec();
  }
}
