/**
 * Standalone mode — Auth + Dashboard demo, no DB/service connections.
 * For portfolio demo when Docker services aren't available.
 */
import { NestFactory } from '@nestjs/core';
import { Logger, Controller, Get, Post, Body, HttpCode, HttpStatus, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './presentation/auth/auth.service';
import { JwtStrategy } from './presentation/auth/jwt.strategy';
import { LoggingInterceptor } from './presentation/interceptors/logging.interceptor';
import { TraceInterceptor } from './shared/trace/trace.interceptor';
import { TraceContext } from './shared/trace/trace.context';

/**
 * Standalone Dashboard Controller — returns hardcoded architecture flow data.
 * In production, this reads from real Pulsar/Temporal/MongoDB.
 */
@ApiTags('Dashboard')
@Controller('dashboard')
class StandaloneDashboardController {
  @Get('flow')
  @ApiOperation({ summary: 'Get architecture flow data', description: 'Returns components, data flows, and recent events for the dashboard visualization.' })
  @ApiResponse({ status: 200, description: 'Architecture flow data with components, flows, and events.' })
  getFlow() {
    return {
      components: [
        { id: 'fe', name: 'React Frontend', type: 'frontend', status: 'active', description: 'React + Vite + Tailwind CSS. JWT auth, React Query, dark theme.' },
        { id: 'be', name: 'NestJS Backend', type: 'backend', status: 'active', description: 'NestJS 11 + TypeScript. DDD layered architecture, Swagger API docs.' },
        { id: 'auth', name: 'JWT Auth', type: 'auth', status: 'active', description: 'Passport.js + JWT strategy. Guards, interceptors, exception filters.' },
        { id: 'pg', name: 'PostgreSQL', type: 'database', status: 'connected', description: 'Primary datastore. TypeORM entities, migrations, order aggregates.' },
        { id: 'mongo', name: 'MongoDB', type: 'database', status: 'connected', description: 'Audit log store. Mongoose schemas, event sourcing trail.' },
        { id: 'redis', name: 'Redis', type: 'cache', status: 'connected', description: 'Cache layer. Session store, query result caching, rate limiting.' },
        { id: 'pulsar', name: 'Apache Pulsar', type: 'event-bus', status: 'active', description: 'Event bus. Persistent topics, ordering keys, dead letter queues.' },
        { id: 'temporal', name: 'Temporal', type: 'workflow', status: 'active', description: 'Workflow orchestration. Retry policies, signals, query handlers.' },
      ],
      flows: [
        { from: 'Client', to: 'NestJS Gateway', label: 'HTTP Request', protocol: 'HTTPS' },
        { from: 'NestJS Gateway', to: 'JWT Auth Guard', label: 'Token Validation', protocol: 'Internal' },
        { from: 'Auth Guard', to: 'Order Controller', label: 'Authenticated Request', protocol: 'Internal' },
        { from: 'Order Controller', to: 'CreateOrderUseCase', label: 'Command', protocol: 'DDD' },
        { from: 'CreateOrderUseCase', to: 'PostgreSQL', label: 'Persist Aggregate', protocol: 'TypeORM' },
        { from: 'CreateOrderUseCase', to: 'Apache Pulsar', label: 'Publish DomainEvent', protocol: 'pulsar-client' },
        { from: 'Apache Pulsar', to: 'Temporal', label: 'Trigger Workflow', protocol: 'Worker' },
        { from: 'Temporal', to: 'Redis', label: 'Cache State', protocol: 'ioredis' },
        { from: 'Apache Pulsar', to: 'MongoDB', label: 'Audit Trail', protocol: 'Mongoose' },
        { from: 'Dashboard Controller', to: 'Redis', label: 'Read Cache', protocol: 'CachePort' },
      ],
      recentEvents: [
        { eventType: 'UserRegistered', aggregateId: 'usr_001', timestamp: new Date().toISOString(), topic: 'persistent://public/default/domain-events', status: 'consumed', traceId: 'trace_demo_001' },
        { eventType: 'UserLoggedIn', aggregateId: 'usr_001', timestamp: new Date().toISOString(), topic: 'persistent://public/default/domain-events', status: 'consumed', traceId: 'trace_demo_002' },
        { eventType: 'OrderCreated', aggregateId: 'ord_001', timestamp: new Date().toISOString(), topic: 'persistent://public/default/domain-events', status: 'published', traceId: 'trace_demo_003' },
        { eventType: 'OrderStatusChanged', aggregateId: 'ord_001', timestamp: new Date().toISOString(), topic: 'persistent://public/default/domain-events', status: 'consumed', traceId: 'trace_demo_003' },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Standalone Auth Controller — login endpoint with body parsing.
 */
@ApiTags('Auth')
@Controller('auth')
class StandaloneAuthController {
  private readonly logger = new Logger('Auth');

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login', description: 'Authenticate with email and password. Returns JWT token.' })
  @ApiBody({ schema: { properties: { email: { type: 'string', example: 'admin' }, password: { type: 'string', example: '123456' } } } })
  @ApiResponse({ status: 200, description: 'JWT access token.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(@Body() body: any) {
    const traceId = TraceContext.getTraceId() || 'no-trace';
    this.logger.log(`[${traceId}] Login attempt: ${body.email}`);
    const user = await this.authService.validateUser(body.email, body.password);
    this.logger.log(`[${traceId}] User authenticated: ${user.email}`);
    return this.authService.login(user);
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      global: true,
      secret: 'portfolio-demo-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [StandaloneAuthController, StandaloneDashboardController],
  providers: [AuthService, JwtStrategy],
})
class StandaloneModule {}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(StandaloneModule);

  // Global interceptors: TraceInterceptor (generates traceId) → LoggingInterceptor (logs with traceId)
  app.useGlobalInterceptors(new TraceInterceptor(), new LoggingInterceptor());

  app.enableCors();
  app.setGlobalPrefix('v1');

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Portfolio Architecture API')
    .setDescription('Solution Architect Portfolio — DDD + Event-Driven Architecture Demo')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'JWT authentication endpoints')
    .addTag('Dashboard', 'Architecture visualization data')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(3000);
  logger.log('Portfolio running on http://localhost:3000 (standalone mode)');
  logger.log('Demo login: admin / 123456');
  logger.log('TraceId propagation: enabled (X-Request-Id header)');
}

bootstrap();
