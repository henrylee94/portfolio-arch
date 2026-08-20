import { DomainEvent } from '../../domain/shared/domain-event';

/**
 * EventBus Port — abstracts the event publishing mechanism.
 * Domain/application layer depends on this interface;
 * infrastructure provides the Pulsar implementation.
 *
 * Uses abstract class for DI token compatibility.
 */
export abstract class EventBusPort {
  abstract publish(event: DomainEvent): Promise<void>;
  abstract subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): Promise<void>;
}
