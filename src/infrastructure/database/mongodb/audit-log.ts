import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/**
 * MongoDB Audit Log — stores immutable event trail.
 *
 * Design decision: audit logs go to MongoDB because:
 * 1. Schema flexibility — different event types have different shapes
 * 2. Write-heavy, append-only — no updates, no transactions needed
 * 3. Natural fit for document store — each log is a self-contained document
 *
 * This demonstrates polyglot persistence: PostgreSQL for transactional
 * data, MongoDB for event sourcing / audit.
 */
@Schema({ collection: 'audit_logs', timestamps: true })
export class AuditLog {
  @Prop({ required: true, index: true })
  eventType!: string;

  @Prop({ required: true, index: true })
  aggregateId!: string;

  @Prop({ required: true })
  aggregateType!: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ required: true })
  version!: number;

  @Prop({ default: () => new Date() })
  occurredAt!: Date;

  @Prop()
  performedBy?: string;

  @Prop({ default: 'system' })
  source!: string;

  @Prop({ index: true })
  traceId?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Compound index for common queries
AuditLogSchema.index({ aggregateId: 1, occurredAt: -1 });
AuditLogSchema.index({ eventType: 1, occurredAt: -1 });

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly model: Model<AuditLogDocument>,
  ) {}

  async log(params: {
    eventType: string;
    aggregateId: string;
    aggregateType: string;
    payload: Record<string, unknown>;
    version: number;
    performedBy?: string;
    source?: string;
    traceId?: string;
  }): Promise<void> {
    await this.model.create({
      eventType: params.eventType,
      aggregateId: params.aggregateId,
      aggregateType: params.aggregateType,
      payload: params.payload,
      version: params.version,
      occurredAt: new Date(),
      performedBy: params.performedBy,
      source: params.source ?? 'order-service',
      traceId: params.traceId,
    });
  }

  async findByAggregate(
    aggregateId: string,
    limit = 50,
  ): Promise<AuditLogDocument[]> {
    return this.model
      .find({ aggregateId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .exec();
  }

  async findByEventType(
    eventType: string,
    since: Date,
    limit = 100,
  ): Promise<AuditLogDocument[]> {
    return this.model
      .find({ eventType, occurredAt: { $gte: since } })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .exec();
  }
}
