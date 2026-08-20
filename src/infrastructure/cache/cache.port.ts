/**
 * Cache Port — abstracts caching mechanism.
 * Application layer depends on this; infrastructure provides Redis.
 *
 * Uses abstract class for DI token compatibility.
 */
export abstract class CachePort {
  abstract get<T>(key: string): Promise<T | null>;
  abstract set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract has(key: string): Promise<boolean>;
}
