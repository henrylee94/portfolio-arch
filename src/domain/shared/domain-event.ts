/**
 * Domain Event — something meaningful that happened in the domain.
 * Published via the event bus (Pulsar) for async consumers.
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
  readonly version: number;
}

export abstract class DomainEventBase implements DomainEvent {
  abstract readonly eventType: string;
  abstract readonly payload: Record<string, unknown>;

  readonly eventId: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly version: number;

  constructor(aggregateId: string, version: number, eventId?: string) {
    this.eventId = eventId ?? crypto.randomUUID();
    this.aggregateId = aggregateId;
    this.occurredAt = new Date();
    this.version = version;
  }
}
