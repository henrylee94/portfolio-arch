import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Version,
  Logger,
} from '@nestjs/common';
import { AuthService, LoginResponse } from './auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

export class LoginDto {
  email: string;
  password: string;
}

/**
 * AuthController — handles authentication endpoints.
 *
 * Demonstrates:
 * - JWT-based authentication flow
 * - Passport integration with NestJS
 * - Protected routes via guards
 * - API versioning
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /v1/auth/login
   *
   * Authenticate user and return JWT token.
   * Request body: { email, password }
   * Response: { access_token, token_type, expires_in, user }
   */
  @Version('1')
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    this.logger.log(`Login attempt: ${dto.email}`);
    const user = await this.authService.validateUser(dto.email, dto.password);
    return this.authService.login(user);
  }

  /**
   * GET /v1/auth/profile
   *
   * Returns the authenticated user's profile.
   * Requires: Authorization: Bearer <token>
   */
  @Version('1')
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req: any) {
    return {
      id: req.user.sub,
      email: req.user.email,
      roles: req.user.roles,
    };
  }

  /**
   * GET /v1/auth/validate
   *
   * Simple token validation endpoint.
   * Returns 200 if token is valid, 401 otherwise.
   */
  @Version('1')
  @Get('validate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  validateToken() {
    return { valid: true, message: 'Token is valid' };
  }
}
