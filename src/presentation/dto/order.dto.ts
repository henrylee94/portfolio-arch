import { IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ─── Request DTOs ──────────────────────────────────────────────────

export class CreateOrderItemDto {
  @IsString()
  productId!: string;

  @IsString()
  productName!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateOrderDto {
  @IsString()
  customerId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class UpdateOrderStatusDto {
  @IsString()
  status!: string;

  @IsString()
  changedBy!: string;
}

// ─── Response DTOs ─────────────────────────────────────────────────

export class OrderItemResponseDto {
  productId!: string;
  productName!: string;
  quantity!: number;
  unitPrice!: number;
}

export class OrderResponseDto {
  id!: string;
  customerId!: string;
  items!: OrderItemResponseDto[];
  totalAmount!: { amount: number; currency: string };
  status!: string;
  createdAt!: string;
  updatedAt!: string;
  version!: number;
}
