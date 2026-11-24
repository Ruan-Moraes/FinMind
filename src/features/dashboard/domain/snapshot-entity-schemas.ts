import { z } from 'zod';

export const nullableString = z.string().nullable().optional().default(null);
export const isoDateString = z.string().min(4);

export const snapshotAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().default('CHECKING'),
  initialBalanceInCents: z.number().int().default(0),
  color: z.string().default('#10b981'),
  isArchived: z.boolean().default(false),
  createdAt: isoDateString.optional(),
});

export const snapshotCreditCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().default('Mastercard'),
  limitInCents: z.number().int().default(0),
  closingDay: z.number().int().default(25),
  dueDay: z.number().int().default(5),
  color: z.string().default('#6366f1'),
  createdAt: isoDateString.optional(),
});

export const snapshotInvoiceSchema = z.object({
  id: z.string(),
  creditCardId: z.string(),
  month: z.number().int(),
  year: z.number().int(),
  status: z.string().default('OPEN'),
  paidAmountInCents: z.number().int().default(0),
  paidAt: nullableString,
  createdAt: isoDateString.optional(),
});

export const snapshotCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().default('EXPENSE'),
  defaultNature: z.string().default('VARIABLE'),
  color: z.string().default('#6366f1'),
  icon: z.string().default('Tag'),
  createdAt: isoDateString.optional(),
});

export const snapshotRecurrenceRuleSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.string().default('EXPENSE'),
  nature: z.string().default('STATIC'),
  amountInCents: z.number().int(),
  frequency: z.string().default('MONTHLY'),
  dayOfMonth: z.number().int().default(5),
  dayType: z.string().default('CALENDAR_DAY'),
  includeSaturday: z.boolean().default(false),
  skippedMonths: z.string().default('[]'),
  monthlyOverrides: z.string().default('{}'),
  isActive: z.boolean().default(true),
  categoryId: nullableString,
  accountId: nullableString,
  creditCardId: nullableString,
  createdAt: isoDateString.optional(),
});

export const snapshotTransactionSchema = z.object({
  id: z.string(),
  type: z.string(),
  nature: z.string().default('VARIABLE'),
  amountInCents: z.number().int(),
  date: isoDateString,
  description: z.string(),
  status: z.string().default('COMPLETED'),
  tags: z.string().default(''),
  sourceAccountId: nullableString,
  destinationAccountId: nullableString,
  creditCardId: nullableString,
  invoiceId: nullableString,
  categoryId: nullableString,
  installmentGroupId: nullableString,
  recurrenceRuleId: nullableString,
  installmentNumber: z.number().int().nullable().optional().default(null),
  totalInstallments: z.number().int().nullable().optional().default(null),
  importBatchId: nullableString,
  importFileId: nullableString,
  externalTransactionHash: nullableString,
  rawBankDescription: nullableString,
  financialAction: nullableString,
  counterparty: nullableString,
  paymentMethod: nullableString,
  purpose: nullableString,
  aiConfidenceScore: z.number().int().nullable().optional().default(null),
  aiConfidenceLevel: nullableString,
  isAiClassified: z.boolean().default(false),
  isUserConfirmed: z.boolean().default(true),
  createdAt: isoDateString.optional(),
});
