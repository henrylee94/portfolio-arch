/**
 * Rules Engine Port — abstracts business rule evaluation.
 * Supports hot-reloadable rules for order validation, pricing, etc.
 *
 * Uses abstract class for DI token compatibility.
 */
export abstract class RulesEnginePort {
  abstract evaluate<TContext>(
    ruleSetName: string,
    context: TContext,
  ): Promise<RuleEvaluationResult>;

  abstract listRuleSets(): Promise<string[]>;
}

export interface RuleEvaluationResult {
  passed: boolean;
  ruleSetName: string;
  violations: RuleViolation[];
  evaluatedAt: Date;
  executionTimeMs: number;
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'error' | 'warning';
  field?: string;
}
