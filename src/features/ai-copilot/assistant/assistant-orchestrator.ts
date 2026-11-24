import { prisma } from '@/shared/lib/prisma';
import { formatCentsToBRL } from '@/shared/lib/currency';
import { getAccountsWithBalances, getCreditCardsWithSummary, getPortfolioGoalsProgress, getMonthSummary, getStaticBaselineSummary, getMoMComparison, getSixMonthsHistory } from '@/features/analytics';
import { retrieveFinancialContextForQuery } from '@/features/ai-copilot/rag';
import { getAiModelDescriptor, resolveDynamicModelRoute, callProviderApiJson, extractJsonFromAiResponse } from '@/features/ai-copilot/providers';
import { type AssistantStructuredResponse, buildGroundedAssistantPrompt } from "@/features/ai-copilot/assistant/assistant-types-and-prompts";
import { buildDeterministicAssistantSynthesis } from "@/features/ai-copilot/assistant/deterministic-synthesis";
import { buildDynamicAssistantCharts } from "@/features/ai-copilot/assistant/assistant-chart-builder";
import { resolveEffectiveRulesForMonth } from '@/features/planning/domain/recurrence-month-skip';
export async function executeContextualFinancialAssistant(params: {
  userId: string;
  question: string;
  referenceMonth?: number;
  referenceYear?: number;
  requireLiveLlm?: boolean;
}): Promise<AssistantStructuredResponse> { const { userId, question } = params;
  const cleanQuestion = question.trim();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { settings: true },
  });
  if (!user) { throw new Error('Usuário autenticado não encontrado.');
  }
  const now = new Date();
  const refMonth = params.referenceMonth || now.getMonth() + 1;
  const refYear = params.referenceYear || now.getFullYear();
  const fiscalDay = user.settings?.fiscalMonthStartDay || 1;
  const prevMonth = refMonth === 1 ? 12 : refMonth - 1;
  const prevYear = refMonth === 1 ? refYear - 1 : refYear;
  const [
    accounts, creditCards,
    monthSummary, momComparison,
    sixMonths, budgets,
    recurrenceRules, totalTxCount,
    ragResult, ] = await Promise.all([
    getAccountsWithBalances(userId), getCreditCardsWithSummary(userId, refMonth, refYear),
    getMonthSummary(userId, refMonth, refYear, fiscalDay),
    getMoMComparison(userId, prevMonth, prevYear, refMonth, refYear, fiscalDay),
    getSixMonthsHistory(userId, refMonth, refYear, fiscalDay),
    prisma.budget.findMany({
      where: { userId, month: refMonth, year: refYear },
      include: { category: true },
    }),
    prisma.recurrenceRule.findMany({
      where: { userId, isActive: true },
      include: { category: true },
    }),
    prisma.transaction.count({ where: { userId } }),
    retrieveFinancialContextForQuery({
      userId, query: cleanQuestion,
      topK: 15, filterMonth: refMonth,
      filterYear: refYear,
      userKeys: {
        openaiApiKey: user.settings?.openaiApiKey, geminiApiKey: user.settings?.geminiApiKey,
      }, }),
  ]);
  const activeRulesForRefMonth = resolveEffectiveRulesForMonth(recurrenceRules, refYear, refMonth);
  const [portfolioGoals, staticBaseline] = await Promise.all([
    getPortfolioGoalsProgress(userId, accounts, creditCards, refMonth, refYear), getStaticBaselineSummary(userId, monthSummary),
  ]);
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const consolidatedBalanceInCents = activeAccounts.reduce(
    (acc, a) => acc + a.currentBalanceInCents, 0
  );
  const totalCardDebtInCents = creditCards.reduce((acc, c) => acc + c.usedLimitInCents, 0);
  const netWorthInCents = consolidatedBalanceInCents - totalCardDebtInCents;
  const hasSufficientData =
    totalTxCount > 0 ||
    activeAccounts.some((a) => a.currentBalanceInCents !== 0) ||
    portfolioGoals.length > 0 ||
    recurrenceRules.length > 0;
  const retrievedSources = ragResult.chunks.map((c) => ({
    sourceType: c.sourceType, sourceId: c.sourceId,
    title: c.title, referenceDate: c.referenceDate,
    amountInCents: c.amountInCents, score: c.score,
  }));
  const provider = (user.settings?.aiProvider || 'OPENAI') as 'OPENAI' | 'GEMINI' | 'CLAUDE';
  const modelId =
    provider === 'OPENAI'
      ? user.settings?.openaiModel || 'gpt-4o-mini'
      : provider === 'GEMINI'
      ? user.settings?.geminiModel || 'gemini-2.0-flash'
      : user.settings?.claudeModel || 'claude-3-5-sonnet-latest';
  const descriptor = getAiModelDescriptor(modelId);
  const routeConfig = resolveDynamicModelRoute(descriptor.id, {
    openaiApiKey: user.settings?.openaiApiKey, geminiApiKey: user.settings?.geminiApiKey,
    claudeApiKey: user.settings?.claudeApiKey, });
  if (!hasSufficientData) {
    return {
      ok: true, question: cleanQuestion,
      executionMode: 'DETERMINISTIC_RAG_ENGINE',
      modelUsed: 'Motor Determinístico + RAG (Sem Dados Cadastrados)', providerUsed: 'FINMIND_LOCAL',
      hasSufficientData: false, directAnswer:
        'Não há dados financeiros suficientes cadastrados na sua conta para responder a esta pergunta com precisão. Importe seus extratos bancários ou cadastre suas contas, transações e metas para habilitar análises baseadas no seu histórico real.',
      historicalFacts: [
        'Nenhuma transação financeira ou regra recorrente foi encontrada no banco de dados para o seu usuário.',
      ], calculatedResults: [
        `Saldo Consolidado Atual: ${formatCentsToBRL(0)}`,
        `Total de Registros Indexados no RAG: 0`, ],
      projectionsAndEstimates: [
        'Projeções indisponíveis: são necessários históricos de receitas e despesas para estimar tendências.',
      ], personalizedRecommendations: [
        'Importe um extrato (CSV, OFX, XLSX ou PDF) na seção de Importação & Conciliação Inteligente.',
        'Cadastre sua primeira Meta de Carteira e seus Custos/Ganhos Estáticos na aba Metas.', ],
      retrievedSources: [],
      ragStats: {
        totalIndexedChunks: 0, retrievedChunksCount: 0,
        embeddingModelUsed: ragResult.embeddingModelUsed, },
      answeredAt: new Date().toISOString(), };
  }
  const deterministicSynthesis = buildDeterministicAssistantSynthesis({
    question: cleanQuestion, refMonth,
    refYear, consolidatedBalanceInCents,
    netWorthInCents, monthSummary,
    momComparison, staticBaseline,
    portfolioGoals,
    budgets: budgets.map((b) => ({
      categoryName: b.category.name, maxAmountInCents: b.maxAmountInCents,
      spentInCents:
        monthSummary.categoryBreakdown.find((c) => c.categoryId === b.categoryId)
          ?.amountInCents || 0, })),
    recurrenceRules: activeRulesForRefMonth.map((r) => ({
      description: r.description, type: r.type,
      amountInCents: r.amountInCents, dayOfMonth: r.dayOfMonth,
    })), sixMonths,
    retrievedChunks: ragResult.chunks, });
  const dynamicCharts = buildDynamicAssistantCharts({
    question: cleanQuestion,
    netWorthInCents,
    monthSummary,
    staticBaseline,
    portfolioGoals,
    sixMonths,
  });
  let apiWarning: string | null = null;
  if (routeConfig.hasExternalApiKey) {
    try {
      const prompt = buildGroundedAssistantPrompt({
        modelDisplayName: descriptor.displayName, cleanQuestion,
        refMonth, refYear,
        consolidatedBalanceInCents, netWorthInCents,
        monthSummary, staticBaseline,
        momComparison, portfolioGoals,
        chunks: ragResult.chunks, });
      const rawJson = await callProviderApiJson({
        provider, apiKey: routeConfig.effectiveApiKey,
        model: descriptor.id, prompt,
      });
      const parsed = extractJsonFromAiResponse<{ directAnswer?: string;
        historicalFacts?: string[];
        calculatedResults?: string[];
        projectionsAndEstimates?: string[];
        personalizedRecommendations?: string[];
      }>(rawJson);
      if (parsed && parsed.directAnswer) {
        return {
          ok: true, question: cleanQuestion,
          executionMode: 'LIVE_LLM_RAG', modelUsed: descriptor.displayName,
          providerUsed: descriptor.providerGroupLabel, hasSufficientData: true,
          directAnswer: String(parsed.directAnswer), historicalFacts:
            Array.isArray(parsed.historicalFacts) && parsed.historicalFacts.length > 0
              ? parsed.historicalFacts.map(String)
              : deterministicSynthesis.historicalFacts, calculatedResults:
            Array.isArray(parsed.calculatedResults) && parsed.calculatedResults.length > 0
              ? parsed.calculatedResults.map(String)
              : deterministicSynthesis.calculatedResults, projectionsAndEstimates:
            Array.isArray(parsed.projectionsAndEstimates) &&
            parsed.projectionsAndEstimates.length > 0
              ? parsed.projectionsAndEstimates.map(String)
              : deterministicSynthesis.projectionsAndEstimates, personalizedRecommendations:
            Array.isArray(parsed.personalizedRecommendations) &&
            parsed.personalizedRecommendations.length > 0
              ? parsed.personalizedRecommendations.map(String)
              : deterministicSynthesis.personalizedRecommendations, retrievedSources,
          ragStats: {
            totalIndexedChunks: ragResult.totalIndexedChunks, retrievedChunksCount: ragResult.chunks.length,
            embeddingModelUsed: ragResult.embeddingModelUsed, },
          charts: dynamicCharts,
          apiWarning: null, answeredAt: new Date().toISOString(),
        };
      }
    } catch (err) { const errMsg = err instanceof Error ? err.message : 'Falha na chamada ao provedor de IA.';
      if (params.requireLiveLlm) { throw new Error(errMsg);
      }
      apiWarning = `A chamada à API externa (${descriptor.displayName}) retornou erro (${errMsg}). Exibindo análise fundamentada gerada pelo Motor RAG Determinístico Local sobre seus dados reais.`;
    }
  } else if (params.requireLiveLlm) {
    throw new Error(
      `Nenhuma chave de API oficial (${descriptor.envVarName}) configurada para ${descriptor.providerGroupLabel}.`
    );
  }
  return {
    ok: true, question: cleanQuestion,
    executionMode: 'DETERMINISTIC_RAG_ENGINE', modelUsed: 'Motor RAG Híbrido & Analítico Determinístico',
    providerUsed: 'FINMIND_RAG_LOCAL', hasSufficientData: true,
    directAnswer: deterministicSynthesis.directAnswer,
    historicalFacts: deterministicSynthesis.historicalFacts,
    calculatedResults: deterministicSynthesis.calculatedResults,
    projectionsAndEstimates: deterministicSynthesis.projectionsAndEstimates,
    personalizedRecommendations: deterministicSynthesis.personalizedRecommendations, retrievedSources,
    ragStats: {
      totalIndexedChunks: ragResult.totalIndexedChunks, retrievedChunksCount: ragResult.chunks.length,
      embeddingModelUsed: ragResult.embeddingModelUsed, },
    charts: dynamicCharts,
    apiWarning, answeredAt: new Date().toISOString(),
  };
}
