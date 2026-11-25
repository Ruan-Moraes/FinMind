import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import type { AgentConversationMessage, AgentProviderResponse } from '@/features/ai-agent/services/agent-tool-provider-client';

const providerCalls: AgentConversationMessage[][] = [];
let scriptedResponses: AgentProviderResponse[] = [];

vi.mock('@/features/ai-agent/services/agent-tool-provider-client', () => ({
  callAgentProviderWithTools: vi.fn(async (params: { messages: AgentConversationMessage[] }) => {
    providerCalls.push(params.messages.map((m) => ({ ...m })));
    return scriptedResponses.shift() ?? { text: '', toolCalls: [] };
  }),
}));

const { runLiveAgentToolLoop } = await import('@/features/ai-agent/services/agent-react-loop');
const { composeAgentTurnFromTools } = await import('@/features/ai-agent/services/agent-tool-plan-builder');
const { loadAnalyticsExecutionContext } = await import('@/features/ai-agent/tools/tool-executors-analytics');

describe('Loop do agente: recusas de preparo chegam ao modelo e ao usuário', () => {
  let userId = '';

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `agent-loop-${Date.now()}@finmind.test`, name: 'Agent Loop', passwordHash: 'hash' },
    });
    userId = user.id;
    await prisma.account.create({ data: { userId, name: 'Nubank', type: 'CHECKING' } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  beforeEach(() => {
    providerCalls.length = 0;
    scriptedResponses = [];
  });

  const runLoop = async (msg: string) =>
    runLiveAgentToolLoop({
      userId, provider: 'OPENAI', apiKey: 'test', modelId: 'gpt-test', systemInstruction: 'sys',
      historyMessages: [], cleanMsg: msg, analyticsCtx: await loadAnalyticsExecutionContext(userId, 11, 2026),
    });

  it('devolve o erro real como resultado da ferramenta e não enfileira a mutação recusada', async () => {
    scriptedResponses = [
      { text: '', toolCalls: [{ id: 'c1', name: 'create_transaction', args: { type: 'EXPENSE', description: 'Pizza', amountBRL: 50, date: '2026-11-10', accountName: 'Banco Fantasma' } }] },
      { text: 'Não encontrei a conta "Banco Fantasma". Você tem: Nubank.', toolCalls: [] },
    ];
    const result = await runLoop('lance uma pizza de 50 no Banco Fantasma');
    const toolMsg = providerCalls[1].find((m) => m.role === 'tool') as { content: string };
    expect(JSON.parse(toolMsg.content).error).toMatch(/Não encontrei conta "Banco Fantasma"/);
    expect(result.actionTools).toHaveLength(0);
    expect(result.unrelayedErrors).toHaveLength(0); // o modelo comentou o erro
    expect(result.finalNarrative).toMatch(/Nubank/);
  });

  it('quando o modelo não comenta a recusa, ela é devolvida para exibição', async () => {
    scriptedResponses = [
      { text: 'Preparei o lançamento, confirme abaixo.', toolCalls: [{ id: 'c1', name: 'create_transaction', args: { type: 'EXPENSE', description: 'Pizza', amountBRL: 50, date: '2026-11-10', accountName: 'Banco Fantasma' } }] },
    ];
    const result = await runLoop('lance uma pizza');
    expect(result.unrelayedErrors.join(' ')).toMatch(/Banco Fantasma/);
  });

  it('mutação válida é preparada (sem gravar) e a ferramenta inventada não derruba o turno', async () => {
    scriptedResponses = [
      {
        text: 'Aguardando sua confirmação.',
        toolCalls: [
          { id: 'c1', name: 'create_transaction', args: { type: 'EXPENSE', description: 'Mercado', amountBRL: 80, date: '2026-11-10', accountName: 'Nubank' } },
          { id: 'c2', name: 'teleport_money', args: {} },
        ],
      },
    ];
    const result = await runLoop('lance mercado de 80');
    expect(result.actionTools.map((t) => t.name)).toEqual(['create_transaction']);
    expect(await prisma.transaction.count({ where: { userId } })).toBe(0);
    const toolMsgs = providerCalls.flat().filter((m) => m.role === 'tool');
    expect(toolMsgs).toHaveLength(0); // só uma chamada ao provedor: resultados vão para a próxima rodada
  });

  it('o montador do turno sempre mostra recusas, mesmo com narrativa do modelo', async () => {
    const payload = await composeAgentTurnFromTools({
      userId, runId: `run-${Date.now()}`, interactionMode: 'FAST', contentBlocks: [],
      actionTools: [{ name: 'upsert_budget', args: { categoryName: 'Inexistente', amountBRL: 100 } }, { name: 'nao_existe', args: {} }],
      llmNarrative: 'Pronto, preparei o orçamento.', executionMode: 'LIVE_AGENT_TOOLS',
      providerLabel: 'OpenAI', modelLabel: 'GPT', systemSources: [], apiWarning: null,
    });
    expect(payload.narrative).toMatch(/Pronto, preparei/);
    expect(payload.narrative).toMatch(/Não encontrei categoria "Inexistente"/);
    expect(payload.narrative).toMatch(/nao_existe/);
    expect(payload.providerUsed).not.toBe('FINMIND_SECURITY_GUARD');
    expect(payload.pendingMutation).toBeFalsy();
  });
});
