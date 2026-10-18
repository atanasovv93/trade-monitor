import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';

import { User, UserSchema } from './schemas/user.schema';

import { UsersService } from './services/users.service';
import { RegistrationService } from './services/registration.service';
import { LoginService } from './services/login.service';
import { PasswordService } from './services/password.service';
import { AdminService } from './services/admin.service';
import { MailjetService } from './services/mailjet.service';
import { EmailTemplateService } from './services/email-template.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
    JwtModule.register({}),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    UsersService,
    RegistrationService,
    LoginService,
    PasswordService,
    AdminService,
    EmailService,
    MailjetService,
    EmailTemplateService,
    RefreshTokenService,
    JwtStrategy,
  ],

  exports: [AuthService],
})
export class AuthModule {}
