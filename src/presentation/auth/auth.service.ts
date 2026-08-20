import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

export interface UserPayload {
  sub: string;
  email: string;
  roles: string[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: string;
  user: {
    id: string;
    email: string;
    roles: string[];
  };
}

/**
 * AuthService — handles authentication logic.
 *
 * In production, user data comes from a database.
 * This implementation uses in-memory users for demo purposes.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // ── Demo Users (replace with DB repository in production) ──
  private readonly users = [
    {
      id: 'usr_001',
      email: 'admin',
      passwordHash: bcrypt.hashSync('123456', 10),
      roles: ['admin', 'user'],
    },
    {
      id: 'usr_002',
      email: 'admin@portfolio.dev',
      passwordHash: bcrypt.hashSync('admin123', 10),
      roles: ['admin', 'user'],
    },
    {
      id: 'usr_003',
      email: 'user@portfolio.dev',
      passwordHash: bcrypt.hashSync('user123', 10),
      roles: ['user'],
    },
  ];

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Validate user credentials.
   * Called by the local strategy during passport authentication.
   */
  async validateUser(email: string, password: string): Promise<UserPayload> {
    const user = this.users.find((u) => u.email === email);

    if (!user) {
      this.logger.warn(`Login attempt for non-existent user: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      this.logger.warn(`Failed login attempt for user: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User authenticated: ${email}`);
    return {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };
  }

  /**
   * Generate JWT access token.
   */
  async login(user: UserPayload): Promise<LoginResponse> {
    const payload = {
      sub: user.sub,
      email: user.email,
      roles: user.roles,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      token_type: 'Bearer',
      expires_in: '24h',
      user: {
        id: user.sub,
        email: user.email,
        roles: user.roles,
      },
    };
  }

  /**
   * Validate JWT payload (called by JwtStrategy on each request).
   */
  async validateTokenPayload(payload: any): Promise<UserPayload> {
    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };
  }
}
