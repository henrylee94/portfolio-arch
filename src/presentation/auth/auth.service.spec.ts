import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user payload for valid credentials', async () => {
      const result = await service.validateUser('admin', '123456');
      expect(result).toBeDefined();
      expect(result.email).toBe('admin');
      expect(result.sub).toBe('usr_001');
      expect(result.roles).toContain('admin');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      await expect(
        service.validateUser('admin', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      await expect(
        service.validateUser('nonexistent', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should validate email-based user', async () => {
      const result = await service.validateUser('admin@portfolio.dev', 'admin123');
      expect(result.email).toBe('admin@portfolio.dev');
      expect(result.sub).toBe('usr_002');
    });
  });

  describe('login', () => {
    it('should return access_token and user info', async () => {
      const user = await service.validateUser('admin', '123456');
      const result = await service.login(user);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('token_type', 'Bearer');
      expect(result).toHaveProperty('expires_in', '24h');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('admin');
      expect(result.user.roles).toContain('admin');
    });

    it('should call JwtService.sign with user payload', async () => {
      const jwtService = { sign: jest.fn().mockReturnValue('test-token') };
      const module = await Test.createTestingModule({
        providers: [AuthService, { provide: require('@nestjs/jwt').JwtService, useValue: jwtService }],
      }).compile();
      const svc = module.get<AuthService>(AuthService);

      const user = await svc.validateUser('admin', '123456');
      await svc.login(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: user.sub,
        email: user.email,
        roles: user.roles,
      });
    });
  });
});
