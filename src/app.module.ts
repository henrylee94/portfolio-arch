import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';

// ── Presentation ──────────────────────────────────────────────────
import { OrderController } from './presentation/controllers/order.controller';
import { DashboardController } from './presentation/controllers/dashboard.controller';
import { AuthModule } from './presentation/auth/auth.module';

// ── Application ───────────────────────────────────────────────────
import { CreateOrderUseCase } from './application/order/commands/create-order.use-case';
import { UpdateOrderStatusUseCase } from './application/order/commands/update-order-status.use-case';
import { GetOrderQuery } from './application/order/queries/get-order.query';

// ── Infrastructure ────────────────────────────────────────────────
import { OrderEntity } from './infrastructure/database/postgres/order.repository';
import { PostgresOrderRepository } from './infrastructure/database/postgres/order.repository';
import { AuditLog, AuditLogSchema, AuditLogRepository } from './infrastructure/database/mongodb/audit-log';
import { RedisCacheAdapter } from './infrastructure/cache/redis-cache.adapter';
import { PulsarEventBusAdapter } from './infrastructure/event-bus/pulsar-event-bus.adapter';
import { TemporalWorkflowAdapter } from './infrastructure/temporal/temporal.adapter';
import { InMemoryRulesEngineAdapter } from './infrastructure/rules-engine/in-memory-rules-engine.adapter';

// ── Ports (for DI binding) ────────────────────────────────────────
import { OrderRepositoryPort } from './domain/order/order.repository.port';
import { CachePort } from './infrastructure/cache/cache.port';
import { EventBusPort } from './infrastructure/event-bus/event-bus.port';
import { WorkflowOrchestratorPort } from './infrastructure/temporal/workflow.port';
import { RulesEnginePort } from './infrastructure/rules-engine/rules-engine.port';

/**
 * AppModule — the composition root.
 *
 * This is where ALL dependency injection bindings live.
 * The domain and application layers have zero knowledge of
 * which concrete implementation is injected — that's the
 * whole point of Ports & Adapters (Hexagonal Architecture).
 *
 * DI flow:
 *   Domain defines: OrderRepositoryPort (abstract class)
 *   Infrastructure provides: PostgresOrderRepository (implementation)
 *   App binds: { provide: OrderRepositoryPort, useClass: PostgresOrderRepository }
 */
@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ── PostgreSQL (TypeORM) ────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.get('POSTGRES_USER', 'portfolio'),
        password: config.get('POSTGRES_PASSWORD', 'portfolio'),
        database: config.get('POSTGRES_DB', 'portfolio'),
        entities: [OrderEntity],
        synchronize: true, // dev only — use migrations in prod
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([OrderEntity]),

    // ── MongoDB (Mongoose) ──────────────────────────────────
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get(
          'MONGODB_URI',
          'mongodb://localhost:27017/portfolio-audit',
        ),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),

    // ── Auth (JWT + Passport) ──────────────────────────────
    AuthModule,
  ],
  controllers: [OrderController, DashboardController],
  providers: [
    // ── Use Cases ───────────────────────────────────────────
    CreateOrderUseCase,
    UpdateOrderStatusUseCase,
    GetOrderQuery,

    // ── Ports → Adapters (the core DI wiring) ──────────────
    {
      provide: OrderRepositoryPort,
      useClass: PostgresOrderRepository,
    },
    {
      provide: CachePort,
      useClass: RedisCacheAdapter,
    },
    {
      provide: EventBusPort,
      useClass: PulsarEventBusAdapter,
    },
    {
      provide: WorkflowOrchestratorPort,
      useClass: TemporalWorkflowAdapter,
    },
    {
      provide: RulesEnginePort,
      useClass: InMemoryRulesEngineAdapter,
    },

    // ── Infrastructure services ─────────────────────────────
    AuditLogRepository,
  ],
})
export class AppModule {}
