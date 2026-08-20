import { DomainEventBase } from '../shared/domain-event';

/**
 * OrderCreated — published when a new order is placed.
 * Consumed by: notification service, inventory reservation, analytics.
 */
export class OrderCreatedEvent extends DomainEventBase {
  readonly eventType = 'order.created';

  readonly payload: {
    orderId: string;
    customerId: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    totalAmount: number;
    currency: string;
  };

  constructor(params: {
    orderId: string;
    customerId: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    totalAmount: number;
    currency: string;
    version: number;
  }) {
    super(params.orderId, params.version);
    this.payload = {
      orderId: params.orderId,
      customerId: params.customerId,
      items: params.items,
      totalAmount: params.totalAmount,
      currency: params.currency,
    };
  }
}

/**
 * OrderStatusChanged — published when order transitions.
 */
export class OrderStatusChangedEvent extends DomainEventBase {
  readonly eventType = 'order.status_changed';

  readonly payload: {
    orderId: string;
    previousStatus: string;
    newStatus: string;
    changedBy: string;
  };

  constructor(params: {
    orderId: string;
    previousStatus: string;
    newStatus: string;
    changedBy: string;
    version: number;
  }) {
    super(params.orderId, params.version);
    this.payload = {
      orderId: params.orderId,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      changedBy: params.changedBy,
    };
  }
}
