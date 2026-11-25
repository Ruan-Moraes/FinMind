import { describe, expect, it } from 'vitest';
import { validateAgentTurnOutcome } from '@/features/ai-agent/services/agent-result-validator';
import {
  detectDeterministicToolCall,
  extractGoalDeadline,
  extractGoalTitle,
  parseBrlAmount,
} from '@/features/ai-agent/services/agent-intent-router';
import { detectBlockedSecurityIntent } from '@/features/ai-agent/domain/agent-risk-policy';
import { detectUnsupportedLocalMutation } from '@/features/ai-agent/services/agent-conversational-classifier';
import { AGENT_TOOL_DECLARATIONS } from '@/features/ai-agent/tools/tool-catalog';
import { getMutationToolExecutor } from '@/features/ai-agent/tools/tool-dispatcher';
import { READ_ANALYTICS_TOOL_NAMES } from '@/features/ai-agent/tools/tool-catalog-analytics';
import { TOOL_RISK_POLICY } from '@/features/ai-agent/domain/agent-risk-policy';
import type { UiStateSnapshot } from '@/features/ai-agent/domain/agent-types';

const ui = { activeTab: 'overview', selectedMonth: 11, selectedYear: 2026 } as UiStateSnapshot;
const base = { readToolsExecuted: [], actionToolsCalled: [], contentBlocks: [], visualSteps: [], narrative: '' };

describe('Validador de intenção', () => {
  it('pedido "ensinar e configurar" dispara correção quando só houve o guia (antes era código morto)', () => {
    const res = validateAgentTurnOutcome({
      ...base, userMessage: 'me ensine como criar uma meta e crie uma de R$ 500 para mim',
      actionToolsCalled: ['guide_feature_workflow'], guideRequested: true,
    });
    expect(res.aligned).toBe(false);
  });

  it('não exige mais nada quando a mutação já foi preparada', () => {
    const res = validateAgentTurnOutcome({
      ...base, userMessage: 'me ensine como criar uma meta e crie uma de R$ 500',
      actionToolsCalled: ['guide_feature_workflow', 'upsert_portfolio_goal'], guideRequested: true, mutationPrepared: true,
    });
    expect(res.aligned).toBe(true);
  });

  it('"linha de base" não é tratado como pedido de gráfico', () => {
    const res = validateAgentTurnOutcome({ ...base, userMessage: 'qual é a minha linha de base fixa?', narrative: 'Sua linha de base é R$ 3.000.' });
    expect(res.aligned).toBe(true);
  });
});

describe('Roteador local (sem chave de API)', () => {
  it('extrai título e prazo da meta em vez de "Nova Meta de Carteira" no mês atual', () => {
    const call = detectDeterministicToolCall('crie uma meta de viagem de R$ 5000', ui);
    expect(call).toMatchObject({ name: 'upsert_portfolio_goal', args: { title: 'Viagem', targetAmountBRL: 5000, targetMonth: 11, targetYear: 2027 } });
    expect(extractGoalTitle('cadastre a meta "Reserva de Emergência" de R$ 10 mil até dezembro de 2027')).toBe('Reserva de Emergência');
    expect(extractGoalDeadline('até dezembro de 2027', 11, 2026)).toEqual({ month: 12, year: 2027 });
    expect(extractGoalDeadline('em 2 anos', 11, 2026)).toEqual({ month: 11, year: 2028 });
    expect(extractGoalTitle('crie uma meta de R$ 5.000')).toBeNull();
  });

  it('entende "mil" e não confunde o ano com o valor', () => {
    expect(parseBrlAmount('meta de R$ 10 mil')).toBe(10000);
    expect(parseBrlAmount('meta Japão para 2027 de R$ 20.000')).toBe(20000);
    expect(parseBrlAmount('meta para 2027')).toBeNull();
  });

  it('pedido de alteração não suportado no modo local recebe resposta honesta (não um resumo do mês)', () => {
    expect(detectUnsupportedLocalMutation('Lance uma despesa de R$ 10 na conta Nubank')).toMatch(/provedor de IA conectado/);
    expect(detectUnsupportedLocalMutation('exclua o lançamento do iFood')).toMatch(/provedor/);
    expect(detectUnsupportedLocalMutation('como faço para lançar uma despesa?')).toBeNull();
    expect(detectUnsupportedLocalMutation('quanto gastei este mês?')).toBeNull();
  });

  it('"mude o tema para escuro" funciona localmente', () => {
    expect(detectDeterministicToolCall('mude o tema para escuro', ui)).toMatchObject({ name: 'update_user_preferences', args: { theme: 'DARK' } });
  });
});

describe('Política de segurança', () => {
  it('registra a ferramenta bloqueada correta', () => {
    expect(detectBlockedSecurityIntent('quero resetar tudo').toolName).toBe('reset_all_data');
    expect(detectBlockedSecurityIntent('mostrar minha chave de api').toolName).toBe('update_api_keys');
    expect(detectBlockedSecurityIntent('alterar minha senha agora').toolName).toBe('change_password');
  });

  it('toda ferramenta declarada tem risco definido e executor (escrita) ou leitor (leitura)', () => {
    for (const tool of AGENT_TOOL_DECLARATIONS) {
      expect(TOOL_RISK_POLICY[tool.name], tool.name).toBeDefined();
      const risk = TOOL_RISK_POLICY[tool.name];
      if (risk === 'L2' || risk === 'L3') expect(getMutationToolExecutor(tool.name), tool.name).not.toBeNull();
      if (tool.name.startsWith('query_')) expect(READ_ANALYTICS_TOOL_NAMES.has(tool.name), tool.name).toBe(true);
    }
  });
});

describe('Aviso de falha do provedor', () => {
  it('chave recusada vira orientação curta, sem repetir a chave', async () => {
    const { describeProviderFailure } = await import('@/features/ai-agent/services/agent-orchestrator');
    const msg = describeProviderFailure('GPT', new Error('OpenAI API HTTP 401: Incorrect API key provided: sk-proj-****abc'));
    expect(msg).toMatch(/foi recusada pelo provedor \(HTTP 401\)/);
    expect(msg).not.toMatch(/sk-proj/);
    expect(describeProviderFailure('GPT', new Error('boom sk-proj-abcdef123'))).not.toMatch(/abcdef/);
  });
});
