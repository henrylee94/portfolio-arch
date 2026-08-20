import { Order } from './order.aggregate';

/**
 * Order Repository Port — the domain defines WHAT it needs,
 * infrastructure provides HOW.
 *
 * Uses abstract class (not interface) so it can serve as a DI token.
 * This is a standard pattern in NestJS DDD architecture.
 */
export abstract class OrderRepositoryPort {
  abstract findById(id: string): Promise<Order | null>;
  abstract findByCustomerId(customerId: string): Promise<Order[]>;
  abstract save(order: Order): Promise<void>;
  abstract existsById(id: string): Promise<boolean>;
}
