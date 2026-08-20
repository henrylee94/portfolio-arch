import { Order, OrderItem } from './order.aggregate';
import { OrderStatus, OrderStatusVO } from './order-status.value-object';

const mockItems: OrderItem[] = [
  { productId: 'PROD-001', productName: 'Cloud Architecture Review', quantity: 1, unitPrice: 2500 },
];

describe('OrderStatusVO Value Object', () => {
  it('should create pending status', () => {
    const status = OrderStatusVO.create(OrderStatus.PENDING);
    expect(status.value).toBe(OrderStatus.PENDING);
  });

  it('should create confirmed status', () => {
    const status = OrderStatusVO.create(OrderStatus.CONFIRMED);
    expect(status.value).toBe(OrderStatus.CONFIRMED);
  });

  it('should transition from pending to confirmed', () => {
    const pending = OrderStatusVO.create(OrderStatus.PENDING);
    const confirmed = pending.transitionTo(OrderStatus.CONFIRMED);
    expect(confirmed.value).toBe(OrderStatus.CONFIRMED);
  });

  it('should throw when transitioning from confirmed to pending', () => {
    const confirmed = OrderStatusVO.create(OrderStatus.CONFIRMED);
    expect(() => confirmed.transitionTo(OrderStatus.PENDING)).toThrow();
  });

  it('should be equal for same value', () => {
    const s1 = OrderStatusVO.create(OrderStatus.PENDING);
    const s2 = OrderStatusVO.create(OrderStatus.PENDING);
    expect(s1.equals(s2)).toBe(true);
  });

  it('should not be equal for different values', () => {
    const s1 = OrderStatusVO.create(OrderStatus.PENDING);
    const s2 = OrderStatusVO.create(OrderStatus.CONFIRMED);
    expect(s1.equals(s2)).toBe(false);
  });
});

describe('Order Aggregate', () => {
  it('should create an order with pending status', () => {
    const order = Order.create({
      id: 'ord_001',
      customerId: 'usr_001',
      items: mockItems,
    });

    expect(order).toBeDefined();
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.customerId).toBe('usr_001');
  });

  it('should emit order.created domain event', () => {
    const order = Order.create({
      id: 'ord_001',
      customerId: 'usr_001',
      items: mockItems,
    });

    const events = order.domainEvents;
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].eventType).toBe('order.created');
  });

  it('should transition from pending to confirmed', () => {
    const order = Order.create({
      id: 'ord_001',
      customerId: 'usr_001',
      items: mockItems,
    });

    order.confirm('admin');
    expect(order.status).toBe(OrderStatus.CONFIRMED);
  });

  it('should emit order.status_changed event on confirm', () => {
    const order = Order.create({
      id: 'ord_001',
      customerId: 'usr_001',
      items: mockItems,
    });

    order.confirm('admin');
    const events = order.domainEvents;
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[1].eventType).toBe('order.status_changed');
  });

  it('should cancel a pending order', () => {
    const order = Order.create({
      id: 'ord_001',
      customerId: 'usr_001',
      items: mockItems,
    });

    order.cancel('admin');
    expect(order.status).toBe(OrderStatus.CANCELLED);
  });

  it('should track items', () => {
    const order = Order.create({
      id: 'ord_001',
      customerId: 'usr_001',
      items: mockItems,
    });

    expect(order.items.length).toBe(1);
    expect(order.items[0].productId).toBe('PROD-001');
    expect(order.items[0].productName).toBe('Cloud Architecture Review');
  });

  it('should throw when creating with empty items', () => {
    expect(() =>
      Order.create({
        id: 'ord_001',
        customerId: 'usr_001',
        items: [],
      }),
    ).toThrow();
  });
});
