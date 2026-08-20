import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { OrderRepositoryPort } from '../../../domain/order/order.repository.port';
import { Order } from '../../../domain/order/order.aggregate';
import { OrderStatus } from '../../../domain/order/order-status.value-object';

/**
 * TypeORM Entity — maps the Order aggregate to PostgreSQL.
 *
 * Design decision: the entity is separate from the aggregate.
 * The adapter maps between them (Anti-Corruption Layer).
 */
import {
  Entity as TypeOrmEntity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@TypeOrmEntity('orders')
export class OrderEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  customerId!: string;

  @Column('jsonb')
  items!: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;

  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount!: number;

  @Column({ length: 3, default: 'MYR' })
  currency!: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Column({ default: 1 })
  version!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * PostgreSQL Order Repository — implements the domain port.
 *
 * This is the Anti-Corruption Layer: maps between domain aggregate
 * and persistence entity. The domain never knows about TypeORM.
 */
@Injectable()
export class PostgresOrderRepository implements OrderRepositoryPort {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly repo: Repository<OrderEntity>,
  ) {}

  async findById(id: string): Promise<Order | null> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) return null;
    return this.toDomain(entity);
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    const entities = await this.repo.find({ where: { customerId } });
    return entities.map((e) => this.toDomain(e));
  }

  async save(order: Order): Promise<void> {
    const entity = this.toEntity(order);
    await this.repo.save(entity);
  }

  async existsById(id: string): Promise<boolean> {
    const count = await this.repo.count({ where: { id } });
    return count > 0;
  }

  // ── Mapping functions ────────────────────────────────────────

  private toDomain(entity: OrderEntity): Order {
    return Order.reconstitute({
      id: entity.id,
      customerId: entity.customerId,
      items: entity.items,
      totalAmount: { amount: Number(entity.totalAmount), currency: entity.currency },
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      version: entity.version,
    });
  }

  private toEntity(order: Order): OrderEntity {
    return {
      id: order.id,
      customerId: order.customerId,
      items: order.items,
      totalAmount: order.totalAmount.amount,
      currency: order.totalAmount.currency,
      status: order.status,
      version: order.version,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
