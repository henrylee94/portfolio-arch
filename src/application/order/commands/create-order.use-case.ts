import { Injectable, Logger } from '@nestjs/common';
import { OrderRepositoryPort } from '../../../domain/order/order.repository.port';
import { Order } from '../../../domain/order/order.aggregate';
import { EventBusPort } from '../../../infrastructure/event-bus/event-bus.port';
import { CachePort } from '../../../infrastructure/cache/cache.port';
import { CreateOrderDto } from '../../../presentation/dto/order.dto';

/**
 * CreateOrderUseCase — orchestrates the creation of an order.
 *
 * Follows DDD Application Service pattern:
 * 1. Create aggregate (domain logic)
 * 2. Validate via rules engine (cross-cutting)
 * 3. Persist to repository
 * 4. Publish domain events
 * 5. Invalidate cache
 *
 * No HTTP concerns, no infrastructure details — just orchestration.
 */
@Injectable()
export class CreateOrderUseCase {
  private readonly logger = new Logger(CreateOrderUseCase.name);

  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly cache: CachePort,
  ) {}

  async execute(dto: CreateOrderDto): Promise<Order> {
    this.logger.log(`Creating order for customer: ${dto.customerId}`);

    // 1. Create aggregate — domain logic enforced here
    const order = Order.create({
      id: crypto.randomUUID(),
      customerId: dto.customerId,
      items: dto.items,
    });

    // 2. Persist
    await this.orderRepository.save(order);

    // 3. Publish domain events via Pulsar
    const events = order.clearEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }

    // 4. Invalidate related cache
    await this.cache.delete(`orders:customer:${dto.customerId}`);

    this.logger.log(`Order created: ${order.id}`);
    return order;
  }
}
