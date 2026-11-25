import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';
import {
  deletePortfolioGoalExecutor,
  upsertPortfolioGoalExecutor,
} from '@/features/ai-agent/tools/tool-executors-goals';
import { upsertValueForecastExecutor } from '@/features/ai-agent/tools/tool-executors-rules-forecast';
import { updateUserPreferencesExecutor } from '@/features/ai-agent/tools/tool-executors-finance';
import {
  createTransactionExecutor,
  deleteTransactionExecutor,
  updateTransactionExecutor,
} from '@/features/ai-agent/tools/tool-executors-transactions';
import {
  deleteBalanceTargetExecutor,
  deleteBudgetExecutor,
  deleteStaticRuleExecutor,
  deleteValueForecastExecutor,
  setStaticRuleMonthExecutor,
  upsertBalanceTargetExecutor,
  upsertBudgetExecutor,
  upsertStaticRuleExecutor,
} from '@/features/ai-agent/tools/tool-executors-planning';
import {
  payCreditCardInvoiceExecutor,
  upsertAccountExecutor,
  upsertCreditCardExecutor,
} from '@/features/ai-agent/tools/tool-executors-accounts';
import {
  categorizeTransactionsExecutor,
  deleteCategoryExecutor,
  upsertCategoryExecutor,
} from '@/features/ai-agent/tools/tool-executors-categories';
import { createBatchMutationsExecutor } from '@/features/ai-agent/tools/tool-executors-batch';

const SINGLE_MUTATION_EXECUTORS: Record<string, AgentToolExecutor> = {
  upsert_portfolio_goal: upsertPortfolioGoalExecutor,
  delete_portfolio_goal: deletePortfolioGoalExecutor,
  upsert_static_rule: upsertStaticRuleExecutor,
  upsert_value_forecast: upsertValueForecastExecutor,
  create_transaction: createTransactionExecutor,
  update_user_preferences: updateUserPreferencesExecutor,
  upsert_category: upsertCategoryExecutor,
  categorize_transactions: categorizeTransactionsExecutor,
  update_transaction: updateTransactionExecutor,
  delete_transaction: deleteTransactionExecutor,
  delete_static_rule: deleteStaticRuleExecutor,
  set_static_rule_month: setStaticRuleMonthExecutor,
  upsert_budget: upsertBudgetExecutor,
  delete_budget: deleteBudgetExecutor,
  delete_value_forecast: deleteValueForecastExecutor,
  upsert_balance_target: upsertBalanceTargetExecutor,
  upsert_account: upsertAccountExecutor,
  upsert_credit_card: upsertCreditCardExecutor,
  pay_credit_card_invoice: payCreditCardInvoiceExecutor,
  delete_balance_target: deleteBalanceTargetExecutor,
  delete_category: deleteCategoryExecutor,
};

const batchMutationsExecutor = createBatchMutationsExecutor(
  (name) => SINGLE_MUTATION_EXECUTORS[name] || null
);

const MUTATION_EXECUTORS: Record<string, AgentToolExecutor> = {
  ...SINGLE_MUTATION_EXECUTORS,
  batch_mutations: batchMutationsExecutor,
};

export function getMutationToolExecutor(toolName: string): AgentToolExecutor | null {
  return MUTATION_EXECUTORS[toolName] || null;
}

export function listSupportedMutationTools(): string[] {
  return Object.keys(MUTATION_EXECUTORS);
}
