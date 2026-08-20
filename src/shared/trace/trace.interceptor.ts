/**
 * TraceInterceptor — Generates traceId for every request and propagates it
 * through AsyncLocalStorage so all downstream code can access it.
 *
 * Flow:
 *   1. Check for incoming X-Request-Id header (client-provided trace)
 *   2. If none, generate a new traceId
 *   3. Store in AsyncLocalStorage via TraceContext.run()
 *   4. Set X-Request-Id response header
 *   5. After response, store traceId in request for LoggingInterceptor
 *
 * This is the ENTRY POINT of distributed tracing in the system.
 * Every other component (Pulsar, Temporal, Redis) reads from TraceContext.
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TraceContext } from './trace.context';

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Prefer client-provided trace ID, or generate new one
    const traceId = (req.headers['x-request-id'] as string) || TraceContext.generateTraceId();

    // Run the entire request lifecycle inside trace context
    return new Observable<unknown>((subscriber) => {
      const result = TraceContext.run(traceId, () => {
        // Attach to request for LoggingInterceptor and other middleware
        req['traceId'] = traceId;

        // Set response header — client can correlate requests
        res.setHeader('X-Request-Id', traceId);

        // Execute the handler pipeline inside trace context
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
