import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Request,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshTokenService } from './services/refresh-token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { isValidObjectId } from 'mongoose';


@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') refreshToken: string,
  ) {
    if (
      typeof refreshToken !== 'string' ||
      !refreshToken.trim()
    ) {
      throw new UnauthorizedException(
        'Refresh token is required.',
      );
    }

    const separatorIndex = refreshToken.indexOf('.');

    if (separatorIndex < 1) {
      throw new UnauthorizedException(
        'Invalid refresh token.',
      );
    }

    const userId = refreshToken.slice(0, separatorIndex);

    if (!isValidObjectId(userId)) {
      throw new UnauthorizedException(
        'Invalid refresh token.',
      );
    }

    // Prvo kreiraj access token.
    const accessToken =
      await this.authService.createAccessToken(userId);

    // Potoa validiraj i rotiraj go refresh tokenot.
    const result =
      await this.refreshTokenService.rotateRefreshToken(
        refreshToken,
      );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: '15m',
      refreshToken: result.refreshToken,
      refreshTokenExpiresIn: '7d',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: { user: { id: string } },
  ) {
    await this.refreshTokenService.revokeRefreshToken(
      req.user.id,
    );

    return {
      message: 'Logout successful.',
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getUsers(
    @Query('page', new ParseIntPipe({ optional: true }))
    page = 1,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit = 10,
    @Query('search') search = '',
  ) {
    return this.authService.getUsers(
      page,
      limit,
      search,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(
    @Request()
    req: {
      user: {
        id: string;
        email: string;
        role: string;
      };
    },
  ) {
    return req.user;
  }

  @Get('admin-test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminTest() {
    return {
      message: 'Admin access granted',
    };
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deleteUser(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.authService.deleteUser(
      id,
      req.user.id,
    );
  }
}
