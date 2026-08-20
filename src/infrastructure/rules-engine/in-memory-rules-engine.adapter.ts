import { Injectable, Logger } from '@nestjs/common';
import { RulesEnginePort, RuleEvaluationResult, RuleViolation } from './rules-engine.port';

/**
 * In-Memory Rules Engine Adapter — implements RulesEnginePort.
 *
 * In production this would use:
 * - json-rules-engine (npm) for declarative rules
 * - Or a custom DSL for complex business logic
 * - Rules stored in DB, hot-reloadable without restart
 *
 * Pattern demonstrated:
 * - Rule sets loaded by name
 * - Context-based evaluation (order, customer, product data)
 * - Structured violations with severity levels
 */
@Injectable()
export class InMemoryRulesEngineAdapter implements RulesEnginePort {
  private readonly logger = new Logger(InMemoryRulesEngineAdapter.name);

  // Rule definitions — in production, loaded from DB/config
  private readonly ruleSets = new Map<string, RuleDefinition[]>(
    new Map([
      [
        'order.validation',
        [
          {
            id: 'ORDER_MIN_AMOUNT',
            name: 'Minimum order amount',
            evaluate: (ctx: OrderRuleContext) => ({
              passed: ctx.totalAmount >= 10,
              message: `Order total ${ctx.totalAmount} is below minimum 10.00`,
              field: 'totalAmount',
            }),
          },
          {
            id: 'ORDER_MAX_ITEMS',
            name: 'Maximum items per order',
            evaluate: (ctx: OrderRuleContext) => ({
              passed: ctx.itemCount <= 50,
              message: `Order has ${ctx.itemCount} items, maximum is 50`,
              field: 'items',
            }),
          },
          {
            id: 'ORDER_BLACKLIST_CHECK',
            name: 'Customer blacklist check',
            evaluate: (ctx: OrderRuleContext) => ({
              passed: !ctx.isBlacklisted,
              message: `Customer ${ctx.customerId} is blacklisted`,
              field: 'customerId',
            }),
          },
        ],
      ],
      [
        'order.pricing',
        [
          {
            id: 'BULK_DISCOUNT',
            name: 'Bulk order discount eligibility',
            evaluate: (ctx: OrderRuleContext) => ({
              passed: ctx.totalAmount < 1000 || ctx.hasDiscountCode,
              message: ctx.totalAmount >= 1000 && !ctx.hasDiscountCode
                ? 'Orders above 1000 require a discount code'
                : '',
              field: 'discountCode',
            }),
          },
        ],
      ],
    ]),
  );

  async evaluate<TContext>(
    ruleSetName: string,
    context: TContext,
  ): Promise<RuleEvaluationResult> {
    const startTime = Date.now();
    const rules = this.ruleSets.get(ruleSetName);

    if (!rules) {
      this.logger.warn(`Rule set not found: ${ruleSetName}`);
      return {
        passed: true,
        ruleSetName,
        violations: [],
        evaluatedAt: new Date(),
        executionTimeMs: Date.now() - startTime,
      };
    }

    const violations: RuleViolation[] = [];

    for (const rule of rules) {
      const result = rule.evaluate(context as OrderRuleContext);
      if (!result.passed && result.message) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          message: result.message,
          severity: 'error',
          field: result.field,
        });
      }
    }

    return {
      passed: violations.length === 0,
      ruleSetName,
      violations,
      evaluatedAt: new Date(),
      executionTimeMs: Date.now() - startTime,
    };
  }

  async listRuleSets(): Promise<string[]> {
    return Array.from(this.ruleSets.keys());
  }
}

// ── Internal types ───────────────────────────────────────────────

interface RuleDefinition {
  id: string;
  name: string;
  evaluate: (ctx: OrderRuleContext) => {
    passed: boolean;
    message: string;
    field?: string;
  };
}

interface OrderRuleContext {
  totalAmount: number;
  itemCount: number;
  customerId: string;
  isBlacklisted: boolean;
  hasDiscountCode: boolean;
}
