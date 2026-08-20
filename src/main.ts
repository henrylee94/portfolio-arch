import { NestFactory } from '@nestjs/core';
import { VersioningType, ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './presentation/filters/global-exception.filter';
import 'reflect-metadata';

/**
 * Application Bootstrap
 *
 * Key configurations demonstrated:
 * - API Versioning (URI-based: /v1/..., /v2/...)
 * - Global Validation Pipe (auto-validates DTOs)
 * - Global Exception Filter (standardized error responses)
 * - CORS configuration
 * - Swagger/OpenAPI documentation
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // ── API Versioning ───────────────────────────────────────
  // Demonstrates URI-based versioning: /v1/orders, /v2/orders
  // Also supports: HEADER, MEDIA_TYPE, QUERY
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // ── Global Validation Pipe ───────────────────────────────
  // Auto-validates all incoming DTOs using class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // strip unknown properties
      forbidNonWhitelisted: true, // throw on unknown properties
      transform: true,           // auto-transform payloads to DTO instances
    }),
  );

  // ── Global Exception Filter ──────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── CORS ─────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // ── Listen ───────────────────────────────────────────────
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  logger.log(`Application running on: http://localhost:${port}`);
  logger.log(`API docs: http://localhost:${port}/api-docs`);
}

bootstrap();
