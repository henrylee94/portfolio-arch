import { AggregateRoot } from '../shared/aggregate-root';
import { OrderStatusVO, OrderStatus } from './order-status.value-object';
import { OrderCreatedEvent, OrderStatusChangedEvent } from './order.events';

// ─── Value Objects (inline) ────────────────────────────────────────

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Money {
  amount: number;
  currency: string;
}

// ─── Aggregate Props ───────────────────────────────────────────────

interface OrderProps {
  customerId: string;
  items: OrderItem[];
  totalAmount: Money;
  status: OrderStatusVO;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Aggregate Root ────────────────────────────────────────────────

/**
 * Order Aggregate Root — the consistency boundary for order operations.
 *
 * Business rules enforced here:
 * - Order must have at least one item
 * - Status transitions follow a defined state machine
 * - Domain events emitted for every state change
 *
 * This is the "core" that has zero infrastructure dependencies.
 */
export class Order extends AggregateRoot<OrderProps> {
  private constructor(id: string, props: OrderProps) {
    super(id, props);
  }

  // ── Factory ────────────────────────────────────────────────────

  static create(params: {
    id: string;
    customerId: string;
    items: OrderItem[];
  }): Order {
    if (params.items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    const totalAmount = params.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    const now = new Date();
    const order = new Order(params.id, {
      customerId: params.customerId,
      items: params.items,
      totalAmount: { amount: totalAmount, currency: 'MYR' },
      status: OrderStatusVO.create(OrderStatus.PENDING),
      createdAt: now,
      updatedAt: now,
    });

    // Emit domain event
    order.addDomainEvent(
      new OrderCreatedEvent({
        orderId: params.id,
        customerId: params.customerId,
        items: params.items,
        totalAmount,
        currency: 'MYR',
        version: order.version,
      }),
    );

    return order;
  }

  // ── Hydration from persistence ─────────────────────────────────

  static reconstitute(data: {
    id: string;
    customerId: string;
    items: OrderItem[];
    totalAmount: Money;
    status: OrderStatus;
    createdAt: Date;
    updatedAt: Date;
    version: number;
  }): Order {
    return new Order(data.id, {
      customerId: data.customerId,
      items: data.items,
      totalAmount: data.totalAmount,
      status: OrderStatusVO.create(data.status),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  // ── Commands ───────────────────────────────────────────────────

  confirm(changedBy: string): void {
    const previousStatus = this.props.status.value;
    this.props.status = this.props.status.transitionTo(OrderStatus.CONFIRMED);
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new OrderStatusChangedEvent({
        orderId: this.id,
        previousStatus,
        newStatus: OrderStatus.CONFIRMED,
        changedBy,
        version: this.version,
      }),
    );
  }

  ship(changedBy: string): void {
    const previousStatus = this.props.status.value;
    this.props.status = this.props.status.transitionTo(OrderStatus.SHIPPED);
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new OrderStatusChangedEvent({
        orderId: this.id,
        previousStatus,
        newStatus: OrderStatus.SHIPPED,
        changedBy,
        version: this.version,
      }),
    );
  }

  cancel(changedBy: string): void {
    const previousStatus = this.props.status.value;
    this.props.status = this.props.status.transitionTo(OrderStatus.CANCELLED);
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new OrderStatusChangedEvent({
        orderId: this.id,
        previousStatus,
        newStatus: OrderStatus.CANCELLED,
        changedBy,
        version: this.version,
      }),
    );
  }

  // ── Queries ────────────────────────────────────────────────────

  get status(): OrderStatus {
    return this.props.status.value;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get items(): OrderItem[] {
    return this.props.items;
  }

  get totalAmount(): Money {
    return this.props.totalAmount;
  }
}
