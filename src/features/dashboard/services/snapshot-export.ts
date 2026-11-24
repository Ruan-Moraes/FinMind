import { prisma } from '@/shared/lib/prisma';
import {
  FINMIND_SNAPSHOT_FORMAT,
  FINMIND_SNAPSHOT_VERSION,
  type FinMindSnapshot,
} from '@/features/dashboard/domain/snapshot-schema';

const iso = (d: Date) => d.toISOString();
const optIso = (d: Date | null) => (d ? d.toISOString() : null);

export async function exportUserSnapshot(userId: string): Promise<{
  snapshot: FinMindSnapshot;
  json: string;
  filename: string;
}> {
  const [
    settings, accounts, creditCards, creditCardInvoices, categories, subcategories,
    installmentGroups, recurrenceRules, statementImportBatches, statementImportFiles,
    transactions, attachments, budgets, portfolioGoals, reconciliationMemoryRules,
    aiReports, valueForecastItems, balanceTargetChecks, holidays,
  ] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.creditCardInvoice.findMany({ where: { creditCard: { userId } }, orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
    prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.subcategory.findMany({ where: { category: { userId } } }),
    prisma.installmentGroup.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.recurrenceRule.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.statementImportBatch.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.statementImportFile.findMany({ where: { batch: { userId } }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.attachment.findMany({ where: { transaction: { userId } }, orderBy: { createdAt: 'asc' } }),
    prisma.budget.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.portfolioGoal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.reconciliationMemoryRule.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.aiAnalysisReport.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.valueForecastItem.findMany({ where: { userId }, orderBy: { expectedDate: 'asc' } }),
    prisma.balanceTargetCheck.findMany({ where: { userId }, orderBy: { targetDate: 'asc' } }),
    prisma.holiday.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
  ]);

  const exportedAt = new Date().toISOString();
  const snapshot: FinMindSnapshot = {
    format: FINMIND_SNAPSHOT_FORMAT,
    version: FINMIND_SNAPSHOT_VERSION,
    exportedAt,
    data: {
      settings: settings
        ? {
            theme: settings.theme, density: settings.density,
            hideValuesByDefault: settings.hideValuesByDefault,
            fiscalMonthStartDay: settings.fiscalMonthStartDay,
            defaultAccountId: settings.defaultAccountId,
            holidayState: settings.holidayState,
            holidayCity: settings.holidayCity,
            aiProvider: settings.aiProvider, aiConnectionMode: settings.aiConnectionMode,
            openaiModel: settings.openaiModel, geminiModel: settings.geminiModel,
            claudeModel: settings.claudeModel,
          }
        : null,
      accounts: accounts.map((a) => ({
        id: a.id, name: a.name, type: a.type, initialBalanceInCents: a.initialBalanceInCents,
        color: a.color, isArchived: a.isArchived, createdAt: iso(a.createdAt),
      })),
      creditCards: creditCards.map((c) => ({
        id: c.id, name: c.name, brand: c.brand, limitInCents: c.limitInCents,
        closingDay: c.closingDay, dueDay: c.dueDay, color: c.color, createdAt: iso(c.createdAt),
      })),
      creditCardInvoices: creditCardInvoices.map((i) => ({
        id: i.id, creditCardId: i.creditCardId, month: i.month, year: i.year,
        status: i.status, paidAmountInCents: i.paidAmountInCents,
        paidAt: optIso(i.paidAt), createdAt: iso(i.createdAt),
      })),
      categories: categories.map((c) => ({
        id: c.id, name: c.name, type: c.type, defaultNature: c.defaultNature,
        color: c.color, icon: c.icon, createdAt: iso(c.createdAt),
      })),
      subcategories: subcategories.map((s) => ({ id: s.id, categoryId: s.categoryId, name: s.name })),
      installmentGroups: installmentGroups.map((g) => ({
        id: g.id, description: g.description, totalAmountInCents: g.totalAmountInCents,
        totalInstallments: g.totalInstallments, createdAt: iso(g.createdAt),
      })),
      recurrenceRules: recurrenceRules.map((r) => ({
        id: r.id, description: r.description, type: r.type, nature: r.nature,
        amountInCents: r.amountInCents, frequency: r.frequency, dayOfMonth: r.dayOfMonth,
        dayType: r.dayType, includeSaturday: r.includeSaturday,
        skippedMonths: r.skippedMonths, monthlyOverrides: r.monthlyOverrides,
        isActive: r.isActive, categoryId: r.categoryId, accountId: r.accountId,
        creditCardId: r.creditCardId, createdAt: iso(r.createdAt),
      })),
      statementImportBatches: statementImportBatches.map((b) => ({
        id: b.id, status: b.status, fileCount: b.fileCount, totalMovements: b.totalMovements,
        reconciledCount: b.reconciledCount, createdTransactionsCount: b.createdTransactionsCount,
        skippedDuplicatesCount: b.skippedDuplicatesCount, aiProvider: b.aiProvider,
        aiModelId: b.aiModelId, summaryJson: b.summaryJson,
        createdAt: iso(b.createdAt), revertedAt: optIso(b.revertedAt),
      })),
      statementImportFiles: statementImportFiles.map((f) => ({
        id: f.id, batchId: f.batchId, fileName: f.fileName, fileFormat: f.fileFormat,
        bankName: f.bankName, periodStart: optIso(f.periodStart), periodEnd: optIso(f.periodEnd),
        fileHash: f.fileHash, itemCount: f.itemCount, status: f.status, createdAt: iso(f.createdAt),
      })),
      transactions: transactions.map((t) => ({
        id: t.id, type: t.type, nature: t.nature, amountInCents: t.amountInCents,
        date: iso(t.date), description: t.description, status: t.status, tags: t.tags,
        sourceAccountId: t.sourceAccountId, destinationAccountId: t.destinationAccountId,
        creditCardId: t.creditCardId, invoiceId: t.invoiceId, categoryId: t.categoryId,
        subcategoryId: t.subcategoryId, installmentGroupId: t.installmentGroupId,
        recurrenceRuleId: t.recurrenceRuleId, installmentNumber: t.installmentNumber,
        totalInstallments: t.totalInstallments, importBatchId: t.importBatchId,
        importFileId: t.importFileId, externalTransactionHash: t.externalTransactionHash,
        rawBankDescription: t.rawBankDescription, financialAction: t.financialAction,
        counterparty: t.counterparty, paymentMethod: t.paymentMethod, purpose: t.purpose,
        aiConfidenceScore: t.aiConfidenceScore, aiConfidenceLevel: t.aiConfidenceLevel,
        isAiClassified: t.isAiClassified, isUserConfirmed: t.isUserConfirmed,
        createdAt: iso(t.createdAt),
      })),
      attachments: attachments.map((a) => ({
        id: a.id, transactionId: a.transactionId, fileName: a.fileName, mimeType: a.mimeType,
        sizeInBytes: a.sizeInBytes, fileDataUrl: a.fileDataUrl, createdAt: iso(a.createdAt),
      })),
      budgets: budgets.map((b) => ({
        id: b.id, categoryId: b.categoryId, month: b.month, year: b.year,
        maxAmountInCents: b.maxAmountInCents, createdAt: iso(b.createdAt),
      })),
      portfolioGoals: portfolioGoals.map((g) => ({
        id: g.id, title: g.title, targetAmountInCents: g.targetAmountInCents,
        targetMonth: g.targetMonth, targetYear: g.targetYear, status: g.status,
        notes: g.notes, createdAt: iso(g.createdAt),
      })),
      reconciliationMemoryRules: reconciliationMemoryRules.map((m) => ({
        id: m.id, normalizedPattern: m.normalizedPattern, merchantKeyword: m.merchantKeyword,
        financialAction: m.financialAction, purpose: m.purpose, targetType: m.targetType,
        nature: m.nature, categoryId: m.categoryId, recurrenceRuleId: m.recurrenceRuleId,
        confirmCount: m.confirmCount, lastConfirmedAt: iso(m.lastConfirmedAt), createdAt: iso(m.createdAt),
      })),
      aiReports: aiReports.map((r) => ({
        id: r.id, provider: r.provider, connectionMode: r.connectionMode,
        healthScore: r.healthScore, summary: r.summary, strengthsJson: r.strengthsJson,
        risksJson: r.risksJson, actionPlanJson: r.actionPlanJson, createdAt: iso(r.createdAt),
      })),
      valueForecastItems: valueForecastItems.map((i) => ({
        id: i.id, title: i.title, type: i.type, amountInCents: i.amountInCents,
        expectedDate: iso(i.expectedDate), notes: i.notes, createdAt: iso(i.createdAt),
      })),
      balanceTargetChecks: balanceTargetChecks.map((t) => ({
        id: t.id, title: t.title, plannedBalanceInCents: t.plannedBalanceInCents,
        targetDate: iso(t.targetDate), notes: t.notes, createdAt: iso(t.createdAt),
      })),
      holidays: holidays.map((h) => ({
        id: h.id, date: h.date, year: h.year, name: h.name, scope: h.scope,
        stateCode: h.stateCode, cityName: h.cityName, source: h.source,
        isActive: h.isActive, createdAt: iso(h.createdAt),
      })),
    },
  };

  return {
    snapshot,
    json: JSON.stringify(snapshot, null, 2),
    filename: `finmind-snapshot-${exportedAt.slice(0, 10)}.json`,
  };
}
