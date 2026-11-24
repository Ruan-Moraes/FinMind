import { formatCentsToBRL } from "@/shared/lib/currency";
import { type AiProviderId, type AiModelId } from "@/features/ai-copilot/models";

export interface ExtractedStatementItem {
  tempId: string;
  description: string;
  amountInCents: number;
  date: string; // YYYY-MM-DD
  type: 'INCOME' | 'EXPENSE';
  nature: 'STATIC' | 'VARIABLE';
  categoryId: string;
  categoryName: string;
  tags: string;
}

export interface AiFinancialStatusAnalysis {
  healthScore: number; // 0-100
  summary: string;
  strengths: string[];
  risks: string[];
  actionPlan: string[];
}

export const AI_PROVIDER_META: Record<
  AiProviderId,
  {
    name: string;
    subscriptionName: string;
    webUrl: string;
    badgeColor: string;
    defaultModel: AiModelId;
    models: Array<{ id: AiModelId; label: string }>;
  }
> = {
  OPENAI: {
    name: 'OpenAI',
    subscriptionName: 'Ponte ChatGPT Web / API Oficial OpenAI',
    webUrl: 'https://chatgpt.com/',
    badgeColor: '#10b981',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'o3-mini', label: 'OpenAI o3-mini' },
    ],
  },
  GEMINI: {
    name: 'Google Gemini',
    subscriptionName: 'Ponte Gemini Web / Google AI Studio API',
    webUrl: 'https://gemini.google.com/app',
    badgeColor: '#3b82f6',
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    ],
  },
  CLAUDE: {
    name: 'Anthropic Claude',
    subscriptionName: 'Ponte Claude Web / Anthropic Console API',
    webUrl: 'https://claude.ai/new',
    badgeColor: '#d97706',
    defaultModel: 'claude-3-5-sonnet-latest',
    models: [
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
      { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet' },
    ],
  },
};


/**
 * Gera o prompt estruturado para leitura de extrato financeiro.
 */
export function buildSubscriptionStatementPrompt(
  rawStatementText: string,
  categories: Array<{ id: string; name: string; type: string; defaultNature: string }>,
  activeModelName = 'GPT-4o Mini'
): string {
  const catsList =
    categories.length > 0
      ? categories
          .map(
            (c) =>
              `- ID: "${c.id}" | Nome: "${c.name}" | Tipo: ${c.type} | Natureza Padrão: ${c.defaultNature}`
          )
          .join('\n')
      : '- Sem categorias pré-cadastradas (utilize categoryId vazio "")';

  const today = new Date().toISOString().slice(0, 10);

  return `Você está operando como o modelo ${activeModelName} integrado ao sistema FinMind.
Analise os dados financeiros abaixo e identifique TODOS os itens que eu GANHEI (INCOME) e que eu GASTEI (EXPENSE).

CATEGORIAS DISPONÍVEIS NO MEU BANCO DE DADOS:
${catsList}

REGRAS DE EXTRAÇÃO:
1. Converta todos os valores para CENTAVOS INTEIROS positivos (ex: R$ 150,50 -> 15050).
2. Classifique "type" como "INCOME" (ganhos/entradas) ou "EXPENSE" (gastos/saídas).
3. Classifique "nature" como "STATIC" (custos/ganhos fixos inflexíveis) ou "VARIABLE" (gastos/ganhos variáveis).
4. Utilize apenas um "categoryId" presente na lista acima. Caso nenhuma categoria seja claramente adequada, retorne "categoryId": "" (não force uma categoria incorreta).
5. Caso uma data não seja informada, utilize a data base ${today} no formato "YYYY-MM-DD".
6. Retorne APENAS um bloco JSON válido no formato abaixo:

\`\`\`json
{
  "items": [
    {
      "description": "Descrição do lançamento",
      "amountInCents": 0,
      "date": "${today}",
      "type": "EXPENSE",
      "nature": "VARIABLE",
      "categoryId": "",
      "tags": "extrato"
    }
  ]
}
\`\`\`

DADOS PARA ANALISAR:
"""
${rawStatementText.trim()}
"""`;
}

/**
 * Gera o prompt estruturado para análise de Status Financeiro dinâmico.
 */
export function buildSubscriptionStatusPrompt(context: {
  consolidatedBalanceInCents: number;
  staticIncomeInCents: number;
  staticExpenseInCents: number;
  freeIncomeInCents: number;
  monthIncomeInCents: number;
  monthExpenseInCents: number;
  championCategoryName: string;
  championCategoryAmountInCents: number;
  portfolioGoalTitle?: string;
  portfolioGoalTargetInCents?: number;
  portfolioGoalCurrentInCents?: number;
  portfolioGoalRemainingInCents?: number;
  momDiffInCents: number;
  momVariationPercent: number;
}): string {
  return `Você é meu Consultor Financeiro Pessoal no sistema FinMind.
Analise os dados dinâmicos reais da minha situação financeira atual e gere um diagnóstico estratégico fundamentado exclusivamente nos números abaixo:

DADOS ATUAIS DA MINHA CARTEIRA:
- Saldo Consolidado em Contas: ${formatCentsToBRL(context.consolidatedBalanceInCents)}
- Ganhos Estáticos Garantidos: ${formatCentsToBRL(context.staticIncomeInCents)}
- Custos Estáticos Inflexíveis (Fixos): ${formatCentsToBRL(context.staticExpenseInCents)}
- Renda Livre (Ganhos Estáticos - Custos Estáticos): ${formatCentsToBRL(context.freeIncomeInCents)}
- Receitas Totais do Mês: ${formatCentsToBRL(context.monthIncomeInCents)}
- Despesas Totais do Mês: ${formatCentsToBRL(context.monthExpenseInCents)}
- Categoria Campeã de Gasto no Mês: ${context.championCategoryName} (${formatCentsToBRL(context.championCategoryAmountInCents)})
- Comparativo com o Mês Anterior (MoM): Variação de ${formatCentsToBRL(context.momDiffInCents)} (${context.momVariationPercent.toFixed(1)}%)
${
  context.portfolioGoalTitle
    ? `- Meta de Carteira ("${context.portfolioGoalTitle}"): Alvo de ${formatCentsToBRL(
        context.portfolioGoalTargetInCents || 0
      )} | Atual: ${formatCentsToBRL(
        context.portfolioGoalCurrentInCents || 0
      )} | Falta: ${formatCentsToBRL(context.portfolioGoalRemainingInCents || 0)}`
    : ''
}

Retorne APENAS um bloco JSON válido no formato abaixo:

\`\`\`json
{
  "healthScore": 85,
  "summary": "Resumo executivo direto sobre minha situação atual.",
  "strengths": [
    "Ponto positivo 1"
  ],
  "risks": [
    "Ponto de atenção 1"
  ],
  "actionPlan": [
    "Ação prática 1"
  ]
}
\`\`\``;
}


export function extractJsonFromAiResponse<T>(rawText: string): T | null {
  try {
    const cleaned = rawText.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenceMatch ? fenceMatch[1].trim() : cleaned;
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T;
    }
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

