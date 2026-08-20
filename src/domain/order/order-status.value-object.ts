import { ValueObject } from '../shared/value-object';

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

/**
 * OrderStatus Value Object — enforces valid transitions.
 * This is where business rules about status live.
 */
export class OrderStatusVO extends ValueObject<{ status: OrderStatus }> {
  private static readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  private constructor(status: OrderStatus) {
    super({ status });
  }

  static create(status: OrderStatus): OrderStatusVO {
    return new OrderStatusVO(status);
  }

  get value(): OrderStatus {
    return this.props.status;
  }

  canTransitionTo(next: OrderStatus): boolean {
    return OrderStatusVO.VALID_TRANSITIONS[this.props.status]?.includes(next) ?? false;
  }

  transitionTo(next: OrderStatus): OrderStatusVO {
    if (!this.canTransitionTo(next)) {
      throw new Error(
        `Invalid status transition: ${this.props.status} → ${next}. ` +
        `Allowed: ${OrderStatusVO.VALID_TRANSITIONS[this.props.status]?.join(', ') ?? 'none'}`,
      );
    }
    return new OrderStatusVO(next);
  }
}
