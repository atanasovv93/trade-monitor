import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;
export type UserRole = 'user' | 'admin';

@Schema({
  collection: 'users',
  timestamps: true,
})
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  })
  email!: string;

  @Prop({
    required: true,
    select: false,
  })
  passwordHash!: string;

  @Prop({
    type: String,
    required: true,
    default: 'user',
    enum: ['user', 'admin'],
  })
  role!: UserRole;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive!: boolean;

  @Prop({
    type: String,
    select: false,
  })
  passwordResetTokenHash?: string;

  @Prop({
    type: Date,
    select: false,
  })
  passwordResetExpiresAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;

  
  @Prop({
    type: String,
    select: false,
  })
  refreshTokenHash?: string;

  @Prop({
    type: Date,
    select: false,
  })
  refreshTokenExpiresAt?: Date;

}

export const UserSchema = SchemaFactory.createForClass(User);
