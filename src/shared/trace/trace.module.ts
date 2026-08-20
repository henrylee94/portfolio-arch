/**
 * TraceModule — Re-exports trace context and interceptor for NestJS DI.
 *
 * Register in AppModule:
 *   @Module({ imports: [TraceModule] })
 *
 * Then globally apply TraceInterceptor in main.ts:
 *   app.useGlobalInterceptors(new TraceInterceptor());
 *
 * The TraceContext static class is always available via import — no DI needed.
 * This module exists mainly for NestJS module graph completeness.
 */
import { Module, Global } from '@nestjs/common';
import { TraceContext } from './trace.context';

@Global()
@Module({
  providers: [],
  exports: [],
})
export class TraceModule {}

// Re-export for convenience
export { TraceContext } from './trace.context';
export { TraceInterceptor } from './trace.interceptor';
