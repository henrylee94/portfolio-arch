# 🏗️ Portfolio Architecture Demo

> **Solution Architect Showcase** — Production-grade event-driven architecture with DDD, distributed tracing, and full-stack visualization.

**Live Demo:** Login with `admin` / `123456`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Frontend                              │
│                    (Vite + Tailwind CSS + React Query)              │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │LoginPage │  │RegisterPage  │  │DashboardPage│  │ Event Stream │ │
│  └────┬─────┘  └──────┬───────┘  └──────┬─────┘  └──────┬───────┘ │
│       │               │                 │                │         │
│       └───────────────┴─────────────────┴────────────────┘         │
│                              │ HTTP                                 │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                        NestJS Gateway                               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              TraceInterceptor (AsyncLocalStorage)            │  │
│  │           Generates traceId → propagated through all layers  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  ┌──────────────┐  ┌────────┴────────┐  ┌──────────────────────┐  │
│  │LoggingInterp.│→ │ Auth Controller  │→ │ Dashboard Controller │  │
│  │[traceId] logs │  │  JWT + bcrypt    │  │  /v1/dashboard/flow  │  │
│  └──────────────┘  └────────┬────────┘  └──────────┬───────────┘  │
│                              │                      │               │
│  ┌──────────────┐  ┌────────┴────────┐  ┌─────────┴────────────┐  │
│  │ Auth Guard   │  │  AuthService     │  │    DashboardService  │  │
│  │  JWT verify  │  │  validate/login  │  │  architecture flow   │  │
│  └──────────────┘  └────────┬────────┘  └──────────┬───────────┘  │
│                              │                      │               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Infrastructure Layer (Adapters)                 │  │
│  │                                                              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │  │
│  │  │ PostgreSQL │  │  MongoDB   │  │   Redis    │            │  │
│  │  │ (TypeORM)  │  │ (Mongoose) │  │  (ioredis) │            │  │
│  │  └────────────┘  └────────────┘  └────────────┘            │  │
│  │                                                              │  │
│  │  ┌────────────────────┐  ┌────────────────────┐            │  │
│  │  │   Apache Pulsar    │  │     Temporal       │            │  │
│  │  │   (Event Bus)      │  │   (Workflows)      │            │  │
│  │  │   traceId in props │  │   traceId in meta  │            │  │
│  │  └────────────────────┘  └────────────────────┘            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + Vite + Tailwind CSS | SPA with dark theme, JWT auth, React Query |
| **Backend** | NestJS 11 + TypeScript 5.4.5 | DDD layered architecture, IoC container |
| **Auth** | Passport.js + JWT + bcrypt | Token validation, password hashing |
| **Database** | PostgreSQL (TypeORM) | Primary datastore, order aggregates |
| **Audit** | MongoDB (Mongoose) | Event sourcing audit trail |
| **Cache** | Redis (ioredis) | Session store, query caching |
| **Event Bus** | Apache Pulsar | Domain events, persistent topics |
| **Workflow** | Temporal | Saga orchestration, retry policies |
| **Tracing** | AsyncLocalStorage | Distributed traceId across all layers |
| **Deploy** | Docker Compose | Multi-service orchestration |

---

## Project Structure

```
henry-portfolio-nestjs/
├── src/
│   ├── domain/                    # DDD Domain Layer (pure business logic)
│   │   ├── shared/
│   │   │   ├── aggregate-root.ts  # Base aggregate with domain events
│   │   │   ├── value-object.ts    # Base value object with equality
│   │   │   └── domain-event.ts    # Base domain event
│   │   └── order/
│   │       ├── order.aggregate.ts # Order aggregate root
│   │       ├── order-status.ts    # OrderStatus value object
│   │       └── order.events.ts    # OrderCreated, OrderStatusChanged
│   ├── application/               # Application Layer (use cases)
│   │   ├── dto/                   # Data transfer objects
│   │   └── use-cases/             # CreateOrder, GetOrder, UpdateStatus
│   ├── infrastructure/            # Infrastructure Layer (adapters)
│   │   ├── database/
│   │   │   ├── mongodb/           # AuditLog schema, repository
│   │   │   └── postgresql/        # TypeORM entities, migrations
│   │   ├── event-bus/
│   │   │   └── pulsar-event-bus.adapter.ts  # Real Pulsar client
│   │   ├── temporal/
│   │   │   └── temporal.adapter.ts           # Real Temporal client
│   │   └── cache/
│   │       └── redis-cache.adapter.ts        # Redis with ioredis
│   ├── presentation/              # Presentation Layer (HTTP)
│   │   ├── auth/
│   │   │   ├── auth.service.ts    # JWT token generation
│   │   │   ├── jwt.strategy.ts    # Passport JWT strategy
│   │   │   └── jwt-auth.guard.ts  # Route protection
│   │   ├── controllers/
│   │   │   ├── order.controller.ts
│   │   │   └── dashboard.controller.ts
│   │   └── interceptors/
│   │       └── logging.interceptor.ts  # [traceId] log format
│   ├── shared/                    # Shared utilities
│   │   └── trace/
│   │       ├── trace.context.ts   # AsyncLocalStorage propagation
│   │       ├── trace.interceptor.ts  # Generates traceId per request
│   │       └── trace.module.ts    # DI registration
│   ├── app.module.ts              # Root module
│   ├── main.ts                    # Production entry (with DB/services)
│   └── main.standalone.ts         # Demo entry (no DB dependencies)
├── frontend/                      # React SPA
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.tsx      # JWT login form
│       │   ├── RegisterPage.tsx   # User registration
│       │   └── DashboardPage.tsx  # 3 tabs: Flow, Events, Code Guide
│       └── services/
│           └── api.ts             # Axios with JWT interceptor
├── scripts/
│   └── seed.ts                    # Demo data generator with traceId display
├── docker-compose.yml             # PostgreSQL + MongoDB + Redis + Pulsar + Temporal
├── Dockerfile                     # Multi-stage build
├── ROADMAP.md                     # Implementation roadmap
└── README.md                      # This file
```

---

## Distributed Tracing (traceId)

Every request generates a unique `traceId` that propagates through all layers:

```
Request → TraceInterceptor (generates trace_abc123_def456)
  → AsyncLocalStorage (propagates to all nested calls)
  → LoggingInterceptor    → [trace_abc123] POST /v1/auth/login → 200
  → Auth Controller       → [trace_abc123] Login attempt: admin
  → Auth Service          → User authenticated: admin
  → Response Header       → X-Request-Id: trace_abc123_def456
  → Pulsar Event          → properties.traceId = trace_abc123
  → Temporal Workflow     → metadata.traceId = trace_abc123
```

**Log output example:**
```
[Nest] LOG [HTTP] [trace_mswlgtf8_6a2deafe] POST /v1/auth/login → processing...
[Nest] LOG [Auth] [trace_mswlgtf8_6a2deafe] Login attempt: admin
[Nest] LOG [AuthService] User authenticated: admin
[Nest] LOG [HTTP] [trace_mswlgtf8_6a2deafe] POST /v1/auth/login → 200 (41ms)
```

---

## Quick Start

### Standalone Mode (No Docker required)

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Build backend
npx tsc -p tsconfig.standalone.json

# Start backend (port 3000)
node dist-standalone/main.standalone.js

# Start frontend (port 3002)
cd frontend && npx vite --host 0.0.0.0 --port 3001

# Open browser
open http://localhost:3002
# Login: admin / 123456

# Run seed script
npx ts-node scripts/seed.ts
```

### Full Mode (Docker required)

```bash
# Start all services
docker-compose up -d

# Run migrations
npx typeorm migration:run -d src/infrastructure/database/data-source.ts

# Seed data
npx ts-node scripts/seed.ts

# Open browser
open http://localhost:3001
```

---

## Key Design Decisions

1. **DDD Layering** — Domain has zero infrastructure dependencies. Application layer orchestrates use cases. Infrastructure provides adapters.

2. **Event-Driven** — Order creation publishes `OrderCreated` to Pulsar. Temporal picks up the event and starts `OrderProcessingSaga`.

3. **Dual-Write Audit** — Every domain event is persisted to MongoDB audit log AND published to Pulsar. This ensures traceability even if Pulsar is down.

4. **Distributed Tracing** — `AsyncLocalStorage` propagates `traceId` through the entire request lifecycle without manual parameter passing.

5. **Standalone Mode** — Demo mode that skips DB/external service connections. Perfect for portfolio demos and interviews.

---

## DDD Architecture Patterns

### Aggregate Root
```typescript
class Order extends AggregateRoot {
  // Domain events are emitted when state changes
  this.addDomainEvent(new OrderCreated(this.id, this.items, this.userId));
}
```

### Value Object
```typescript
class OrderStatus extends ValueObject<{ status: string }> {
  // Enforces valid state transitions
  static create(status: string): OrderStatus {
    if (!['pending', 'confirmed', 'shipped'].includes(status)) {
      throw new Error(`Invalid order status: ${status}`);
    }
    return new OrderStatus({ status });
  }
}
```

### Repository Pattern
```typescript
// Port (domain layer)
abstract class OrderRepositoryPort {
  abstract save(order: Order): Promise<void>;
  abstract findById(id: string): Promise<Order | null>;
}

// Adapter (infrastructure layer)
class TypeOrmOrderRepository extends OrderRepositoryPort {
  async save(order: Order): Promise<void> {
    await this.repository.save(this.toPersistence(order));
  }
}
```

### Event Bus
```typescript
// Publisher (infrastructure layer)
class PulsarEventBusAdapter implements EventBusPort {
  async publish(event: DomainEvent): Promise<void> {
    const traceId = TraceContext.getTraceId();
    await this.producer.send({
      message: { data: Buffer.from(JSON.stringify(event)) },
      properties: { traceId, eventType: event.eventType },
    });
  }
}
```

---

## Interview Talking Points

1. **"Why DDD?"** — Separates business logic from infrastructure. Domain layer is testable without DB mocking.

2. **"Why Pulsar over Kafka?"** — Multi-tenancy, dead letter queues, message deduplication, and simpler ops for our scale.

3. **"How do you handle failures?"** — Temporal retry policies + Pulsar dead letter queues + dual-write audit trail.

4. **"How do you trace requests?"** — AsyncLocalStorage-based traceId propagation. Every log line includes the traceId for correlation.

5. **"Why standalone mode?"** — Portfolio demos shouldn't require Docker. Standalone mode lets interviewers see the architecture without infrastructure setup.

---

## License

MIT
