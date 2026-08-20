import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { CachePort } from './cache.port';

/**
 * Redis Cache Adapter — implements CachePort.
 *
 * Design decisions:
 * - Uses ioredis for robust Redis client with cluster support
 * - Default TTL: 300s (5 minutes) — configurable per-key
 * - JSON serialization for complex objects
 * - Distributed locking support via SET NX EX
 */
@Injectable()
export class RedisCacheAdapter implements CachePort, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheAdapter.name);
  private readonly client: Redis;
  private readonly defaultTtl = 300; // 5 minutes

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: 0,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    const ttl = ttlSeconds ?? this.defaultTtl;
    await this.client.setex(key, ttl, serialized);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  // ── Distributed Lock (bonus pattern for portfolio) ──────────

  /**
   * Acquire a distributed lock — useful for preventing duplicate
   * order submissions or concurrent inventory mutations.
   *
   * Uses SET NX EX (atomic) — Redlock pattern simplified.
   */
  async acquireLock(
    lockKey: string,
    ttlSeconds = 30,
  ): Promise<{ acquired: boolean; lockId?: string }> {
    const lockId = crypto.randomUUID();
    const result = await this.client.set(
      `lock:${lockKey}`,
      lockId,
      'EX',
      ttlSeconds,
      'NX',
    );
    return {
      acquired: result === 'OK',
      lockId: result === 'OK' ? lockId : undefined,
    };
  }

  async releaseLock(lockKey: string, lockId: string): Promise<boolean> {
    // Lua script: check owner then delete (atomic)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(
      script,
      1,
      `lock:${lockKey}`,
      lockId,
    );
    return result === 1;
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
