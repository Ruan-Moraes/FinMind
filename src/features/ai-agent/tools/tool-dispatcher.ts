import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';
import {
  deletePortfolioGoalExecutor,
  upsertPortfolioGoalExecutor,
} from '@/features/ai-agent/tools/tool-executors-goals';
import {
  upsertStaticRuleExecutor,
  upsertValueForecastExecutor,
} from '@/features/ai-agent/tools/tool-executors-rules-forecast';
import {
  createTransactionExecutor,
  updateUserPreferencesExecutor,
} from '@/features/ai-agent/tools/tool-executors-finance';

const MUTATION_EXECUTORS: Record<string, AgentToolExecutor> = {
  upsert_portfolio_goal: upsertPortfolioGoalExecutor,
  delete_portfolio_goal: deletePortfolioGoalExecutor,
  upsert_static_rule: upsertStaticRuleExecutor,
  upsert_value_forecast: upsertValueForecastExecutor,
  create_transaction: createTransactionExecutor,
  update_user_preferences: updateUserPreferencesExecutor,
};

export function getMutationToolExecutor(toolName: string): AgentToolExecutor | null {
  return MUTATION_EXECUTORS[toolName] || null;
}

export function listSupportedMutationTools(): string[] {
  return Object.keys(MUTATION_EXECUTORS);
}
