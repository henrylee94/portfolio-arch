import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { OrderRepositoryPort } from '../../../domain/order/order.repository.port';
import { Order } from '../../../domain/order/order.aggregate';

/**
 * GetOrderQuery — read-only query for fetching an order.
 */
@Injectable()
export class GetOrderQuery {
  private readonly logger = new Logger(GetOrderQuery.name);

  constructor(private readonly orderRepository: OrderRepositoryPort) {}

  async execute(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    return order;
  }
}
