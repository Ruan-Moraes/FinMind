import { z } from 'zod';
import {
  isoDateString,
  nullableString,
  snapshotAccountSchema,
  snapshotCategorySchema,
  snapshotCreditCardSchema,
  snapshotInvoiceSchema,
  snapshotRecurrenceRuleSchema,
  snapshotTransactionSchema,
} from '@/features/dashboard/domain/snapshot-entity-schemas';

export const FINMIND_SNAPSHOT_FORMAT = 'finmind-snapshot' as const;
export const FINMIND_SNAPSHOT_VERSION = 1 as const;

const snapshotSettingsSchema = z
  .object({
    theme: z.string().optional().default('DARK'),
    density: z.string().optional().default('COMFORTABLE'),
    hideValuesByDefault: z.boolean().optional().default(false),
    fiscalMonthStartDay: z.number().int().min(1).max(31).optional().default(1),
    defaultAccountId: nullableString,
    holidayState: nullableString,
    holidayCity: nullableString,
    aiProvider: z.string().optional().default('OPENAI'),
    aiConnectionMode: z.string().optional().default('SUBSCRIPTION'),
    openaiModel: z.string().optional().default('gpt-4o-mini'),
    geminiModel: z.string().optional().default('gemini-2.0-flash'),
    claudeModel: z.string().optional().default('claude-3-5-sonnet-latest'),
  })
  .nullable()
  .optional()
  .default(null);

export const finMindSnapshotSchema = z.object({
  format: z.literal(FINMIND_SNAPSHOT_FORMAT),
  version: z.literal(FINMIND_SNAPSHOT_VERSION),
  exportedAt: isoDateString,
  data: z.object({
    settings: snapshotSettingsSchema,
    accounts: z.array(snapshotAccountSchema).default([]),
    creditCards: z.array(snapshotCreditCardSchema).default([]),
    creditCardInvoices: z.array(snapshotInvoiceSchema).default([]),
    categories: z.array(snapshotCategorySchema).default([]),
    installmentGroups: z
      .array(
        z.object({
          id: z.string(),
          description: z.string(),
          totalAmountInCents: z.number().int(),
          totalInstallments: z.number().int(),
          createdAt: isoDateString.optional(),
        })
      )
      .default([]),
    recurrenceRules: z.array(snapshotRecurrenceRuleSchema).default([]),
    statementImportBatches: z
      .array(
        z.object({
          id: z.string(),
          status: z.string().default('COMMITTED'),
          fileCount: z.number().int().default(1),
          totalMovements: z.number().int().default(0),
          reconciledCount: z.number().int().default(0),
          createdTransactionsCount: z.number().int().default(0),
          skippedDuplicatesCount: z.number().int().default(0),
          aiProvider: z.string().default('OPENAI'),
          aiModelId: z.string().default('gpt-4o-mini'),
          summaryJson: z.string().default('{}'),
          createdAt: isoDateString.optional(),
          revertedAt: nullableString,
        })
      )
      .default([]),
    statementImportFiles: z
      .array(
        z.object({
          id: z.string(),
          batchId: z.string(),
          fileName: z.string(),
          fileFormat: z.string().default('CSV'),
          bankName: z.string().default('Instituição Financeira'),
          periodStart: nullableString,
          periodEnd: nullableString,
          fileHash: z.string().default(''),
          itemCount: z.number().int().default(0),
          status: z.string().default('PROCESSED'),
          createdAt: isoDateString.optional(),
        })
      )
      .default([]),
    transactions: z.array(snapshotTransactionSchema).default([]),
    attachments: z
      .array(
        z.object({
          id: z.string(),
          transactionId: z.string(),
          fileName: z.string(),
          mimeType: z.string(),
          sizeInBytes: z.number().int(),
          fileDataUrl: z.string(),
          createdAt: isoDateString.optional(),
        })
      )
      .default([]),
    budgets: z
      .array(
        z.object({
          id: z.string(),
          categoryId: z.string(),
          month: z.number().int(),
          year: z.number().int(),
          maxAmountInCents: z.number().int(),
          createdAt: isoDateString.optional(),
        })
      )
      .default([]),
    portfolioGoals: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          targetAmountInCents: z.number().int(),
          targetMonth: z.number().int(),
          targetYear: z.number().int(),
          status: z.string().default('IN_PROGRESS'),
          notes: nullableString,
          createdAt: isoDateString.optional(),
        })
      )
      .default([]),
    reconciliationMemoryRules: z
      .array(
        z.object({
          id: z.string(),
          normalizedPattern: z.string(),
          merchantKeyword: z.string().default(''),
          financialAction: z.string().default(''),
          purpose: z.string().default(''),
          targetType: z.string().default('EXPENSE'),
          nature: z.string().default('VARIABLE'),
          categoryId: nullableString,
          recurrenceRuleId: nullableString,
          confirmCount: z.number().int().default(1),
          lastConfirmedAt: isoDateString.optional(),
          createdAt: isoDateString.optional(),
        })
      )
      .default([]),
    aiReports: z
      .array(
        z.object({
          id: z.string(),
          provider: z.string(),
          connectionMode: z.string(),
          healthScore: z.number().int().default(80),
          summary: z.string(),
          strengthsJson: z.string().default('[]'),
          risksJson: z.string().default('[]'),
          actionPlanJson: z.string().default('[]'),
          createdAt: isoDateString.optional(),
        })
      )
      .default([]),
    valueForecastItems: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          type: z.string(),
          amountInCents: z.number().int(),
          expectedDate: isoDateString,
          notes: nullableString,
          createdAt: isoDateString.optional(),
        })
      )
      .default([]),
    balanceTargetChecks: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          plannedBalanceInCents: z.number().int(),
          targetDate: isoDateString,
          notes: nullableString,
          createdAt: isoDateString.optional(),
        })
      )
      .default([]),
    holidays: z
      .array(
        z.object({
          id: z.string(),
          date: z.string(),
          year: z.number().int(),
          name: z.string(),
          scope: z.string().default('NATIONAL'),
          stateCode: nullableString,
          cityName: nullableString,
          source: z.string().default('BRASIL_API'),
          isActive: z.boolean().default(true),
          createdAt: isoDateString.optional(),
        })
      )
      .default([]),
  }),
});

export type FinMindSnapshot = z.infer<typeof finMindSnapshotSchema>;
