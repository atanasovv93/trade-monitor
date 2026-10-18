import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';

import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async getUsers(page = 1, limit = 10, search = '') {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const filter: {
      email?: { $regex: string; $options: string };
    } = {};

    if (search.trim()) {
      const escapedSearch = search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      filter.email = {
        $regex: escapedSearch,
        $options: 'i',
      };
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('_id email role isActive createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean()
        .exec(),

      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      data: users.map((user) => ({
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getUserById(userId: string) {
    if (!isValidObjectId(userId)) {
      throw new BadRequestException('Invalid user ID.');
    }

    const user = await this.userModel
      .findById(userId)
      .select('_id email role isActive createdAt updatedAt')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async deleteUser(userId: string, requesterId: string) {
    if (!isValidObjectId(userId)) {
      throw new BadRequestException('Invalid user ID.');
    }

    if (!isValidObjectId(requesterId)) {
      throw new BadRequestException('Invalid requester ID.');
    }

    if (userId === requesterId) {
      throw new BadRequestException(
        'You cannot delete your own account.',
      );
    }

    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role === 'admin') {
      throw new BadRequestException(
        'Admin accounts cannot be deleted through this endpoint.',
      );
    }

    await this.userModel.deleteOne({ _id: user._id }).exec();

    this.logger.log(`User deleted: ${user._id.toString()}`);

    return {
      message: 'User deleted successfully.',
    };
  }
}