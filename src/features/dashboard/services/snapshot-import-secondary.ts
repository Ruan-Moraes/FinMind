import type { Prisma } from '@prisma/client';
import type { FinMindSnapshot } from '@/features/dashboard/domain/snapshot-schema';

export interface SnapshotIdMaps {
  accMap: Map<string, string>;
  cardMap: Map<string, string>;
  invMap: Map<string, string>;
  catMap: Map<string, string>;
  subMap: Map<string, string>;
  instMap: Map<string, string>;
  ruleMap: Map<string, string>;
  batchMap: Map<string, string>;
  fileMap: Map<string, string>;
  txMap: Map<string, string>;
}

const toDate = (iso?: string | null) => (iso ? new Date(iso) : new Date());
const mapRef = (map: Map<string, string>, id?: string | null) => (id ? map.get(id) ?? null : null);

export async function restoreSecondarySnapshotEntities(
  tx: Prisma.TransactionClient,
  userId: string,
  d: FinMindSnapshot['data'],
  maps: SnapshotIdMaps
): Promise<void> {
  const { accMap, cardMap, invMap, catMap, subMap, instMap, ruleMap, batchMap, fileMap, txMap } = maps;

  if (d.transactions.length > 0) {
    await tx.transaction.createMany({
      data: d.transactions.map((t) => ({
        id: txMap.get(t.id)!, userId, type: t.type, nature: t.nature,
        amountInCents: t.amountInCents, date: toDate(t.date), description: t.description,
        status: t.status, tags: t.tags,
        sourceAccountId: mapRef(accMap, t.sourceAccountId),
        destinationAccountId: mapRef(accMap, t.destinationAccountId),
        creditCardId: mapRef(cardMap, t.creditCardId),
        invoiceId: mapRef(invMap, t.invoiceId),
        categoryId: mapRef(catMap, t.categoryId),
        subcategoryId: mapRef(subMap, t.subcategoryId),
        installmentGroupId: mapRef(instMap, t.installmentGroupId),
        recurrenceRuleId: mapRef(ruleMap, t.recurrenceRuleId),
        installmentNumber: t.installmentNumber, totalInstallments: t.totalInstallments,
        importBatchId: mapRef(batchMap, t.importBatchId),
        importFileId: mapRef(fileMap, t.importFileId),
        externalTransactionHash: t.externalTransactionHash, rawBankDescription: t.rawBankDescription,
        financialAction: t.financialAction, counterparty: t.counterparty,
        paymentMethod: t.paymentMethod, purpose: t.purpose,
        aiConfidenceScore: t.aiConfidenceScore, aiConfidenceLevel: t.aiConfidenceLevel,
        isAiClassified: t.isAiClassified, isUserConfirmed: t.isUserConfirmed,
        createdAt: toDate(t.createdAt),
      })),
    });
  }

  const validAttachments = d.attachments.filter((a) => txMap.has(a.transactionId));
  if (validAttachments.length > 0) {
    await tx.attachment.createMany({
      data: validAttachments.map((a) => ({
        transactionId: txMap.get(a.transactionId)!, fileName: a.fileName,
        mimeType: a.mimeType, sizeInBytes: a.sizeInBytes,
        fileDataUrl: a.fileDataUrl, createdAt: toDate(a.createdAt),
      })),
    });
  }

  const validBudgets = d.budgets.filter((b) => catMap.has(b.categoryId));
  if (validBudgets.length > 0) {
    await tx.budget.createMany({
      data: validBudgets.map((b) => ({
        userId, categoryId: catMap.get(b.categoryId)!, month: b.month,
        year: b.year, maxAmountInCents: b.maxAmountInCents, createdAt: toDate(b.createdAt),
      })),
    });
  }

  if (d.portfolioGoals.length > 0) {
    await tx.portfolioGoal.createMany({
      data: d.portfolioGoals.map((g) => ({
        userId, title: g.title, targetAmountInCents: g.targetAmountInCents,
        targetMonth: g.targetMonth, targetYear: g.targetYear,
        status: g.status, notes: g.notes, createdAt: toDate(g.createdAt),
      })),
    });
  }

  if (d.reconciliationMemoryRules.length > 0) {
    await tx.reconciliationMemoryRule.createMany({
      data: d.reconciliationMemoryRules.map((m) => ({
        userId, normalizedPattern: m.normalizedPattern, merchantKeyword: m.merchantKeyword,
        financialAction: m.financialAction, purpose: m.purpose, targetType: m.targetType,
        nature: m.nature, categoryId: mapRef(catMap, m.categoryId),
        recurrenceRuleId: mapRef(ruleMap, m.recurrenceRuleId),
        confirmCount: m.confirmCount, lastConfirmedAt: toDate(m.lastConfirmedAt),
        createdAt: toDate(m.createdAt),
      })),
    });
  }

  if (d.aiReports.length > 0) {
    await tx.aiAnalysisReport.createMany({
      data: d.aiReports.map((r) => ({
        userId, provider: r.provider, connectionMode: r.connectionMode,
        healthScore: r.healthScore, summary: r.summary, strengthsJson: r.strengthsJson,
        risksJson: r.risksJson, actionPlanJson: r.actionPlanJson, createdAt: toDate(r.createdAt),
      })),
    });
  }

  if (d.valueForecastItems.length > 0) {
    await tx.valueForecastItem.createMany({
      data: d.valueForecastItems.map((i) => ({
        userId, title: i.title, type: i.type, amountInCents: i.amountInCents,
        expectedDate: toDate(i.expectedDate), notes: i.notes, createdAt: toDate(i.createdAt),
      })),
    });
  }

  if (d.balanceTargetChecks.length > 0) {
    await tx.balanceTargetCheck.createMany({
      data: d.balanceTargetChecks.map((t) => ({
        userId, title: t.title, plannedBalanceInCents: t.plannedBalanceInCents,
        targetDate: toDate(t.targetDate), notes: t.notes, createdAt: toDate(t.createdAt),
      })),
    });
  }

  if (d.holidays.length > 0) {
    await tx.holiday.createMany({
      data: d.holidays.map((h) => ({
        userId, date: h.date, year: h.year, name: h.name, scope: h.scope,
        stateCode: h.stateCode, cityName: h.cityName, source: h.source,
        isActive: h.isActive, createdAt: toDate(h.createdAt),
      })),
    });
  }

  if (d.settings) {
    const settingsFields = {
      theme: d.settings.theme, density: d.settings.density,
      hideValuesByDefault: d.settings.hideValuesByDefault,
      fiscalMonthStartDay: d.settings.fiscalMonthStartDay,
      defaultAccountId: mapRef(accMap, d.settings.defaultAccountId),
      holidayState: d.settings.holidayState,
      holidayCity: d.settings.holidayCity,
      aiProvider: d.settings.aiProvider, aiConnectionMode: d.settings.aiConnectionMode,
      openaiModel: d.settings.openaiModel, geminiModel: d.settings.geminiModel,
      claudeModel: d.settings.claudeModel,
    };
    await tx.userSettings.upsert({
      where: { userId },
      create: { userId, ...settingsFields },
      update: settingsFields,
    });
  } else {
    await tx.userSettings.updateMany({
      where: { userId },
      data: { defaultAccountId: null },
    });
  }
}
