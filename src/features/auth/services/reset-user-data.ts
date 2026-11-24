import { prisma } from '@/shared/lib/prisma';
import { DEFAULT_CATEGORIES } from '@/features/planning/domain/default-categories';

export type ResetDataScope = 'VALUES_ONLY' | 'ALL';

function normalizePersonName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Executa a limpeza transacional dos dados financeiros após validar identidade contra `user.name`.
 * - `VALUES_ONLY`: apaga lançamentos, extratos importados, parcelas, faturas e zera saldos das contas,
 *   preservando categorias, metas de carteira, orçamentos, regras fixas, contas e cartões.
 * - `ALL`: apaga todos os dados financeiros e recria as categorias padrão de forma atômica.
 */
export async function resetAllFinancialDataForUser(
  user: { id: string; name: string },
  fullNameConfirmation: string,
  scope: ResetDataScope = 'ALL'
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalizedInput = normalizePersonName(fullNameConfirmation);
  const normalizedUserName = normalizePersonName(user.name);

  if (!normalizedInput || normalizedInput !== normalizedUserName) {
    return {
      ok: false,
      error: `Confirmação inválida. Digite exatamente: ${user.name}`,
    };
  }

  if (scope === 'VALUES_ONLY') {
    await prisma.$transaction([
      prisma.financialKnowledgeChunk.deleteMany({ where: { userId: user.id } }),
      prisma.agentActionAuditLog.deleteMany({ where: { userId: user.id } }),
      prisma.attachment.deleteMany({ where: { transaction: { userId: user.id } } }),
      prisma.transaction.deleteMany({ where: { userId: user.id } }),
      prisma.statementImportFile.deleteMany({ where: { batch: { userId: user.id } } }),
      prisma.statementImportBatch.deleteMany({ where: { userId: user.id } }),
      prisma.installmentGroup.deleteMany({ where: { userId: user.id } }),
      prisma.creditCardInvoice.deleteMany({ where: { creditCard: { userId: user.id } } }),
      prisma.aiAnalysisReport.deleteMany({ where: { userId: user.id } }),
      prisma.aiChatMessage.deleteMany({ where: { session: { userId: user.id } } }),
      prisma.aiChatSession.deleteMany({ where: { userId: user.id } }),
      prisma.account.updateMany({
        where: { userId: user.id },
        data: { initialBalanceInCents: 0 },
      }),
    ]);

    return { ok: true };
  }

  await prisma.$transaction([
    prisma.financialKnowledgeChunk.deleteMany({ where: { userId: user.id } }),
    prisma.agentActionAuditLog.deleteMany({ where: { userId: user.id } }),
    prisma.attachment.deleteMany({ where: { transaction: { userId: user.id } } }),
    prisma.transaction.deleteMany({ where: { userId: user.id } }),
    prisma.statementImportFile.deleteMany({ where: { batch: { userId: user.id } } }),
    prisma.statementImportBatch.deleteMany({ where: { userId: user.id } }),
    prisma.reconciliationMemoryRule.deleteMany({ where: { userId: user.id } }),
    prisma.installmentGroup.deleteMany({ where: { userId: user.id } }),
    prisma.creditCardInvoice.deleteMany({ where: { creditCard: { userId: user.id } } }),
    prisma.creditCard.deleteMany({ where: { userId: user.id } }),
    prisma.budget.deleteMany({ where: { userId: user.id } }),
    prisma.portfolioGoal.deleteMany({ where: { userId: user.id } }),
    prisma.valueForecastItem.deleteMany({ where: { userId: user.id } }),
    prisma.balanceTargetCheck.deleteMany({ where: { userId: user.id } }),
    prisma.holiday.deleteMany({ where: { userId: user.id } }),
    prisma.recurrenceRule.deleteMany({ where: { userId: user.id } }),
    prisma.aiAnalysisReport.deleteMany({ where: { userId: user.id } }),
    prisma.aiChatMessage.deleteMany({ where: { session: { userId: user.id } } }),
    prisma.aiChatSession.deleteMany({ where: { userId: user.id } }),
    prisma.account.deleteMany({ where: { userId: user.id } }),
    prisma.category.deleteMany({ where: { userId: user.id } }),
    prisma.userSettings.updateMany({
      where: { userId: user.id },
      data: { defaultAccountId: null },
    }),
    prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({ userId: user.id, ...c })),
    }),
  ]);

  return { ok: true };
}
