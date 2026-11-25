import { z } from 'zod';
import type { ProviderToolDeclaration } from '@/features/ai-agent/services/agent-tool-provider-client';

export const upsertCategoryToolSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
  defaultNature: z.enum(['STATIC', 'VARIABLE']).default('VARIABLE'),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().trim().min(1).max(40).optional(),
});

export const categorizeTransactionsToolSchema = z.object({
  categoryName: z.string().trim().min(1).max(60),
  categoryType: z.enum(['INCOME', 'EXPENSE']).default('EXPENSE'),
  descriptionContains: z.string().trim().min(1).max(120).optional(),
  transactionIds: z.array(z.string().min(1)).max(100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  onlyUncategorized: z.boolean().default(true),
  rememberForFuture: z.boolean().default(true),
});

export const CATEGORY_AND_CLASSIFICATION_TOOL_DECLARATIONS: ProviderToolDeclaration[] = [
  {
    name: 'upsert_category',
    description:
      'Cria ou atualiza uma Categoria de Gasto (EXPENSE) ou Ganho (INCOME) com natureza padrão (VARIABLE ou STATIC), ícone e cor. Pode ser chamada várias vezes no mesmo turno para cadastrar múltiplas categorias em lote.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome da categoria (ex.: Alimentação & Delivery, Educação, Salário)' },
        type: { type: 'string', enum: ['EXPENSE', 'INCOME'], description: 'EXPENSE para gastos/despesas, INCOME para ganhos/receitas' },
        defaultNature: { type: 'string', enum: ['VARIABLE', 'STATIC'], description: 'VARIABLE para gastos variáveis ou STATIC para fixos/estáticos' },
        color: { type: 'string', description: 'Cor hexadecimal opcional (ex.: #f43f5e)' },
        icon: { type: 'string', description: 'Nome opcional do ícone (ex.: Utensils, GraduationCap, Wallet)' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'categorize_transactions',
    description:
      'Associa uma categoria a lançamentos do extrato filtrados por texto na descrição (`descriptionContains`), por `transactionIds` e/ou por mês (ciclo mensal do usuário). Se a categoria não existir, ela é criada (o cartão de confirmação avisa). Só aplica a lançamentos do mesmo tipo da categoria (despesa ↔ EXPENSE, receita ↔ INCOME); transferências nunca são categorizadas. Pode ser chamada várias vezes no mesmo turno para classificar em lote.',
    parameters: {
      type: 'object',
      properties: {
        categoryName: { type: 'string', description: 'Nome da categoria a aplicar nos lançamentos correspondentes' },
        categoryType: { type: 'string', enum: ['EXPENSE', 'INCOME'] },
        descriptionContains: { type: 'string', description: 'Trecho da descrição dos lançamentos a classificar (ex.: iFood, Uninter, Copasa)' },
        transactionIds: { type: 'array', items: { type: 'string' }, description: 'Lista opcional de IDs exatos de lançamentos' },
        month: { type: 'integer', description: 'Mês opcional (1-12) para restringir a busca' },
        year: { type: 'integer', description: 'Ano opcional (ex.: 2026)' },
        onlyUncategorized: { type: 'boolean', description: 'Se true (padrão), altera apenas lançamentos ainda sem categoria' },
        rememberForFuture: { type: 'boolean', description: 'Se true (padrão), memoriza a classificação para que futuras importações de extrato com descrição semelhante já venham nesta categoria.' },
      },
      required: ['categoryName'],
    },
  },
];
