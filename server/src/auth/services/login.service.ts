import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { RefreshTokenService } from './refresh-token.service';
import { User, UserDocument } from '../schemas/user.schema';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginService {
  private readonly logger = new Logger(LoginService.name);
  private readonly accessTokenExpiresIn = '15m';

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.userModel
      .findOne({ email })
      .select('+passwordHash')
      .exec();

    if (
      !user ||
      typeof dto.password !== 'string' ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive.');
    }

    const secret = this.configService
      .get<string>('JWT_SECRET')
      ?.trim();

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
        expiresIn: this.accessTokenExpiresIn,
      },
    );

    // Kreiraj refresh token po uspešen login.
    const refreshToken =
      await this.refreshTokenService.createRefreshToken(
        user._id.toString(),
      );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenExpiresIn,
      refreshToken,
      refreshTokenExpiresIn: '7d',
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  }
  async createAccessToken(userId: string): Promise<string> {
    const user = await this.userModel
      .findById(userId)
      .select('_id email role isActive')
      .exec();

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'User does not exist or account is inactive.',
      );
    }

    const secret = this.configService
      .get<string>('JWT_SECRET')
      ?.trim();

    if (!secret) {
      this.logger.error('JWT_SECRET is not configured.');

      throw new InternalServerErrorException(
        'Authentication is not configured.',
      );
    }

    return this.jwtService.signAsync(
      {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      {
        secret,
        expiresIn: this.accessTokenExpiresIn,
      },
    );
  }
}
