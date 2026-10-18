
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

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
        index: true,
    })
    email!: string;

    @Prop({
        required: true,
        select: false,
    })
    passwordHash!: string;

    @Prop({
        default: 'user',
        enum: ['user', 'admin'],
    })
    role!: string;

    @Prop({ default: true })
    isActive!: boolean;

    @Prop({ type: String, select: false })
    passwordResetTokenHash?: string;

    @Prop({ type: Date, select: false })
    passwordResetExpiresAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
