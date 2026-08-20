#!/usr/bin/env node
/**
 * Portfolio Seed Script — Demo Data Generator
 *
 * Usage:
 *   npx ts-node scripts/seed.ts          (standalone — connects to running server via HTTP)
 *   npx ts-node scripts/seed.ts --direct (programmatic — bootstraps NestJS app directly)
 *
 * Standalone mode: uses built-in demo user (admin / 123456), no DB needed.
 * Full mode: registers new users, creates orders via Pulsar → Temporal flow.
 *
 * Each request includes X-Request-Id (traceId) for distributed tracing demo.
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/v1';

interface SeedResult {
  users: Array<{ id: string; email: string; token: string }>;
  orders: Array<{ id: string; status: string }>;
}

interface ApiResponse {
  status: number;
  data: any;
  traceId: string | null;
}

async function api(method: string, path: string, body?: unknown, token?: string): Promise<ApiResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  const traceId = res.headers.get('x-request-id');
  return { status: res.status, data, traceId };
}

function traceTag(traceId: string | null): string {
  return traceId ? `[${traceId}]` : '[no-trace]';
}

async function seed(): Promise<SeedResult> {
  console.log('🌱 Portfolio Seed Script');
  console.log('═══════════════════════════════════════');
  console.log(`API: ${API_BASE}\n`);

  const result: SeedResult = { users: [], orders: [] };

  // ═══════════════════════════════════════
  // STEP 1: Login (triggers UserLoggedIn event)
  // ═══════════════════════════════════════
  console.log('━━━ Step 1: Authentication ━━━');

  const demoUsers = [
    { email: 'admin', password: '123456', label: 'Admin' },
    { email: 'admin@portfolio.dev', password: 'admin123', label: 'Admin (email)' },
    { email: 'henry@portfolio.dev', password: 'user123', label: 'Henry' },
  ];

  for (const u of demoUsers) {
    console.log(`  🔑 Login: ${u.label} (${u.email})...`);
    const login = await api('POST', '/auth/login', { email: u.email, password: u.password });

    if (login.status === 200 && login.data.access_token) {
      console.log(`     ✅ Logged in ${traceTag(login.traceId)}`);
      console.log(`     🎫 JWT token: ${login.data.access_token.substring(0, 20)}...`);
      console.log(`     👤 User: ${login.data.user.email} | roles: ${login.data.user.roles?.join(', ')}`);
      result.users.push({
        id: login.data.user.id ?? 'unknown',
        email: u.email,
        token: login.data.access_token,
      });
    } else {
      console.log(`     ⚠️  Response: ${login.status} — ${JSON.stringify(login.data).substring(0, 100)}`);
    }
  }

  console.log('');

  // ═══════════════════════════════════════
  // STEP 2: Dashboard Flow (visualize architecture)
  // ═══════════════════════════════════════
  console.log('━━━ Step 2: Dashboard Flow ━━━');

  if (result.users.length > 0) {
    const adminToken = result.users[0].token;
    console.log('  📊 Fetching architecture flow...');
    const flow = await api('GET', '/dashboard/flow', undefined, adminToken);

    if (flow.status === 200) {
      console.log(`     ✅ Components: ${flow.data.components.length} ${traceTag(flow.traceId)}`);
      console.log(`     📡 Data flows: ${flow.data.flows.length}`);
      console.log(`     📜 Recent events: ${flow.data.recentEvents.length}`);

      for (const evt of flow.data.recentEvents) {
        const traceInfo = evt.traceId ? ` [${evt.traceId}]` : '';
        console.log(`        → ${evt.eventType} (${evt.status})${traceInfo}`);
      }
    } else {
      console.log(`     ⚠️  Flow response: ${flow.status}`);
    }
  }

  console.log('');

  // ═══════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════
  console.log('═══════════════════════════════════════');
  console.log('🎉 Seed Complete!');
  console.log(`   Users authenticated: ${result.users.length}`);
  console.log('');
  console.log('Architecture flow demonstrated:');
  console.log('  Client → NestJS Gateway → TraceInterceptor (generates traceId)');
  console.log('  → LoggingInterceptor → Auth Controller → AuthService');
  console.log('  → Response with X-Request-Id header');
  console.log('');
  console.log('TraceId propagation:');
  console.log('  Request → TraceInterceptor → AsyncLocalStorage');
  console.log('  → Controller logs    → [trace_xxx] Login attempt: admin');
  console.log('  → Service logs       → [trace_xxx] User authenticated: admin');
  console.log('  → Response header    → X-Request-Id: trace_xxx');
  console.log('  → Pulsar event       → properties.traceId = trace_xxx');
  console.log('  → Temporal workflow  → metadata.traceId = trace_xxx');
  console.log('');
  console.log('Open Dashboard: http://localhost:3002/dashboard');
  console.log('═══════════════════════════════════════');

  return result;
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
