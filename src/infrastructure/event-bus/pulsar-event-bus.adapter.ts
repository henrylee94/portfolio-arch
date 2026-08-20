import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Pulsar from 'pulsar-client';
import { EventBusPort } from './event-bus.port';
import { DomainEvent } from '../../domain/shared/domain-event';
import { AuditLogRepository } from '../database/mongodb/audit-log';
import { TraceContext } from '../../shared/trace/trace.context';

/**
 * Pulsar EventBus Adapter — REAL Apache Pulsar integration.
 *
 * Architecture:
 *   publish(event) ──→ Pulsar Producer ──→ persistent://public/default/domain-events
 *                          │
 *                          ├──→ Consumer A (notification handler)
 *                          ├──→ Consumer B (analytics handler)
 *                          └──→ Consumer C (audit handler)
 *
 * Design decisions:
 * - Persistent topic with ordering key = aggregateId
 * - Dual-write: Pulsar publish + MongoDB audit log
 * - Falls back gracefully if Pulsar is unavailable
 * - Tracks published events for dashboard visualization
 *
 * Pulsar API notes (from @types/pulsar-client):
 * - ProducerMessage.data = Buffer (not "content")
 * - ConsumerConfig.listener = (message, consumer) => void (not "messageListener")
 * - nAckRedeliverTimeoutMs (not negativeAckRedeliveryDelayMs)
 */
@Injectable()
export class PulsarEventBusAdapter implements EventBusPort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PulsarEventBusAdapter.name);

  private client: Pulsar.Client;
  private producer: Pulsar.Producer;
  private readonly consumers: Pulsar.Consumer[] = [];
  private readonly subscribers = new Map<string, ((event: DomainEvent) => Promise<void>)[]>();

  // Track published events for the dashboard visualizer
  private readonly recentEvents: Array<{
    eventType: string;
    aggregateId: string;
    timestamp: Date;
    topic: string;
    status: 'published' | 'consumed' | 'failed';
    traceId: string;
  }> = [];

  constructor(
    private readonly config: ConfigService,
    private readonly auditLogRepo: AuditLogRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const serviceUrl = this.config.get('PULSAR_SERVICE_URL', 'pulsar://localhost:6650');

    try {
      this.logger.log(`Connecting to Pulsar at ${serviceUrl}...`);

      this.client = new Pulsar.Client({
        serviceUrl,
        operationTimeoutSeconds: 10,
      });

      this.producer = await this.client.createProducer({
        topic: 'persistent://public/default/domain-events',
        producerName: 'portfolio-nestjs',
        batchingEnabled: false,
        blockIfQueueFull: true,
        sendTimeoutMs: 10000,
      });

      this.logger.log(`Pulsar producer connected. Topic: persistent://public/default/domain-events`);
    } catch (error) {
      this.logger.warn(`Pulsar connection failed (${error}). Running in degraded mode — events audit-logged only.`);
    }
  }

  async publish(event: DomainEvent): Promise<void> {
    const traceId = TraceContext.getTraceId() || 'system';
    this.logger.log(`[${traceId}] Publishing event: ${event.eventType} | aggregate: ${event.aggregateId}`);

    // 1. Persist to MongoDB audit log (dual-write — always succeeds)
    await this.auditLogRepo.log({
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: 'Order',
      payload: event.payload,
      version: event.version,
      traceId,
    });

    // 2. Publish to Pulsar with traceId in properties
    if (this.producer) {
      try {
        const data = Buffer.from(JSON.stringify({
          eventId: event.eventId,
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          payload: event.payload,
          version: event.version,
          traceId,
          occurredAt: event.occurredAt.toISOString(),
        }));

        const msgId = await this.producer.send({
          data,
          properties: {
            eventType: event.eventType,
            aggregateId: event.aggregateId,
            traceId,
          },
          orderingKey: event.aggregateId,
        });

        this.recentEvents.push({
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          timestamp: new Date(),
          topic: 'persistent://public/default/domain-events',
          status: 'published',
          traceId,
        });

        this.logger.log(`[${traceId}] Pulsar message sent: ${msgId}`);
      } catch (error) {
        this.logger.error(`[${traceId}] Pulsar publish failed: ${error}`);

        this.recentEvents.push({
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          timestamp: new Date(),
          topic: 'persistent://public/default/domain-events',
          status: 'failed',
          traceId,
        });
      }
    } else {
      this.recentEvents.push({
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        timestamp: new Date(),
        topic: 'audit-only (Pulsar unavailable)',
        status: 'published',
        traceId,
      });
    }

    // 3. Notify in-memory subscribers
    const handlers = this.subscribers.get(event.eventType) ?? [];
    const wildcardHandlers = this.subscribers.get('*') ?? [];

    for (const handler of [...handlers, ...wildcardHandlers]) {
      try {
        await handler(event);
      } catch (err) {
        this.logger.error(`Event handler failed for ${event.eventType}: ${err}`);
      }
    }
  }

  async subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): Promise<void> {
    const existing = this.subscribers.get(eventType) ?? [];
    existing.push(handler);
    this.subscribers.set(eventType, existing);
    this.logger.log(`Subscribed to event: ${eventType}`);

    if (this.client) {
      try {
        const consumer = await this.client.subscribe({
          topic: `persistent://public/default/${eventType}`,
          subscription: `portfolio-${eventType}`,
          subscriptionType: 'Shared',
          ackTimeoutMs: 30000,
          nAckRedeliverTimeoutMs: 5000,
          listener: async (msg: Pulsar.Message, consumer: Pulsar.Consumer) => {
            try {
              const payload = JSON.parse(msg.getData().toString());
              await handler({
                eventId: payload.eventId,
                eventType: payload.eventType,
                aggregateId: payload.aggregateId,
                payload: payload.payload,
                version: payload.version,
                occurredAt: new Date(payload.occurredAt),
              } as DomainEvent);

              this.recentEvents.push({
                eventType: payload.eventType,
                aggregateId: payload.aggregateId,
                timestamp: new Date(),
                topic: `persistent://public/default/${eventType}`,
                status: 'consumed',
                traceId: payload.traceId || 'unknown',
              });

              await consumer.acknowledge(msg);
            } catch (error) {
              this.logger.error(`Consumer handler error: ${error}`);
              consumer.negativeAcknowledge(msg);
            }
          },
        });

        this.consumers.push(consumer);
        this.logger.log(`Pulsar consumer created for topic: ${eventType}`);
      } catch (error) {
        this.logger.warn(`Failed to create Pulsar consumer for ${eventType}: ${error}`);
      }
    }
  }

  getRecentEvents(limit = 50): typeof this.recentEvents {
    return this.recentEvents.slice(-limit);
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Pulsar EventBus...');

    for (const consumer of this.consumers) {
      try { await consumer.close(); } catch { /* ignore */ }
    }

    if (this.producer) {
      try { await this.producer.close(); } catch { /* ignore */ }
    }

    if (this.client) {
      try { await this.client.close(); } catch { /* ignore */ }
    }

    this.logger.log('Pulsar EventBus shut down');
  }
}
