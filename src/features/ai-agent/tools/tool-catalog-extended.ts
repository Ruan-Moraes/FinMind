import { z } from 'zod';
import type { ProviderToolDeclaration } from '@/features/ai-agent/services/agent-tool-provider-client';

const month = z.coerce.number().int().min(1).max(12);
const year = z.coerce.number().int().min(2000).max(2100);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ───────────── Leituras ───────────── */
export const queryBudgetsToolSchema = z.object({ month: month.optional(), year: year.optional() });
export const queryStaticRulesToolSchema = z.object({ month: month.optional(), year: year.optional() });
export const queryInvoicesToolSchema = z.object({ cardName: z.string().optional(), onlyUnpaid: z.boolean().default(false) });
export const queryCategoriesToolSchema = z.object({ type: z.enum(['ALL', 'INCOME', 'EXPENSE']).default('ALL') });

/* ───────────── Escritas ───────────── */
export const upsertBudgetToolSchema = z.object({
  categoryName: z.string().trim().min(1),
  amountBRL: z.coerce.number().positive(),
  month: month.optional(),
  year: year.optional(),
});
export const deleteBudgetToolSchema = z.object({
  categoryName: z.string().trim().min(1),
  month: month.optional(),
  year: year.optional(),
});

const transactionMatchShape = {
  transactionId: z.string().optional(),
  matchDescription: z.string().trim().optional(),
  matchDate: isoDate.optional(),
  matchAmountBRL: z.coerce.number().positive().optional(),
};
export const updateTransactionToolSchema = z.object({
  ...transactionMatchShape,
  description: z.string().trim().min(1).optional(),
  amountBRL: z.coerce.number().positive().optional(),
  date: isoDate.optional(),
  categoryName: z.string().optional(),
  accountName: z.string().optional(),
  status: z.enum(['COMPLETED', 'PENDING']).optional(),
  nature: z.enum(['STATIC', 'VARIABLE']).optional(),
});
export const deleteTransactionToolSchema = z.object({
  ...transactionMatchShape,
  deleteInstallmentSeries: z.boolean().default(false),
});

export const deleteStaticRuleToolSchema = z.object({ matchDescription: z.string().trim().min(1) });
export const setStaticRuleMonthToolSchema = z.object({
  matchDescription: z.string().trim().min(1),
  month,
  year,
  action: z.enum(['SKIP', 'UNSKIP', 'OVERRIDE', 'CLEAR_OVERRIDE']),
  amountBRL: z.coerce.number().positive().optional(),
}).refine((v) => v.action !== 'OVERRIDE' || v.amountBRL !== undefined, {
  message: 'Informe o valor (amountBRL) do ajuste neste mês.', path: ['amountBRL'],
});
export const deleteValueForecastToolSchema = z.object({ matchTitle: z.string().trim().min(1) });
export const upsertBalanceTargetToolSchema = z.object({
  matchTitle: z.string().trim().optional(),
  title: z.string().trim().min(1),
  plannedBalanceBRL: z.coerce.number().positive(),
  targetDate: isoDate,
  notes: z.string().optional(),
});
export const upsertAccountToolSchema = z.object({
  matchName: z.string().trim().optional(),
  name: z.string().trim().min(1),
  type: z.enum(['CHECKING', 'SAVINGS', 'CASH']).default('CHECKING'),
  initialBalanceBRL: z.coerce.number().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export const upsertCreditCardToolSchema = z.object({
  matchName: z.string().trim().optional(),
  name: z.string().trim().min(1),
  brand: z.string().trim().default('Mastercard'),
  limitBRL: z.coerce.number().positive(),
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export const payInvoiceToolSchema = z.object({
  cardName: z.string().trim().min(1),
  month,
  year,
  accountName: z.string().trim().min(1),
});

const MATCH_PROPS = {
  transactionId: { type: 'string', description: 'ID exato do lançamento (obtido via query_expenses_and_transactions).' },
  matchDescription: { type: 'string', description: 'Parte da descrição para localizar o lançamento.' },
  matchDate: { type: 'string', description: 'YYYY-MM-DD para desambiguar.' },
  matchAmountBRL: { type: 'number', description: 'Valor em Reais para desambiguar.' },
};

export const EXTENDED_READ_TOOL_NAMES = new Set([
  'query_budgets',
  'query_static_rules',
  'query_credit_card_invoices',
  'query_categories',
]);

export const EXTENDED_TOOL_DECLARATIONS: ProviderToolDeclaration[] = [
  {
    name: 'query_budgets',
    description: 'Consulta os orçamentos (limites de gasto por categoria) do mês com quanto já foi gasto, saldo restante, % consumido e status (OK, ATENÇÃO ≥70%, CRÍTICO ≥90%, ESTOURADO).',
    parameters: { type: 'object', properties: { month: { type: 'integer' }, year: { type: 'integer' } } },
  },
  {
    name: 'query_static_rules',
    description: 'Lista as regras fixas mensais (custos e ganhos estáticos) com valor efetivo no mês, ajustes pontuais, se está pulada no mês e dia de vencimento.',
    parameters: { type: 'object', properties: { month: { type: 'integer' }, year: { type: 'integer' } } },
  },
  {
    name: 'query_credit_card_invoices',
    description: 'Lista faturas de cartão (mês/ano, status OPEN/CLOSED/PAID, valor, vencimento) e limite usado por cartão.',
    parameters: {
      type: 'object',
      properties: { cardName: { type: 'string' }, onlyUnpaid: { type: 'boolean', description: 'true para somente faturas não pagas.' } },
    },
  },
  {
    name: 'query_categories',
    description: 'Lista as categorias cadastradas (nome, tipo, natureza padrão). Use antes de categorizar ou criar orçamentos.',
    parameters: { type: 'object', properties: { type: { type: 'string', enum: ['ALL', 'INCOME', 'EXPENSE'] } } },
  },
  {
    name: 'upsert_budget',
    description: 'Define ou altera o limite mensal de gasto de uma categoria de despesa (mês e ano atuais se omitidos). Exige confirmação.',
    parameters: {
      type: 'object',
      properties: { categoryName: { type: 'string' }, amountBRL: { type: 'number' }, month: { type: 'integer' }, year: { type: 'integer' } },
      required: ['categoryName', 'amountBRL'],
    },
  },
  {
    name: 'delete_budget',
    description: 'Remove o limite mensal de uma categoria (operação L3, exige confirmação).',
    parameters: {
      type: 'object',
      properties: { categoryName: { type: 'string' }, month: { type: 'integer' }, year: { type: 'integer' } },
      required: ['categoryName'],
    },
  },
  {
    name: 'update_transaction',
    description: 'Edita um lançamento existente (descrição, valor, data, categoria, conta, status, natureza). Localize por transactionId ou por matchDescription (+ matchDate/matchAmountBRL). Se houver mais de um candidato, a operação é recusada listando-os.',
    parameters: {
      type: 'object',
      properties: {
        ...MATCH_PROPS,
        description: { type: 'string' }, amountBRL: { type: 'number' }, date: { type: 'string' },
        categoryName: { type: 'string' }, accountName: { type: 'string' },
        status: { type: 'string', enum: ['COMPLETED', 'PENDING'] }, nature: { type: 'string', enum: ['STATIC', 'VARIABLE'] },
      },
    },
  },
  {
    name: 'delete_transaction',
    description: 'Exclui um lançamento (L3, exige confirmação). Para compra parcelada, deleteInstallmentSeries=true remove todas as parcelas.',
    parameters: { type: 'object', properties: { ...MATCH_PROPS, deleteInstallmentSeries: { type: 'boolean' } } },
  },
  {
    name: 'delete_static_rule',
    description: 'Exclui uma regra fixa mensal (L3). Para apenas não contar em um mês, use set_static_rule_month com SKIP.',
    parameters: { type: 'object', properties: { matchDescription: { type: 'string' } }, required: ['matchDescription'] },
  },
  {
    name: 'set_static_rule_month',
    description: 'Ações pontuais de um mês numa regra fixa: SKIP (pular o mês), UNSKIP (reativar), OVERRIDE (valor diferente só neste mês, exige amountBRL), CLEAR_OVERRIDE (volta ao valor base).',
    parameters: {
      type: 'object',
      properties: {
        matchDescription: { type: 'string' }, month: { type: 'integer' }, year: { type: 'integer' },
        action: { type: 'string', enum: ['SKIP', 'UNSKIP', 'OVERRIDE', 'CLEAR_OVERRIDE'] }, amountBRL: { type: 'number' },
      },
      required: ['matchDescription', 'month', 'year', 'action'],
    },
  },
  {
    name: 'delete_value_forecast',
    description: 'Exclui um item de Previsão de Valor pelo título (L3).',
    parameters: { type: 'object', properties: { matchTitle: { type: 'string' } }, required: ['matchTitle'] },
  },
  {
    name: 'upsert_balance_target',
    description: 'Cria (ou edita via matchTitle) uma Meta de Saldo por Data: quanto o usuário quer ter acumulado em uma data.',
    parameters: {
      type: 'object',
      properties: {
        matchTitle: { type: 'string' }, title: { type: 'string' }, plannedBalanceBRL: { type: 'number' },
        targetDate: { type: 'string', description: 'YYYY-MM-DD' }, notes: { type: 'string' },
      },
      required: ['title', 'plannedBalanceBRL', 'targetDate'],
    },
  },
  {
    name: 'upsert_account',
    description: 'Cria uma conta (CHECKING, SAVINGS ou CASH) ou edita uma existente informando matchName.',
    parameters: {
      type: 'object',
      properties: {
        matchName: { type: 'string' }, name: { type: 'string' }, type: { type: 'string', enum: ['CHECKING', 'SAVINGS', 'CASH'] },
        initialBalanceBRL: { type: 'number' }, color: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'upsert_credit_card',
    description: 'Cria um cartão de crédito ou edita um existente informando matchName. Dias de fechamento e vencimento de 1 a 31.',
    parameters: {
      type: 'object',
      properties: {
        matchName: { type: 'string' }, name: { type: 'string' }, brand: { type: 'string' }, limitBRL: { type: 'number' },
        closingDay: { type: 'integer' }, dueDay: { type: 'integer' }, color: { type: 'string' },
      },
      required: ['name', 'limitBRL', 'closingDay', 'dueDay'],
    },
  },
  {
    name: 'pay_credit_card_invoice',
    description: 'Paga a fatura de um cartão (mês/ano) debitando de uma conta. Gera um lançamento de pagamento e marca a fatura como PAID. Exige confirmação.',
    parameters: {
      type: 'object',
      properties: { cardName: { type: 'string' }, month: { type: 'integer' }, year: { type: 'integer' }, accountName: { type: 'string' } },
      required: ['cardName', 'month', 'year', 'accountName'],
    },
  },
];
