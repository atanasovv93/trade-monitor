import { Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import { UsersService } from './services/users.service';
import { RegistrationService } from './services/registration.service';
import { LoginService } from './services/login.service';
import { PasswordService } from './services/password.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly registrationService: RegistrationService,
    private readonly loginService: LoginService,
    private readonly passwordService: PasswordService,
  ) {}

  register(dto: RegisterDto) {
    return this.registrationService.register(dto);
  }

  login(dto: LoginDto) {
    return this.loginService.login(dto);
  }

  getUsers(
    page = 1,
    limit = 10,
    search = '',
  ) {
    return this.usersService.getUsers(
      page,
      limit,
      search,
    );
  }

  getUserById(userId: string) {
    return this.usersService.getUserById(userId);
  }

  deleteUser(
    userId: string,
    requesterId: string,
  ) {
    return this.usersService.deleteUser(
      userId,
      requesterId,
    );
  }

  forgotPassword(email: string) {
    return this.passwordService.forgotPassword(email);
  }

  resetPassword(dto: ResetPasswordDto) {
    return this.passwordService.resetPassword(dto);
  }

createAccessToken(userId: string): Promise<string> {
  return this.loginService.createAccessToken(userId);
}

}
