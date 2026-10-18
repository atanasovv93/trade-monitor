import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';

import { User, UserDocument } from '../schemas/user.schema';

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET is not configured.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      !isValidObjectId(payload.sub)
    ) {
      throw new UnauthorizedException('Invalid access token.');
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select('_id email role isActive')
      .exec();

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'User does not exist or account is inactive.',
      );
    }

    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };
  }
}
