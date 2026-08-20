import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { OrderRepositoryPort } from '../../../domain/order/order.repository.port';
import { EventBusPort } from '../../../infrastructure/event-bus/event-bus.port';
import { CachePort } from '../../../infrastructure/cache/cache.port';
import { OrderStatus } from '../../../domain/order/order-status.value-object';
import { UpdateOrderStatusDto } from '../../../presentation/dto/order.dto';

/**
 * UpdateOrderStatusUseCase — orchestrates order status transitions.
 *
 * Enforces domain rules (status state machine) via the aggregate.
 */
@Injectable()
export class UpdateOrderStatusUseCase {
  private readonly logger = new Logger(UpdateOrderStatusUseCase.name);

  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly cache: CachePort,
  ) {}

  async execute(orderId: string, dto: UpdateOrderStatusDto): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new BadRequestException(`Order ${orderId} not found`);
    }

    // Domain logic: status transition validation happens inside the aggregate
    switch (dto.status) {
      case OrderStatus.CONFIRMED:
        order.confirm(dto.changedBy);
        break;
      case OrderStatus.SHIPPED:
        order.ship(dto.changedBy);
        break;
      case OrderStatus.CANCELLED:
        order.cancel(dto.changedBy);
        break;
      default:
        throw new BadRequestException(`Unsupported status: ${dto.status}`);
    }

    await this.orderRepository.save(order);

    const events = order.clearEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }

    await this.cache.delete(`order:${orderId}`);
    await this.cache.delete(`orders:customer:${order.customerId}`);
  }
}
