/**
 * LoggingInterceptor — Logs every request/response with traceId for correlation.
 *
 * Log format:
 *   [HTTP] [trace_abc123_def456] GET /v1/orders → 200 (42ms)
 *
 * The traceId comes from TraceContext (AsyncLocalStorage),
 * propagated by TraceInterceptor at the start of each request.
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { TraceContext } from '../../shared/trace/trace.context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const traceId = TraceContext.getTraceId() || req['traceId'] || 'no-trace';
    const now = Date.now();

    this.logger.log(`[${traceId}] ${method} ${url} → processing...`);

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - now;
          this.logger.log(`[${traceId}] ${method} ${url} → 200 (${elapsed}ms)`);
        },
        error: (err) => {
          const elapsed = Date.now() - now;
          const status = err?.status || 500;
          this.logger.error(`[${traceId}] ${method} ${url} → ${status} (${elapsed}ms) — ${err?.message}`);
        },
      }),
    );
  }
}
