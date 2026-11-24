import { describe, expect, it } from 'vitest';
import { AGENT_TOOL_DECLARATIONS } from '@/features/ai-agent/tools/tool-catalog';
import { TOOL_RISK_POLICY, getToolRiskLevel } from '@/features/ai-agent/domain/agent-risk-policy';
import { getMutationToolExecutor, listSupportedMutationTools } from '@/features/ai-agent/tools/tool-dispatcher';
import { READ_ANALYTICS_TOOL_NAMES } from '@/features/ai-agent/tools/tool-catalog-analytics';

const UI_TOOLS = new Set([
  'navigate_to_section', 'open_settings', 'guide_feature_workflow', 'capture_annotated_screen',
  'apply_transaction_filters', 'change_period', 'render_visual_content',
]);

describe('Cobertura ferramentas ↔ política de risco ↔ executores', () => {
  const declared = AGENT_TOOL_DECLARATIONS.map((d) => d.name);

  it('toda ferramenta declarada ao modelo tem nível de risco explícito (senão seria BLOCKED por padrão)', () => {
    for (const name of declared) {
      expect(TOOL_RISK_POLICY[name], `sem política: ${name}`).toBeDefined();
      expect(getToolRiskLevel(name)).not.toBe('BLOCKED');
    }
  });

  it('toda ferramenta não bloqueada da política está de fato declarada (sem ferramentas fantasma)', () => {
    for (const [name, level] of Object.entries(TOOL_RISK_POLICY)) {
      if (level === 'BLOCKED' || name === 'batch_mutations') continue;
      expect(declared, `política sem implementação: ${name}`).toContain(name);
    }
  });

  it('toda ferramenta L2/L3 declarada possui executor de mutação com rollback', () => {
    const executors = new Set(listSupportedMutationTools());
    for (const name of declared) {
      const level = getToolRiskLevel(name);
      if (level === 'L2' || level === 'L3') {
        expect(executors.has(name), `sem executor: ${name}`).toBe(true);
        expect(getMutationToolExecutor(name)?.rollback, `sem rollback: ${name}`).toBeTypeOf('function');
      }
    }
  });

  it('toda ferramenta L0/L1 é de leitura analítica ou de UI', () => {
    for (const name of declared) {
      const level = getToolRiskLevel(name);
      if (level === 'L0' || level === 'L1') {
        expect(READ_ANALYTICS_TOOL_NAMES.has(name) || UI_TOOLS.has(name), `ferramenta órfã: ${name}`).toBe(true);
      }
    }
  });
});
