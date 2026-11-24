import { z } from 'zod';

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? Record<string, never> : { data: T }))
  | { ok: false; error: string };

export const transactionAttachmentSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeInBytes: z.number().int().nonnegative(),
  fileDataUrl: z.string().min(1),
});

export const createTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  nature: z.enum(['STATIC', 'VARIABLE']),
  amountRaw: z.string().min(1, 'Informe um valor maior que R$ 0,00.'),
  date: z.string(),
  description: z.string().trim().min(1, 'Informe uma descrição para o lançamento.'),
  status: z.enum(['COMPLETED', 'PENDING']),
  paymentTarget: z.enum(['ACCOUNT', 'CREDIT_CARD']),
  sourceAccountId: z.string().optional(),
  destinationAccountId: z.string().optional(),
  creditCardId: z.string().optional(),
  categoryId: z.string().optional(),
  installments: z.number().int().min(1).max(48).optional(),
  tags: z.string().optional(),
  attachment: transactionAttachmentSchema.nullable().optional(),
});

export const updateTransactionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  nature: z.enum(['STATIC', 'VARIABLE']),
  amountRaw: z.string().min(1, 'Informe um valor maior que R$ 0,00.'),
  date: z.string(),
  description: z.string().trim().min(1, 'Informe uma descrição para o lançamento.'),
  status: z.enum(['COMPLETED', 'PENDING']),
  paymentTarget: z.enum(['ACCOUNT', 'CREDIT_CARD']),
  sourceAccountId: z.string().optional(),
  destinationAccountId: z.string().optional(),
  creditCardId: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.string().optional(),
});

export const portfolioGoalSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'Informe um título e valor alvo maior que zero.'),
  targetAmountRaw: z.string().min(1),
  targetMonth: z.coerce.number().int().min(1).max(12),
  targetYear: z.coerce.number().int().min(2000).max(2100),
  notes: z.string().optional(),
});

export const budgetSchema = z.object({
  categoryId: z.string().min(1, 'Selecione uma categoria e um limite maior que zero.'),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  maxAmountRaw: z.string().min(1),
});

export const recurrenceRuleSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1, 'Preencha a descrição e o valor corretamente.'),
  type: z.enum(['INCOME', 'EXPENSE']),
  nature: z.enum(['STATIC', 'VARIABLE']),
  amountRaw: z.string().min(1),
  dayOfMonth: z.coerce.number().int().min(1).max(31).default(5),
  dayType: z.enum(['CALENDAR_DAY', 'BUSINESS_DAY']).default('CALENDAR_DAY'),
  includeSaturday: z.boolean().default(false),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
});

export const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Informe o nome da categoria.'),
  type: z.enum(['INCOME', 'EXPENSE']),
  defaultNature: z.enum(['STATIC', 'VARIABLE']),
  color: z.string().default('#6366f1'),
  icon: z.string().optional(),
});

export const userSettingsSchema = z.object({
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  density: z.enum(['COMFORTABLE', 'COMPACT']).optional(),
  hideValuesByDefault: z.boolean().optional(),
  fiscalMonthStartDay: z.coerce.number().int().min(1).max(31).optional(),
  defaultAccountId: z.string().nullable().optional(),
  holidayState: z.string().trim().max(2).nullable().optional(),
  holidayCity: z.string().trim().max(120).nullable().optional(),
});

export function extractFirstZodError(error: z.ZodError): string {
  return error.issues[0]?.message || 'Dados inválidos informados.';
}
