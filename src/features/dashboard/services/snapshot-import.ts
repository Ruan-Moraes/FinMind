import { randomUUID } from 'node:crypto';
import { prisma } from '@/shared/lib/prisma';
import { finMindSnapshotSchema } from '@/features/dashboard/domain/snapshot-schema';
import {
  restoreSecondarySnapshotEntities,
  type SnapshotIdMaps,
} from '@/features/dashboard/services/snapshot-import-secondary';

export interface SnapshotRestoreCounts {
  accounts: number;
  creditCards: number;
  categories: number;
  transactions: number;
  budgets: number;
  portfolioGoals: number;
  recurrenceRules: number;
  valueForecastItems: number;
  balanceTargetChecks: number;
}

const toDate = (iso?: string | null) => (iso ? new Date(iso) : new Date());
const toOptDate = (iso?: string | null) => (iso ? new Date(iso) : null);
const mapRef = (map: Map<string, string>, id?: string | null) => (id ? map.get(id) ?? null : null);

function buildIdMap<T extends { id: string }>(items: T[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    map.set(item.id, `snap_${randomUUID().replace(/-/g, '')}`);
  }
  return map;
}

export async function importUserSnapshot(
  userId: string,
  rawPayload: unknown
): Promise<{ ok: true; counts: SnapshotRestoreCounts } | { ok: false; error: string }> {
  const parsed = finMindSnapshotSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Arquivo de snapshot inválido ou incompatível. Exporte um snapshot válido pelo FinMind.',
    };
  }

  const d = parsed.data.data;
  const maps: SnapshotIdMaps = {
    accMap: buildIdMap(d.accounts),
    cardMap: buildIdMap(d.creditCards),
    invMap: buildIdMap(d.creditCardInvoices),
    catMap: buildIdMap(d.categories),
    subMap: buildIdMap(d.subcategories),
    instMap: buildIdMap(d.installmentGroups),
    ruleMap: buildIdMap(d.recurrenceRules),
    batchMap: buildIdMap(d.statementImportBatches),
    fileMap: buildIdMap(d.statementImportFiles),
    txMap: buildIdMap(d.transactions),
  };

  await prisma.$transaction(async (tx) => {
    await tx.financialKnowledgeChunk.deleteMany({ where: { userId } });
    await tx.attachment.deleteMany({ where: { transaction: { userId } } });
    await tx.transaction.deleteMany({ where: { userId } });
    await tx.statementImportFile.deleteMany({ where: { batch: { userId } } });
    await tx.statementImportBatch.deleteMany({ where: { userId } });
    await tx.reconciliationMemoryRule.deleteMany({ where: { userId } });
    await tx.installmentGroup.deleteMany({ where: { userId } });
    await tx.creditCardInvoice.deleteMany({ where: { creditCard: { userId } } });
    await tx.creditCard.deleteMany({ where: { userId } });
    await tx.budget.deleteMany({ where: { userId } });
    await tx.portfolioGoal.deleteMany({ where: { userId } });
    await tx.valueForecastItem.deleteMany({ where: { userId } });
    await tx.balanceTargetCheck.deleteMany({ where: { userId } });
    await tx.holiday.deleteMany({ where: { userId } });
    await tx.recurrenceRule.deleteMany({ where: { userId } });
    await tx.aiAnalysisReport.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.subcategory.deleteMany({ where: { category: { userId } } });
    await tx.category.deleteMany({ where: { userId } });

    if (d.accounts.length > 0) {
      await tx.account.createMany({
        data: d.accounts.map((a) => ({
          id: maps.accMap.get(a.id)!, userId, name: a.name, type: a.type,
          initialBalanceInCents: a.initialBalanceInCents, color: a.color,
          isArchived: a.isArchived, createdAt: toDate(a.createdAt),
        })),
      });
    }

    if (d.creditCards.length > 0) {
      await tx.creditCard.createMany({
        data: d.creditCards.map((c) => ({
          id: maps.cardMap.get(c.id)!, userId, name: c.name, brand: c.brand,
          limitInCents: c.limitInCents, closingDay: c.closingDay, dueDay: c.dueDay,
          color: c.color, createdAt: toDate(c.createdAt),
        })),
      });
    }

    const validInvoices = d.creditCardInvoices.filter((i) => maps.cardMap.has(i.creditCardId));
    if (validInvoices.length > 0) {
      await tx.creditCardInvoice.createMany({
        data: validInvoices.map((i) => ({
          id: maps.invMap.get(i.id)!, creditCardId: maps.cardMap.get(i.creditCardId)!,
          month: i.month, year: i.year, status: i.status,
          paidAmountInCents: i.paidAmountInCents, paidAt: toOptDate(i.paidAt),
          createdAt: toDate(i.createdAt),
        })),
      });
    }

    if (d.categories.length > 0) {
      await tx.category.createMany({
        data: d.categories.map((c) => ({
          id: maps.catMap.get(c.id)!, userId, name: c.name, type: c.type,
          defaultNature: c.defaultNature, color: c.color, icon: c.icon,
          createdAt: toDate(c.createdAt),
        })),
      });
    }

    const validSubcats = d.subcategories.filter((s) => maps.catMap.has(s.categoryId));
    if (validSubcats.length > 0) {
      await tx.subcategory.createMany({
        data: validSubcats.map((s) => ({
          id: maps.subMap.get(s.id)!, categoryId: maps.catMap.get(s.categoryId)!, name: s.name,
        })),
      });
    }

    if (d.installmentGroups.length > 0) {
      await tx.installmentGroup.createMany({
        data: d.installmentGroups.map((g) => ({
          id: maps.instMap.get(g.id)!, userId, description: g.description,
          totalAmountInCents: g.totalAmountInCents, totalInstallments: g.totalInstallments,
          createdAt: toDate(g.createdAt),
        })),
      });
    }

    if (d.recurrenceRules.length > 0) {
      await tx.recurrenceRule.createMany({
        data: d.recurrenceRules.map((r) => ({
          id: maps.ruleMap.get(r.id)!, userId, description: r.description,
          type: r.type, nature: r.nature, amountInCents: r.amountInCents,
          frequency: r.frequency, dayOfMonth: r.dayOfMonth,
          dayType: r.dayType, includeSaturday: r.includeSaturday, isActive: r.isActive,
          categoryId: mapRef(maps.catMap, r.categoryId),
          accountId: mapRef(maps.accMap, r.accountId),
          creditCardId: mapRef(maps.cardMap, r.creditCardId),
          createdAt: toDate(r.createdAt),
        })),
      });
    }

    if (d.statementImportBatches.length > 0) {
      await tx.statementImportBatch.createMany({
        data: d.statementImportBatches.map((b) => ({
          id: maps.batchMap.get(b.id)!, userId, status: b.status, fileCount: b.fileCount,
          totalMovements: b.totalMovements, reconciledCount: b.reconciledCount,
          createdTransactionsCount: b.createdTransactionsCount,
          skippedDuplicatesCount: b.skippedDuplicatesCount, aiProvider: b.aiProvider,
          aiModelId: b.aiModelId, summaryJson: b.summaryJson,
          createdAt: toDate(b.createdAt), revertedAt: toOptDate(b.revertedAt),
        })),
      });
    }

    const validFiles = d.statementImportFiles.filter((f) => maps.batchMap.has(f.batchId));
    if (validFiles.length > 0) {
      await tx.statementImportFile.createMany({
        data: validFiles.map((f) => ({
          id: maps.fileMap.get(f.id)!, batchId: maps.batchMap.get(f.batchId)!,
          fileName: f.fileName, fileFormat: f.fileFormat, bankName: f.bankName,
          periodStart: toOptDate(f.periodStart), periodEnd: toOptDate(f.periodEnd),
          fileHash: f.fileHash, itemCount: f.itemCount, status: f.status,
          createdAt: toDate(f.createdAt),
        })),
      });
    }

    await restoreSecondarySnapshotEntities(tx, userId, d, maps);
  });

  return {
    ok: true,
    counts: {
      accounts: d.accounts.length,
      creditCards: d.creditCards.length,
      categories: d.categories.length,
      transactions: d.transactions.length,
      budgets: d.budgets.filter((b) => maps.catMap.has(b.categoryId)).length,
      portfolioGoals: d.portfolioGoals.length,
      recurrenceRules: d.recurrenceRules.length,
      valueForecastItems: d.valueForecastItems.length,
      balanceTargetChecks: d.balanceTargetChecks.length,
    },
  };
}
