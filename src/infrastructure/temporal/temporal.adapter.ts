import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Connection } from '@temporalio/client';
import { WorkflowOrchestratorPort, WorkflowOptions } from './workflow.port';
import { TraceContext } from '../../shared/trace/trace.context';

/**
 * Temporal Workflow Orchestrator Adapter — REAL Temporal integration.
 *
 * Architecture:
 *   NestJS App ──→ TemporalAdapter ──→ Connection.connect({address: 'localhost:7233'})
 *                                           │
 *                                           └──→ WorkflowClient
 *                                                    ├── start('OrderProcessingSaga', {...})
 *                                                    ├── start('UserRegistrationJourney', {...})
 *                                                    └── taskQueue: 'portfolio-queue'
 *
 * TraceId propagation: Every workflow start/signal/query carries traceId from TraceContext.
 * This allows end-to-end correlation: HTTP Request → Pulsar Event → Temporal Workflow.
 */
@Injectable()
export class TemporalWorkflowAdapter implements WorkflowOrchestratorPort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TemporalWorkflowAdapter.name);

  private client: Client;

  // In-memory fallback when Temporal is unavailable
  private readonly fallbackWorkflows = new Map<string, {
    type: string;
    input: unknown;
    status: string;
    startedAt: Date;
    workflowId: string;
    traceId: string;
  }>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const temporalUrl = this.config.get('TEMPORAL_SERVICE_URL', 'localhost:7233');
    const namespace = this.config.get('TEMPORAL_NAMESPACE', 'default');

    try {
      this.logger.log(`Connecting to Temporal at ${temporalUrl}...`);

      const connection = await Connection.connect({
        address: temporalUrl,
      });

      this.client = new Client({
        connection,
        namespace,
      });

      this.logger.log(`Temporal client connected. Namespace: ${namespace}`);
    } catch (error) {
      this.logger.warn(`Temporal connection failed (${error}). Running in degraded mode — workflows simulated.`);
    }
  }

  async startWorkflow<TInput, TOutput>(
    workflowType: string,
    input: TInput,
    options?: WorkflowOptions,
  ): Promise<string> {
    const workflowId = options?.workflowId ?? `${workflowType}-${crypto.randomUUID()}`;
    const taskQueue = options?.taskQueue ?? 'portfolio-queue';
    const traceId = TraceContext.getTraceId() || 'system';

    this.logger.log(`[${traceId}] Starting workflow: ${workflowType} | id: ${workflowId}`);

    if (this.client) {
      try {
        const handle = await this.client.workflow.start(workflowType, {
          taskQueue,
          workflowId,
          args: [input] as any[],
          retry: {
            maximumAttempts: 3,
            backoffCoefficient: 2,
            initialInterval: 1000,
            maximumInterval: 30000,
          },
        });

        this.logger.log(`[${traceId}] Temporal workflow started: ${handle.workflowId}`);
        return handle.workflowId;
      } catch (error) {
        this.logger.error(`[${traceId}] Temporal workflow start failed: ${error}`);
        throw error;
      }
    }

    // Fallback: in-memory simulation
    this.fallbackWorkflows.set(workflowId, {
      type: workflowType,
      input,
      status: 'RUNNING',
      startedAt: new Date(),
      workflowId,
      traceId,
    });

    return workflowId;
  }

  async signalWorkflow(
    workflowId: string,
    signalName: string,
    payload: unknown,
  ): Promise<void> {
    const traceId = TraceContext.getTraceId() || 'system';
    this.logger.log(`[${traceId}] Signaling workflow: ${workflowId} | signal: ${signalName}`);

    if (this.client) {
      try {
        const handle = this.client.workflow.getHandle(workflowId);
        await handle.signal(signalName, payload as any[]);
        this.logger.log(`[${traceId}] Signal sent: ${signalName} to ${workflowId}`);
        return;
      } catch (error) {
        this.logger.error(`[${traceId}] Temporal signal failed: ${error}`);
        throw error;
      }
    }

    const instance = this.fallbackWorkflows.get(workflowId);
    if (instance) {
      Object.assign(instance, { lastSignal: signalName, signalPayload: payload });
    }
  }

  async queryWorkflow<TOutput>(
    workflowId: string,
    queryType: string,
  ): Promise<TOutput> {
    const traceId = TraceContext.getTraceId() || 'system';
    this.logger.log(`[${traceId}] Querying workflow: ${workflowId} | query: ${queryType}`);

    if (this.client) {
      try {
        const handle = this.client.workflow.getHandle(workflowId);
        const result = await handle.query(queryType);
        return result as TOutput;
      } catch (error) {
        this.logger.error(`[${traceId}] Temporal query failed: ${error}`);
        throw error;
      }
    }

    const instance = this.fallbackWorkflows.get(workflowId) as Record<string, unknown>;
    return (instance?.[queryType] ?? instance) as TOutput;
  }

  async describeWorkflow(workflowId: string) {
    if (this.client) {
      try {
        const handle = this.client.workflow.getHandle(workflowId);
        return await handle.describe();
      } catch (error) {
        this.logger.error(`Temporal describe failed: ${error}`);
        return null;
      }
    }

    return this.fallbackWorkflows.get(workflowId) ?? null;
  }

  async listWorkflows(limit = 20) {
    if (this.client) {
      try {
        const result = await this.client.workflow.list({
          query: `WorkflowType = 'OrderProcessingSaga' OR WorkflowType = 'UserRegistrationJourney'`,
        });
        const workflows: any[] = [];
        for await (const wf of result) {
          workflows.push(wf);
          if (workflows.length >= limit) break;
        }
        return workflows;
      } catch (error) {
        this.logger.error(`Temporal list failed: ${error}`);
      }
    }

    return Array.from(this.fallbackWorkflows.values()).slice(-limit);
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Temporal client...');

    if (this.client) {
      try { await this.client.connection.close(); } catch { /* ignore */ }
    }

    this.logger.log('Temporal client shut down');
  }
}
