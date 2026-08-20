/**
 * Workflow Orchestrator Port — abstracts workflow execution.
 * Represents Temporal-style workflow orchestration.
 *
 * Uses abstract class for DI token compatibility.
 */
export abstract class WorkflowOrchestratorPort {
  abstract startWorkflow<TInput, TOutput>(
    workflowType: string,
    input: TInput,
    options?: WorkflowOptions,
  ): Promise<string>;

  abstract signalWorkflow(
    workflowId: string,
    signalName: string,
    payload: unknown,
  ): Promise<void>;

  abstract queryWorkflow<TOutput>(
    workflowId: string,
    queryType: string,
  ): Promise<TOutput>;
}

export interface WorkflowOptions {
  workflowId?: string;
  taskQueue?: string;
  retryPolicy?: {
    maxAttempts: number;
    backoffCoefficient: number;
  };
  timeout?: {
    runTimeoutSeconds: number;
    heartbeatTimeoutSeconds: number;
  };
}
