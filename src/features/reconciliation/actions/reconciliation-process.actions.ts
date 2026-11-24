'use server';
import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import { type AiProviderId, type AiConnectionMode, callProviderApiJson, extractJsonFromAiResponse, getAiModelDescriptor, isAuthenticApiKey } from '@/features/ai-copilot/providers';
import { getActiveSsoSession } from '@/features/auth/sso';
import { type StatementFileInput, parseMultipleStatementFiles } from '@/features/reconciliation/parsers';
import { type StatementImportReviewPlan, type OptionalAiEnrichmentItem, type FinancialPurpose, type StatementMovementKind, runIntelligentReconciliationPipeline, buildMemoryPatternKey, sanitizeTextForExternalAi } from '@/features/reconciliation/engine';
export async function processMultiStatementImportAction(data: {
  files: StatementFileInput[];
  provider?: AiProviderId;
  connectionMode?: AiConnectionMode;
}): Promise<{
  ok: boolean;
  plan?: StatementImportReviewPlan;
  sourceMode: string;
  aiWarning?: string | null;
  error?: string;
}> {
  const user = await requireAuthenticatedUser();
  if (!data.files || data.files.length === 0) {
    return {
      ok: false,
      sourceMode: 'NONE',
      error: 'Selecione ao menos um arquivo ou informe os dados do extrato para importar.',
    };
  }
  const [
    categories,
    rawRules,
    rawTransactions,
    rawCards,
    memoryRules,
    ssoState,
  ] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    }),
    prisma.recurrenceRule.findMany({
      where: { userId: user.id, isActive: true },
      include: { category: true },
      orderBy: { dayOfMonth: 'asc' },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      include: { category: true },
      orderBy: { date: 'desc' },
      take: 600,
    }),
    prisma.creditCard.findMany({
      where: { userId: user.id },
      include: {
        invoices: {
          include: { transactions: true },
        },
      },
    }),
    prisma.reconciliationMemoryRule.findMany({
      where: { userId: user.id },
      orderBy: { confirmCount: 'desc' },
    }),
    getActiveSsoSession(),
  ]);
  const provider = (data.provider || user.settings?.aiProvider || 'OPENAI') as AiProviderId;
  const mode = (data.connectionMode ||
    user.settings?.aiConnectionMode ||
    'SUBSCRIPTION') as AiConnectionMode;
  const activeModelId =
    provider === 'OPENAI'
      ? user.settings?.openaiModel || 'gpt-4o-mini'
      : provider === 'GEMINI'
      ? user.settings?.geminiModel || 'gemini-2.0-flash'
      : user.settings?.claudeModel || 'claude-3-5-sonnet-latest';
  const descriptor = getAiModelDescriptor(activeModelId);
  const preParsedFiles = await parseMultipleStatementFiles(data.files);
  const aiEnrichments = new Map<string, OptionalAiEnrichmentItem>();
  let sourceMode = 'LOCAL_SEMANTIC_ENGINE';
  let aiWarning: string | null = null;
  if (mode === 'API_QUOTA') {
    const rawKey =
      provider === 'OPENAI'
        ? user.settings?.openaiApiKey || process.env.OPENAI_API_KEY
        : provider === 'GEMINI'
        ? user.settings?.geminiApiKey || process.env.GEMINI_API_KEY
        : user.settings?.claudeApiKey || process.env.ANTHROPIC_API_KEY;
    if (isAuthenticApiKey(rawKey)) {
      try {
        const allMovements = preParsedFiles.flatMap((f) => f.movements);
        const patternGroups = new Map<string, typeof allMovements>();
        for (const mov of allMovements) {
          const pKey = `${mov.direction}::${buildMemoryPatternKey(mov.originalDescription)}`;
          const list = patternGroups.get(pKey) || [];
          list.push(mov);
          patternGroups.set(pKey, list);
        }
        const representativeMovements = Array.from(patternGroups.values())
          .map((group) => group[0])
          .slice(0, 60);
        if (representativeMovements.length > 0) {
          const sanitizedList = representativeMovements.map((m) => ({
            rawId: m.rawId,
            direction: m.direction,
            description: sanitizeTextForExternalAi(m.originalDescription),
          }));
          const aiPrompt = `Analise semanticamente as descrições bancárias sanitizadas abaixo e classifique apenas a ação financeira (financialActionLabel), finalidade (purpose) e categoria (categoryId).
NÃO altere datas nem valores. Caso nenhuma categoria seja adequada, retorne categoryId vazio "".
CATEGORIAS: ${JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name, type: c.type })))}
ITENS: ${JSON.stringify(sanitizedList)}
Retorne JSON: { "enrichments": [{ "rawId": "...", "financialActionLabel": "...", "purpose": "...", "categoryId": "...", "nature": "STATIC|VARIABLE", "movementKind": "INCOME|EXPENSE|OBLIGATION_PAYMENT|SELF_TRANSFER|CREDIT_CARD_PAYMENT|REFUND" }] }`;
          const aiRawJson = await callProviderApiJson({
            provider,
            apiKey: rawKey!.trim(),
            model: descriptor.id,
            prompt: aiPrompt,
            ssoToken: ssoState.token || undefined,
          });
          const parsedAi = extractJsonFromAiResponse<{
            enrichments?: Array<{
              rawId: string;
              financialActionLabel?: string;
              purpose?: FinancialPurpose;
              categoryId?: string;
              nature?: 'STATIC' | 'VARIABLE';
              movementKind?: StatementMovementKind;
            }>;
          }>(aiRawJson);
          if (parsedAi?.enrichments && Array.isArray(parsedAi.enrichments)) {
            const repMap = new Map<string, OptionalAiEnrichmentItem>();
            for (const item of parsedAi.enrichments) {
              if (item && item.rawId) {
                repMap.set(item.rawId, item);
              }
            }
            for (const group of patternGroups.values()) {
              const repEnrichment = repMap.get(group[0].rawId);
              if (repEnrichment) {
                for (const member of group) {
                  aiEnrichments.set(member.rawId, {
                    ...repEnrichment,
                    rawId: member.rawId,
                  });
                }
              }
            }
            sourceMode = `${descriptor.displayName}_API_HYBRID`;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro na consulta ao provedor de IA';
        aiWarning = `Aviso: O enriquecimento complementar via API (${descriptor.displayName}) falhou (${msg}). O plano foi processado pelo Motor Semântico e Contextual Determinístico.`;
      }
    } else {
      aiWarning = `Nenhuma chave de API oficial configurada para ${descriptor.providerGroupLabel}. O plano foi processado pelo Motor Semântico e Contextual Determinístico.`;
    }
  }
  const existingInvoices = rawCards.flatMap((card) =>
    card.invoices.map((inv) => ({
      id: inv.id,
      creditCardId: card.id,
      creditCardName: card.name,
      month: inv.month,
      year: inv.year,
      status: inv.status as 'OPEN' | 'CLOSED' | 'PAID',
      totalAmountInCents: inv.transactions.reduce((acc, t) => acc + t.amountInCents, 0),
      dueDay: card.dueDay,
    }))
  );
  const plan = await runIntelligentReconciliationPipeline({
    files: data.files,
    parsedFiles: preParsedFiles,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      defaultNature: c.defaultNature,
    })),
    recurrenceRules: rawRules.map((r) => ({
      id: r.id,
      description: r.description,
      type: r.type as 'INCOME' | 'EXPENSE',
      nature: r.nature as 'STATIC' | 'VARIABLE',
      amountInCents: r.amountInCents,
      dayOfMonth: r.dayOfMonth,
      frequency: r.frequency,
      categoryId: r.categoryId,
      categoryName: r.category?.name || null,
      accountId: r.accountId,
    })),
    existingTransactions: rawTransactions.map((tx) => ({
      id: tx.id,
      description: tx.description,
      type: tx.type as 'INCOME' | 'EXPENSE' | 'TRANSFER',
      nature: tx.nature as 'STATIC' | 'VARIABLE',
      amountInCents: tx.amountInCents,
      date: tx.date.toISOString().slice(0, 10),
      status: tx.status as 'COMPLETED' | 'PENDING',
      categoryId: tx.categoryId,
      categoryName: tx.category?.name || null,
      sourceAccountId: tx.sourceAccountId,
      recurrenceRuleId: tx.recurrenceRuleId,
      externalTransactionHash: tx.externalTransactionHash,
      rawBankDescription: tx.rawBankDescription,
    })),
    existingInvoices,
    memoryRules: memoryRules.map((m) => ({
      id: m.id,
      normalizedPattern: m.normalizedPattern,
      merchantKeyword: m.merchantKeyword,
      financialAction: m.financialAction,
      purpose: m.purpose,
      targetType: m.targetType,
      nature: m.nature,
      categoryId: m.categoryId,
      recurrenceRuleId: m.recurrenceRuleId,
      confirmCount: m.confirmCount,
    })),
    aiEnrichments,
  });
  return {
    ok: true,
    plan,
    sourceMode,
    aiWarning,
  };
}
