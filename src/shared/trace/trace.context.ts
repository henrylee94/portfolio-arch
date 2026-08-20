/**
 * TraceContext — Distributed tracing propagation via AsyncLocalStorage.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  TraceInterceptor (generates traceId)                      │
 *   │       ↓ stores in AsyncLocalStorage                         │
 *   │  Controller → Service → Repository (all read traceId)       │
 *   │       ↓                                                     │
 *   │  Pulsar Producer (traceId in message properties)            │
 *   │  Temporal Workflow (traceId in workflow metadata)           │
 *   │  Response Header (X-Request-Id: <traceId>)                  │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Usage in any service/repository/adapter:
 *   import { TraceContext } from '../shared/trace/trace.context';
 *   const traceId = TraceContext.getTraceId(); // returns string or undefined
 *   this.logger.log(`[${traceId}] Processing order...`);
 *
 * Design: Static class with AsyncLocalStorage — zero DI needed.
 * This is the standard Node.js pattern for request-scoped context.
 */
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

interface TraceData {
  traceId: string;
  userId?: string;
  [key: string]: unknown;
}

const storage = new AsyncLocalStorage<TraceData>();

export class TraceContext {
  /**
   * Run a callback within a trace context.
   * Called by TraceInterceptor at the start of each request.
   */
  static run(traceId: string, fn: () => void | Promise<void>): void | Promise<void> {
    return storage.run({ traceId }, fn);
  }

  /**
   * Run with extended context (e.g., after JWT validation adds userId).
   */
  static runWith(updates: Partial<TraceData>, fn: () => void | Promise<void>): void | Promise<void> {
    const current = storage.getStore();
    if (!current) {
      return storage.run({ traceId: TraceContext.generateTraceId(), ...updates } as TraceData, fn);
    }
    const merged: TraceData = { ...current, ...updates } as TraceData;
    return storage.run(merged, fn);
  }

  /**
   * Get current traceId — safe to call from anywhere in the call stack.
   * Returns undefined if called outside a trace context (e.g., during startup).
   */
  static getTraceId(): string | undefined {
    return storage.getStore()?.traceId;
  }

  /**
   * Get full trace data (traceId + userId + custom fields).
   */
  static getTraceData(): TraceData | undefined {
    return storage.getStore();
  }

  /**
   * Generate a new traceId. Format: `trace_<timestamp>_<random>`
   * Human-readable prefix + collision-resistant suffix.
   */
  static generateTraceId(): string {
    const ts = Date.now().toString(36); // base36 timestamp
    const rand = randomUUID().slice(0, 8); // first 8 chars of UUID
    return `trace_${ts}_${rand}`;
  }
}
