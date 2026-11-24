import type { AgentRiskLevel } from '@/features/ai-agent/domain/agent-types';

export const TOOL_RISK_POLICY: Record<string, AgentRiskLevel> = {
  // L0: Leitura, orientação, captura
  navigate_to_section: 'L0',
  guide_feature_workflow: 'L0',
  capture_annotated_screen: 'L0',

  // L1: Estado visual / filtros / período
  change_period: 'L1',
  change_comparison_periods: 'L1',
  apply_transaction_filters: 'L1',
  open_settings: 'L0',

  // L2: Criação / Edição persistente (requer confirmação Antes -> Depois, reversível)
  update_user_preferences: 'L2',
  upsert_portfolio_goal: 'L2',
  upsert_static_rule: 'L2',
  upsert_budget: 'L2',
  upsert_category: 'L2',
  upsert_value_forecast: 'L2',
  upsert_balance_target: 'L2',
  upsert_account: 'L2',
  upsert_credit_card: 'L2',
  pay_credit_card_invoice: 'L2',
  create_transaction: 'L2',
  update_transaction: 'L2',
  sync_holidays: 'L2',
  generate_health_report: 'L2',

  // L3: Exclusões (confirmação explícita obrigatória)
  delete_portfolio_goal: 'L3',
  delete_static_rule: 'L3',
  delete_transaction: 'L3',
  delete_value_forecast: 'L3',

  // BLOCKED: Segurança crítica / destrutivo irreversível
  reset_all_data: 'BLOCKED',
  update_api_keys: 'BLOCKED',
  change_password: 'BLOCKED',
};

export function getToolRiskLevel(toolName: string): AgentRiskLevel {
  return TOOL_RISK_POLICY[toolName] ?? 'BLOCKED';
}

export function requiresExplicitConfirmation(riskLevel: AgentRiskLevel): boolean {
  return riskLevel === 'L2' || riskLevel === 'L3';
}

export function isBlockedRisk(riskLevel: AgentRiskLevel): boolean {
  return riskLevel === 'BLOCKED';
}

const SENSITIVE_PARAM_KEYS = new Set([
  'password',
  'passwordHash',
  'apiKey',
  'openaiApiKey',
  'geminiApiKey',
  'claudeApiKey',
  'token',
  'secret',
]);

export function redactSensitiveParams(params: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (SENSITIVE_PARAM_KEYS.has(k)) {
      safe[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      safe[k] = redactSensitiveParams(v as Record<string, unknown>);
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

export function detectBlockedSecurityIntent(prompt: string): {
  blocked: boolean;
  reason?: string;
} {
  const norm = prompt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (
    /\b(resetar tudo|apagar todos os dados|limpar todos os dados|zerar o banco|reset geral|deletar tudo)\b/.test(
      norm
    ) &&
    !/\b(como|onde|mostre|ensine|explica)\b/.test(norm)
  ) {
    return {
      blocked: true,
      reason:
        'Por segurança, o Reset Geral de Dados é uma operação bloqueada para execução autônoma pela IA. Posso, porém, abrir as Configurações e mostrar onde fica a Zona de Perigo para você confirmar manualmente com seu nome completo.',
    };
  }

  if (
    /\b(alterar|mudar|mostrar|exibir|revelar)\b.*\b(senha|api key|chave de api|chave openai|chave gemini|chave claude)\b/.test(
      norm
    ) &&
    !/\b(como|onde)\b/.test(norm)
  ) {
    return {
      blocked: true,
      reason:
        'Credenciais, senhas e chaves de API são protegidas e nunca são exibidas ou alteradas autonomamente pela IA. Posso guiá-lo até o Conector de Provedores para você gerenciar com segurança.',
    };
  }

  return { blocked: false };
}
