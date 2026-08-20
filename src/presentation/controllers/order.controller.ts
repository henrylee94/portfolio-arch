import {
  Injectable,
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Version,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';
import { CreateOrderDto, UpdateOrderStatusDto, OrderResponseDto } from '../dto/order.dto';
import { CreateOrderUseCase } from '../../application/order/commands/create-order.use-case';
import { UpdateOrderStatusUseCase } from '../../application/order/commands/update-order-status.use-case';
import { GetOrderQuery } from '../../application/order/queries/get-order.query';

/**
 * Order Controller — HTTP interface for the Order domain.
 *
 * DDD layers visible in each endpoint:
 *   HTTP Request
 *     → Controller (DTO validation, response mapping)
 *       → Use Case (orchestration)
 *         → Aggregate Root (business logic)
 *           → Repository (persistence)
 *           → EventBus (Pulsar)
 *           → Cache (Redis)
 *
 * API Versioning: @Version('1') demonstrates route-based versioning.
 * In production, versioning can also be done via:
 *   - URL prefix: /v1/orders, /v2/orders
 *   - Header: Accept-Version: 1
 *   - Query param: ?version=1
 */
@Controller('orders')
@UseInterceptors(LoggingInterceptor)
export class OrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase,
    private readonly getOrderQuery: GetOrderQuery,
  ) {}

  /**
   * POST /v1/orders
   * Create a new order.
   *
   * Flow:
   * 1. DTO validation (class-validator)
   * 2. CreateOrderUseCase orchestrates:
   *    - Order.create() → domain logic
   *    - OrderRepository.save() → PostgreSQL
   *    - EventBus.publish() → Pulsar + MongoDB audit
   *    - Cache.delete() → Redis invalidation
   * 3. Response mapping (Order → OrderResponseDto)
   */
  @Post()
  @Version('1')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  async createOrder(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    const order = await this.createOrderUseCase.execute(dto);
    return this.toResponse(order);
  }

  /**
   * GET /v1/orders/:id
   * Fetch a single order by ID.
   *
   * Demonstrates: Read-through cache pattern.
   * In production, the use case would check Redis first,
   * falling back to PostgreSQL on cache miss.
   */
  @Get(':id')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async getOrder(@Param('id') id: string): Promise<OrderResponseDto> {
    const order = await this.getOrderQuery.execute(id);
    return this.toResponse(order);
  }

  /**
   * PATCH /v1/orders/:id/status
   * Transition order status (state machine).
   *
   * Flow:
   * 1. UpdateOrderStatusUseCase orchestrates:
   *    - Find order (repository)
   *    - Validate transition (aggregate state machine)
   *    - Emit OrderStatusChangedEvent (Pulsar)
   *    - Update cache (Redis)
   */
  @Post(':id/status')
  @Version('1')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<void> {
    await this.updateOrderStatusUseCase.execute(id, dto);
  }

  // ── Mapping ─────────────────────────────────────────────────

  private toResponse(order: any): OrderResponseDto {
    return {
      id: order.id,
      customerId: order.customerId,
      items: order.items,
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt?.toISOString?.() ?? String(order.createdAt),
      updatedAt: order.updatedAt?.toISOString?.() ?? String(order.updatedAt),
      version: order.version,
    };
  }
}
