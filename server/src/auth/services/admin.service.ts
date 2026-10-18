import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService
      .get<string>('ADMIN_EMAIL')
      ?.trim()
      .toLowerCase();

    const password =
      this.configService.get<string>('ADMIN_PASSWORD');

    if (!email || !password) {
      this.logger.warn(
        'ADMIN_EMAIL or ADMIN_PASSWORD is not configured. Admin initialization skipped.',
      );
      return;
    }

    if (Buffer.byteLength(password, 'utf8') > 72) {
      this.logger.error(
        'ADMIN_PASSWORD exceeds the 72-byte bcrypt limit.',
      );
      return;
    }

    try {
      const existingUser = await this.userModel
        .findOne({ email })
        .exec();

      if (existingUser) {
        if (existingUser.role !== 'admin') {
          existingUser.role = 'admin';
          await existingUser.save();

          this.logger.log(
            `Existing account promoted to admin: ${email}`,
          );
        } else {
          this.logger.log(
            `Admin account already exists: ${email}`,
          );
        }

        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);

      await this.userModel.create({
        email,
        passwordHash,
        role: 'admin',
        isActive: true,
      });

      this.logger.log(`Default admin account created: ${email}`);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        this.logger.warn(
          'Admin account already exists. Initialization skipped.',
        );
        return;
      }

      this.logger.error(
        'Admin initialization failed.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
