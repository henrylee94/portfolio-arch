# Portfolio Implementation Roadmap

> Last updated: 2026-08-17

## Status Summary

| Layer | Status | Notes |
|-------|--------|-------|
| NestJS Backend | ✅ DDD structure, 32 TS files | Standalone mode working |
| React Frontend | ✅ Login/Register/Dashboard | Vite + Tailwind, dark theme |
| Pulsar | ✅ Real SDK integration | pulsar-client with fallback |
| Temporal | ✅ Real SDK integration | @temporalio/client with fallback |
| Auth (JWT) | ✅ Login/Register | In-memory users, admin/123456 |
| Dashboard API | ✅ GET /v1/dashboard/flow | 8 components, 10 data flows |
| **Standalone mode** | ✅ No Docker needed | main.standalone.ts |
| Docker Compose | ⬜ Not started | |
| Swagger /docs | ⬜ Not started | |

## Current Priority Order

### P1 — Mid Priority (Now)
1. **TraceId end-to-end** — NestJS request → Pulsar event → Temporal workflow, traceId in every log + response header
2. **Event Stream tab** — Real-time Pulsar event display on frontend
3. **Seed data** — register → login → create order → verify full journey
4. **README** — Architecture diagram, tech stack, how to run

### P2 — Low Priority (Next)
5. Temporal workflow visualization — Show workflow execution states
6. Unit tests — TDD demonstration
7. CI/CD — GitHub Actions

### P3 — High Priority (Later, discussion needed)
8. Dashboard UI美化 — Premium dark theme, animations
9. Docker Compose one-click
10. Swagger API docs

## Architecture Vision (Henry's Requirement)

Henry wants a **complete production-grade reference architecture** that demonstrates:

```
DDD Code Pattern
    ↓
Auth/Login (JWT + Passport)
    ↓
Controller → Service → Repository
    ↓
DTO / Interface → DB (PostgreSQL + MongoDB)
    ↓
Event-Bus (Apache Pulsar) → traceId propagation
    ↓
Redis → Cache Management
    ↓
Temporal → Journey Orchestration
    ↓
Deployment → Versioning → API Gateway
```

Key: Every component must be **real, not mock**. The portfolio must show how these pieces connect in a production system, not just individual tech demos.

## TraceId Flow

```
Client Request
  ↓ X-Request-Id header (NestJS LoggingInterceptor)
  ↓
Auth Module (JWT validation)
  ↓ traceId attached to user context
  ↓
Controller → Service → Repository
  ↓ traceId in every log line
  ↓
Pulsar Event Publish
  ↓ traceId as event metadata
  ↓
Temporal Workflow
  ↓ traceId as workflow metadata
  ↓
Response
  ↓ X-Request-Id response header
  ↓
Frontend Event Stream
  ↓ Shows traceId per event
```

## File Locations

- Backend: `~/projects/henry-portfolio-nestjs/`
- Frontend: `~/projects/henry-portfolio-nestjs/frontend/`
- Standalone entry: `src/main.standalone.ts`
- Dashboard API: `src/presentation/controllers/dashboard.controller.ts`
- Auth: `src/presentation/auth/`
- Pulsar adapter: `src/infrastructure/event-bus/pulsar-event-bus.adapter.ts`
- Temporal adapter: `src/infrastructure/temporal/temporal.adapter.ts`
